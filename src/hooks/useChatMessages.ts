'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatMessage } from '@/lib/types';
import { chatService } from '@/services/chatService';
import { storage } from '@/lib/storage';

interface UseChatMessagesOptions {
  selectedUserId?: string;
  onNewMessageSound?: () => void;
  onMessageSyncedToUser?: (
    userId: string,
    text: string,
    timestamp: number,
    sender: 'user' | 'agent'
  ) => void;
  pollingIntervalMs?: number;
}

export function useChatMessages(options: UseChatMessagesOptions = {}) {
  const {
    selectedUserId,
    onNewMessageSound,
    onMessageSyncedToUser,
    pollingIntervalMs = 2500,
  } = options;

  const [messagesByUserId, setMessagesByUserId] = useState<Record<string, ChatMessage[]>>({});
  const [isSending, setIsSending] = useState(false);

  const selectedUserIdRef = useRef<string | undefined>(selectedUserId);
  const lastMessageCountRef = useRef<number>(0);

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  // Messages strictly filtered for currently selected user
  const activeMessages = useMemo(() => {
    if (!selectedUserId) return [];
    return (messagesByUserId[selectedUserId] || []).filter((m) => m.userId === selectedUserId);
  }, [selectedUserId, messagesByUserId]);

  // Fetch messages from server with caching, deduplication and sound triggers
  const fetchMessagesForUser = useCallback(
    async (userId: string, silent = false) => {
      if (!userId) return;
      try {
        const incoming = await chatService.fetchMessages(userId);

        setMessagesByUserId((prevMap) => {
          const prevForUser = (prevMap[userId] || []).filter((m) => m.userId === userId);
          const cachedForUser = storage.getCachedMessages(userId);

          // If incoming is empty but we have local messages, preserve them
          if (incoming.length === 0 && (prevForUser.length > 0 || cachedForUser.length > 0)) {
            return prevMap;
          }

          // Merge cached + in-memory + incoming messages
          const map = new Map<string, ChatMessage>();
          cachedForUser.forEach((m) => map.set(m.id, m));
          prevForUser.forEach((m) => map.set(m.id, m));
          incoming.forEach((m) => map.set(m.id, m));

          // Clean up synthetic messages that now have official server messages
          const allItems = Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
          const deduplicated: ChatMessage[] = [];
          for (const item of allItems) {
            if (item.id.includes('_sync') || item.id.includes('_sel')) {
              const hasOfficial = allItems.some(
                (other) =>
                  !other.id.includes('_sync') &&
                  !other.id.includes('_sel') &&
                  other.text === item.text &&
                  Math.abs(other.createdAt - item.createdAt) < 5000
              );
              if (hasOfficial) {
                continue;
              }
            }
            deduplicated.push(item);
          }

          const merged = deduplicated;
          if (merged.length === 0) return prevMap;

          // Trigger sound if genuinely new message from user arrived
          if (lastMessageCountRef.current > 0 && merged.length > lastMessageCountRef.current) {
            const latest = merged[merged.length - 1];
            if (latest.sender === 'user') {
              onNewMessageSound?.();
            }
          }
          lastMessageCountRef.current = merged.length;

          // Sync with sidebar lastMessage
          if (merged.length > 0) {
            const latestChat = merged[merged.length - 1];
            onMessageSyncedToUser?.(
              userId,
              latestChat.text,
              latestChat.createdAt,
              latestChat.sender
            );
          }

          storage.setCachedMessages(userId, merged);

          return {
            ...prevMap,
            [userId]: merged,
          };
        });
      } catch (err) {
        console.error('[useChatMessages] Failed to fetch messages:', err);
      }
    },
    [onNewMessageSound, onMessageSyncedToUser]
  );

  // Sync synthetic message directly from user profile updates (e.g. from sidebar poll)
  const syncIncomingUserMessage = useCallback(
    (userId: string, text: string, timestamp: number) => {
      if (!userId || !text || !timestamp) return;

      setMessagesByUserId((prevMap) => {
        const list = prevMap[userId] || [];
        const exists = list.some(
          (m) =>
            (m.text === text && Math.abs(m.createdAt - timestamp) < 5000) ||
            m.createdAt === timestamp
        );
        if (!exists) {
          const synMsg: ChatMessage = {
            id: `msg_${timestamp}_sync`,
            userId,
            sender: 'user',
            text,
            createdAt: timestamp,
            status: 'sent',
          };
          const updated = [...list, synMsg].sort((a, b) => a.createdAt - b.createdAt);
          storage.setCachedMessages(userId, updated);
          return {
            ...prevMap,
            [userId]: updated,
          };
        }
        return prevMap;
      });
    },
    []
  );

  // Restore messages when selected user changes
  useEffect(() => {
    if (!selectedUserId) return;

    const cached = storage.getCachedMessages(selectedUserId);
    if (cached.length > 0) {
      setMessagesByUserId((prevMap) => {
        const inMem = prevMap[selectedUserId] || [];
        if (inMem.length >= cached.length && inMem.length > 0) {
          return prevMap;
        }
        return {
          ...prevMap,
          [selectedUserId]: cached,
        };
      });
      lastMessageCountRef.current = cached.length;
    }

    fetchMessagesForUser(selectedUserId);

    const interval = setInterval(() => {
      if (selectedUserIdRef.current) {
        fetchMessagesForUser(selectedUserIdRef.current, true);
      }
    }, pollingIntervalMs);

    return () => clearInterval(interval);
  }, [selectedUserId, fetchMessagesForUser, pollingIntervalMs]);

  // Send message with optimistic update
  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      const targetUserId = selectedUserIdRef.current;
      if (!trimmed || !targetUserId || isSending) return false;

      setIsSending(true);
      const tempId = `temp_${Date.now()}`;
      const now = Date.now();
      const optimisticMessage: ChatMessage = {
        id: tempId,
        userId: targetUserId,
        sender: 'agent',
        text: trimmed,
        createdAt: now,
        status: 'sending',
      };

      setMessagesByUserId((prevMap) => ({
        ...prevMap,
        [targetUserId]: [...(prevMap[targetUserId] || []), optimisticMessage],
      }));

      // Immediately sync with sidebar
      onMessageSyncedToUser?.(targetUserId, trimmed, now, 'agent');

      try {
        const serverMsg = await chatService.sendMessage(targetUserId, trimmed);
        const serverCreatedAt = serverMsg?.createdAt || now;

        setMessagesByUserId((prevMap) => {
          const userMsgs = prevMap[targetUserId] || [];
          const updated = userMsgs.map((m) =>
            m.id === tempId ? serverMsg || { ...m, status: 'sent' } : m
          );
          storage.setCachedMessages(targetUserId, updated);
          return {
            ...prevMap,
            [targetUserId]: updated,
          };
        });

        onMessageSyncedToUser?.(targetUserId, trimmed, serverCreatedAt, 'agent');
        return true;
      } catch (err: any) {
        console.error('[useChatMessages] Send message error:', err);
        setMessagesByUserId((prevMap) => {
          const userMsgs = prevMap[targetUserId] || [];
          return {
            ...prevMap,
            [targetUserId]: userMsgs.map((m) =>
              m.id === tempId ? { ...m, status: 'error' } : m
            ),
          };
        });
        alert(`เกิดข้อผิดพลาดในการส่งข้อความ: ${err?.message || 'Server error'}`);
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [isSending, onMessageSyncedToUser]
  );

  // Send image message with file upload and optimistic update
  const sendImageMessage = useCallback(
    async (file: File, caption?: string): Promise<boolean> => {
      const targetUserId = selectedUserIdRef.current;
      if (!file || !targetUserId || isSending) return false;

      setIsSending(true);
      const tempId = `temp_img_${Date.now()}`;
      const now = Date.now();
      const localPreviewUrl = URL.createObjectURL(file);
      const trimmedCaption = (caption || '').trim();
      const displayText = trimmedCaption || '📷 [รูปภาพ]';

      const optimisticMessage: ChatMessage = {
        id: tempId,
        userId: targetUserId,
        sender: 'agent',
        text: displayText,
        imageUrl: localPreviewUrl,
        messageType: 'image',
        createdAt: now,
        status: 'sending',
      };

      setMessagesByUserId((prevMap) => ({
        ...prevMap,
        [targetUserId]: [...(prevMap[targetUserId] || []), optimisticMessage],
      }));

      onMessageSyncedToUser?.(targetUserId, displayText, now, 'agent');

      try {
        // 1. Upload image file to server
        const uploadResult = await chatService.uploadImage(file);
        const serverImageUrl = uploadResult.url;

        // 2. Send image message via messages API
        const serverMsg = await chatService.sendMessage(
          targetUserId,
          displayText,
          serverImageUrl,
          'image'
        );
        const serverCreatedAt = serverMsg?.createdAt || now;

        setMessagesByUserId((prevMap) => {
          const userMsgs = prevMap[targetUserId] || [];
          const updated = userMsgs.map((m) =>
            m.id === tempId ? serverMsg || { ...m, status: 'sent', imageUrl: serverImageUrl } : m
          );
          storage.setCachedMessages(targetUserId, updated);
          return {
            ...prevMap,
            [targetUserId]: updated,
          };
        });

        onMessageSyncedToUser?.(targetUserId, displayText, serverCreatedAt, 'agent');
        return true;
      } catch (err: any) {
        console.error('[useChatMessages] Send image error:', err);
        setMessagesByUserId((prevMap) => {
          const userMsgs = prevMap[targetUserId] || [];
          return {
            ...prevMap,
            [targetUserId]: userMsgs.map((m) =>
              m.id === tempId ? { ...m, status: 'error' } : m
            ),
          };
        });
        alert(`เกิดข้อผิดพลาดในการส่งรูปภาพ: ${err?.message || 'Server error'}`);
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [isSending, onMessageSyncedToUser]
  );

  // Clear all messages for a user
  const clearUserMessages = useCallback(async (userId: string): Promise<boolean> => {
    await chatService.clearMessages(userId);
    setMessagesByUserId((prev) => ({
      ...prev,
      [userId]: [],
    }));
    lastMessageCountRef.current = 0;
    storage.removeCachedMessages(userId);
    return true;
  }, []);

  // Remove messages completely when a user is deleted
  const removeUserMessagesLocally = useCallback((userId: string) => {
    setMessagesByUserId((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    storage.removeCachedMessages(userId);
  }, []);

  return {
    messagesByUserId,
    activeMessages,
    isSending,
    sendMessage,
    sendImageMessage,
    clearUserMessages,
    removeUserMessagesLocally,
    fetchMessagesForUser,
    syncIncomingUserMessage,
  };
}
