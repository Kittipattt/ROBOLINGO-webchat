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

/**
 * Robust helper to deduplicate messages and prevent optimistic temp messages
 * from showing alongside the real server messages.
 */
function deduplicateMessages(messages: ChatMessage[]): ChatMessage[] {
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
  const result: ChatMessage[] = [];
  const seenIds = new Set<string>();

  for (const item of sorted) {
    // Drop true ID duplicates
    if (seenIds.has(item.id)) continue;

    // If this is a temporary or synthetic message, check if an official server message already exists
    const isTemporary =
      item.id.startsWith('temp_') || item.id.includes('_sync') || item.id.includes('_sel');

    if (isTemporary) {
      const hasOfficial = sorted.some(
        (other) =>
          !other.id.startsWith('temp_') &&
          !other.id.includes('_sync') &&
          !other.id.includes('_sel') &&
          (
            // Matching sender and content
            (other.sender === item.sender &&
              ((item.messageType === 'sticker' &&
                other.messageType === 'sticker' &&
                item.stickerId === other.stickerId) ||
                (item.messageType === 'image' && other.messageType === 'image') ||
                other.text === item.text)) ||
            // Or exact text match within 20s (prevents synthetic message from overriding real agent message)
            (item.text && other.text === item.text)
          ) &&
          Math.abs(other.createdAt - item.createdAt) < 20000
      );

      if (hasOfficial) {
        // Official server message is already present, drop this temporary/synthetic duplicate!
        continue;
      }
    }

    seenIds.add(item.id);
    result.push(item);
  }

  return result;
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
  const isSendingRef = useRef(false);

  const selectedUserIdRef = useRef<string | undefined>(selectedUserId);
  const lastMessageCountRef = useRef<number>(0);

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  // Messages strictly filtered for currently selected user with deduplication
  const activeMessages = useMemo(() => {
    if (!selectedUserId) return [];
    const raw = (messagesByUserId[selectedUserId] || []).filter((m) => m.userId === selectedUserId);
    return deduplicateMessages(raw);
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

          // Retain only currently pending optimistic messages that haven't arrived on server yet
          const pendingOptimistic = prevForUser.filter(
            (m) => m.id.startsWith('temp_') && m.status === 'sending'
          );

          // Merge incoming official messages with any still-sending optimistic messages
          const combined = [...incoming, ...pendingOptimistic];
          const merged = deduplicateMessages(combined);

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
    (userId: string, text: string, timestamp: number, sender: 'user' | 'agent' = 'user') => {
      if (!userId || !text || !timestamp) return;
      // Never synthesize an agent message as a customer message
      if (sender === 'agent') return;

      setMessagesByUserId((prevMap) => {
        const list = prevMap[userId] || [];
        const exists = list.some(
          (m) =>
            (m.text === text && Math.abs(m.createdAt - timestamp) < 15000) ||
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
          const updated = deduplicateMessages([...list, synMsg]);
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
      if (!trimmed || !targetUserId || isSendingRef.current || isSending) return false;

      isSendingRef.current = true;
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
          const hasServerMsg = serverMsg && userMsgs.some((m) => m.id === serverMsg.id);

          let updated: ChatMessage[];
          if (hasServerMsg) {
            updated = userMsgs.filter((m) => m.id !== tempId);
          } else {
            updated = userMsgs.map((m) =>
              m.id === tempId ? serverMsg || { ...m, status: 'sent' } : m
            );
          }

          const finalUpdated = deduplicateMessages(updated);
          storage.setCachedMessages(targetUserId, finalUpdated);
          return {
            ...prevMap,
            [targetUserId]: finalUpdated,
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
        isSendingRef.current = false;
        setIsSending(false);
      }
    },
    [isSending, onMessageSyncedToUser]
  );

  // Send image message with file upload and optimistic update
  const sendImageMessage = useCallback(
    async (file: File, caption?: string): Promise<boolean> => {
      const targetUserId = selectedUserIdRef.current;
      if (!file || !targetUserId || isSendingRef.current || isSending) return false;

      isSendingRef.current = true;
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
          const hasServerMsg = serverMsg && userMsgs.some((m) => m.id === serverMsg.id);

          let updated: ChatMessage[];
          if (hasServerMsg) {
            updated = userMsgs.filter((m) => m.id !== tempId);
          } else {
            updated = userMsgs.map((m) =>
              m.id === tempId
                ? serverMsg || { ...m, status: 'sent', imageUrl: serverImageUrl }
                : m
            );
          }

          const finalUpdated = deduplicateMessages(updated);
          storage.setCachedMessages(targetUserId, finalUpdated);
          return {
            ...prevMap,
            [targetUserId]: finalUpdated,
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
        isSendingRef.current = false;
        setIsSending(false);
      }
    },
    [isSending, onMessageSyncedToUser]
  );

  // Send sticker message with optimistic update
  const sendStickerMessage = useCallback(
    async (packageId: string, stickerId: string): Promise<boolean> => {
      const targetUserId = selectedUserIdRef.current;
      if (!packageId || !stickerId || !targetUserId || isSendingRef.current || isSending) return false;

      isSendingRef.current = true;
      setIsSending(true);
      const tempId = `temp_stk_${Date.now()}`;
      const now = Date.now();
      const stickerUrl = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`;
      const displayText = '🏷️ [สติกเกอร์]';

      const optimisticMessage: ChatMessage = {
        id: tempId,
        userId: targetUserId,
        sender: 'agent',
        text: displayText,
        stickerUrl,
        packageId: String(packageId),
        stickerId: String(stickerId),
        messageType: 'sticker',
        createdAt: now,
        status: 'sending',
      };

      setMessagesByUserId((prevMap) => ({
        ...prevMap,
        [targetUserId]: [...(prevMap[targetUserId] || []), optimisticMessage],
      }));

      onMessageSyncedToUser?.(targetUserId, displayText, now, 'agent');

      try {
        const serverMsg = await chatService.sendMessage(
          targetUserId,
          displayText,
          undefined,
          'sticker',
          { packageId: String(packageId), stickerId: String(stickerId), stickerUrl }
        );
        const serverCreatedAt = serverMsg?.createdAt || now;

        setMessagesByUserId((prevMap) => {
          const userMsgs = prevMap[targetUserId] || [];
          const hasServerMsg = serverMsg && userMsgs.some((m) => m.id === serverMsg.id);

          let updated: ChatMessage[];
          if (hasServerMsg) {
            updated = userMsgs.filter((m) => m.id !== tempId);
          } else {
            updated = userMsgs.map((m) =>
              m.id === tempId ? serverMsg || { ...m, status: 'sent', stickerUrl } : m
            );
          }

          const finalUpdated = deduplicateMessages(updated);
          storage.setCachedMessages(targetUserId, finalUpdated);
          return {
            ...prevMap,
            [targetUserId]: finalUpdated,
          };
        });

        onMessageSyncedToUser?.(targetUserId, displayText, serverCreatedAt, 'agent');
        return true;
      } catch (err: any) {
        console.error('[useChatMessages] Send sticker error:', err);
        setMessagesByUserId((prevMap) => {
          const userMsgs = prevMap[targetUserId] || [];
          return {
            ...prevMap,
            [targetUserId]: userMsgs.map((m) =>
              m.id === tempId ? { ...m, status: 'error' } : m
            ),
          };
        });
        alert(`เกิดข้อผิดพลาดในการส่งสติกเกอร์: ${err?.message || 'Server error'}`);
        return false;
      } finally {
        isSendingRef.current = false;
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

  // Optimistically set active messages directly when selecting user
  const setActiveMessagesOptimistically = useCallback(
    (userId: string, initialMessage?: { text: string; timestamp: number; sender?: 'user' | 'agent' }) => {
      if (!userId) return;

      setMessagesByUserId((prev) => {
        const existing = prev[userId] || [];
        if (existing.length > 0) return prev;

        const cached = storage.getCachedMessages(userId);
        if (cached.length > 0) {
          return {
            ...prev,
            [userId]: cached,
          };
        }

        if (initialMessage && initialMessage.text) {
          const initialChat: ChatMessage = {
            id: `msg_${initialMessage.timestamp}_sel`,
            userId,
            sender: initialMessage.sender || 'user',
            text: initialMessage.text,
            createdAt: initialMessage.timestamp,
            status: 'sent',
          };
          return {
            ...prev,
            [userId]: [initialChat],
          };
        }

        return prev;
      });
    },
    []
  );

  return {
    activeMessages,
    messages: activeMessages,
    isSending,
    sendMessage,
    sendImageMessage,
    sendStickerMessage,
    clearUserMessages,
    removeUserMessagesLocally,
    fetchMessagesForUser,
    syncIncomingUserMessage,
    setActiveMessagesOptimistically,
  };
}
