'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { LineUser, ChatMessage } from '@/lib/types';
import { userService } from '@/services/userService';
import { storage } from '@/lib/storage';

interface UseWebChatUsersOptions {
  pollingIntervalMs?: number;
  onNewUserMessageDetected?: (incoming: LineUser[]) => void;
}

export function useWebChatUsers(options: UseWebChatUsersOptions = {}) {
  const { pollingIntervalMs = 2500, onNewUserMessageDetected } = options;

  const [users, setUsers] = useState<LineUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<LineUser | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const selectedUserId = selectedUser?.userId;
  const selectedUserIdRef = useRef<string | undefined>(selectedUserId);
  const lastReadTimestampRef = useRef<Record<string, number>>({});

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  // Merge incoming users safely preserving display names and monotonic timestamps
  const mergeUsers = useCallback((incoming: LineUser[]) => {
    setUsers((prev) => {
      const map = new Map<string, LineUser>();
      prev.forEach((u) => map.set(u.userId, u));
      const activeId = selectedUserIdRef.current;

      incoming.forEach((u) => {
        const existing = map.get(u.userId);

        // Never overwrite a real display name with generic 'LINE User'
        const bestDisplayName =
          u.displayName && u.displayName !== 'LINE User'
            ? u.displayName
            : existing?.displayName && existing.displayName !== 'LINE User'
            ? existing.displayName
            : u.displayName || 'LINE User';

        const bestPictureUrl = u.pictureUrl || existing?.pictureUrl;
        const bestStatusMessage = u.statusMessage || existing?.statusMessage;

        let bestLastMessage =
          existing?.lastMessage && existing.lastMessage.trim()
            ? existing.lastMessage
            : u.lastMessage || '';
        let bestLastMessageAt = existing?.lastMessageAt || u.lastMessageAt;

        if ((u.lastMessageAt || 0) >= (existing?.lastMessageAt || 0)) {
          if (u.lastMessage && u.lastMessage.trim()) {
            bestLastMessage = u.lastMessage;
          }
          bestLastMessageAt = u.lastMessageAt;
        }

        // Fallback to active chat messages if bestLastMessage is still empty
        if (!bestLastMessage || !bestLastMessage.trim()) {
          const cachedMsgs = storage.getCachedMessages(u.userId);
          if (cachedMsgs.length > 0) {
            const lastChat = cachedMsgs[cachedMsgs.length - 1];
            if (lastChat.text) {
              bestLastMessage = lastChat.text;
              bestLastMessageAt = Math.max(bestLastMessageAt || 0, lastChat.createdAt);
            }
          }
        }

        // Unread count tracking
        const isCurrentActive = activeId === u.userId;
        const userLastReadAt = lastReadTimestampRef.current[u.userId] || 0;
        const msgTimestamp = bestLastMessageAt || u.lastMessageAt || 0;

        let isLastFromAgent = u.lastSender === 'agent' || existing?.lastSender === 'agent';
        if (!isLastFromAgent) {
          const cachedMsgs = storage.getCachedMessages(u.userId);
          if (cachedMsgs.length > 0) {
            const lastChat = cachedMsgs[cachedMsgs.length - 1];
            if (lastChat.sender === 'agent' && lastChat.createdAt >= (bestLastMessageAt || 0) - 5000) {
              isLastFromAgent = true;
            } else if (lastChat.sender === 'user') {
              isLastFromAgent = false;
            }
          }
        }

        let bestUnreadCount = 0;
        if (isCurrentActive || isLastFromAgent) {
          bestUnreadCount = 0;
          lastReadTimestampRef.current[u.userId] = Math.max(userLastReadAt, msgTimestamp, Date.now() + 10000);
          storage.setLastReadTimestamp(u.userId, lastReadTimestampRef.current[u.userId]);
        } else if (msgTimestamp > userLastReadAt) {
          if (existing && msgTimestamp > (existing.lastMessageAt || 0)) {
            bestUnreadCount = Math.max(u.unreadCount || 1, (existing.unreadCount || 0) + 1);
          } else {
            bestUnreadCount =
              u.unreadCount !== undefined && u.unreadCount > 0
                ? u.unreadCount
                : existing?.unreadCount || 1;
          }
        } else {
          bestUnreadCount = 0;
        }

        map.set(u.userId, {
          ...existing,
          ...u,
          displayName: bestDisplayName,
          pictureUrl: bestPictureUrl,
          statusMessage: bestStatusMessage,
          lastMessage: bestLastMessage,
          lastMessageAt: bestLastMessageAt,
          unreadCount: bestUnreadCount,
          lastSender: (isLastFromAgent ? 'agent' : (u.lastSender || existing?.lastSender || 'user')) as ('user' | 'agent'),
        });
      });

      const merged = Array.from(map.values()).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      storage.setCachedUsers(merged);
      return merged;
    });

    // Dynamically sync selectedUser if profile or name was upgraded
    setSelectedUser((curr) => {
      if (!curr) return null;
      const match = incoming.find((u) => u.userId === curr.userId);
      if (match) {
        const updatedName =
          match.displayName && match.displayName !== 'LINE User'
            ? match.displayName
            : curr.displayName;
        const updatedPic = match.pictureUrl || curr.pictureUrl;
        const updatedStatus = match.statusMessage || curr.statusMessage;

        if (
          updatedName !== curr.displayName ||
          updatedPic !== curr.pictureUrl ||
          updatedStatus !== curr.statusMessage ||
          match.lastMessageAt !== curr.lastMessageAt
        ) {
          return {
            ...curr,
            displayName: updatedName,
            pictureUrl: updatedPic,
            statusMessage: updatedStatus,
            lastMessage: match.lastMessage,
            lastMessageAt: match.lastMessageAt,
          };
        }
      }
      return curr;
    });
  }, []);

  // Fetch users from server
  const fetchUsers = useCallback(
    async (silent = false) => {
      if (!silent) setIsRefreshing(true);
      try {
        const incoming = await userService.fetchUsers();
        if (incoming.length > 0) {
          mergeUsers(incoming);
          onNewUserMessageDetected?.(incoming);
        }
      } catch (err) {
        console.error('[useWebChatUsers] Failed to fetch users:', err);
      } finally {
        if (!silent) setIsRefreshing(false);
      }
    },
    [mergeUsers, onNewUserMessageDetected]
  );

  // Initial load from storage cache & kick off polling
  useEffect(() => {
    lastReadTimestampRef.current = storage.getLastReadMap();
    const cachedUsers = storage.getCachedUsers();
    if (cachedUsers.length > 0) {
      setUsers(cachedUsers);
      setSelectedUser((curr) => curr || cachedUsers[0]);
    }

    fetchUsers();

    const interval = setInterval(() => {
      fetchUsers(true);
    }, pollingIntervalMs);

    return () => clearInterval(interval);
  }, [fetchUsers, pollingIntervalMs]);

  // Select user and mark as read
  const selectUser = useCallback((user: LineUser) => {
    setSelectedUser(user);
    selectedUserIdRef.current = user.userId;

    const now = Date.now();
    lastReadTimestampRef.current[user.userId] = Math.max(
      lastReadTimestampRef.current[user.userId] || 0,
      user.lastMessageAt || 0,
      now
    );
    storage.setLastReadTimestamp(user.userId, lastReadTimestampRef.current[user.userId]);

    setUsers((prev) => {
      const updated = prev.map((u) => (u.userId === user.userId ? { ...u, unreadCount: 0 } : u));
      storage.setCachedUsers(updated);
      return updated;
    });

    userService.markUserAsRead(user.userId);
  }, []);

  // Update a user's latest message in memory & cache
  const updateUserLastMessage = useCallback(
    (userId: string, text: string, timestamp: number, sender: 'user' | 'agent' = 'agent') => {
      const isAgent = sender === 'agent';
      if (isAgent) {
        lastReadTimestampRef.current[userId] = timestamp + 15000;
        storage.setLastReadTimestamp(userId, lastReadTimestampRef.current[userId]);
      }

      setUsers((prev) => {
        const updated = prev
          .map((u) =>
            u.userId === userId
              ? {
                  ...u,
                  lastMessage: text,
                  lastMessageAt: timestamp,
                  unreadCount: isAgent ? 0 : u.unreadCount,
                  lastSender: sender,
                }
              : u
          )
          .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        storage.setCachedUsers(updated);
        return updated;
      });

      setSelectedUser((prev) =>
        prev && prev.userId === userId
          ? {
              ...prev,
              lastMessage: text,
              lastMessageAt: timestamp,
              unreadCount: isAgent ? 0 : prev.unreadCount,
              lastSender: sender,
            }
          : prev
      );
    },
    []
  );

  // Clear a user's last message
  const resetUserLastMessage = useCallback((userId: string) => {
    setUsers((prev) => {
      const updated = prev.map((u) =>
        u.userId === userId ? { ...u, lastMessage: '', unreadCount: 0 } : u
      );
      storage.setCachedUsers(updated);
      return updated;
    });

    setSelectedUser((prev) =>
      prev && prev.userId === userId ? { ...prev, lastMessage: '', unreadCount: 0 } : prev
    );
  }, []);

  // Delete user conversation
  const deleteUserConversation = useCallback(
    async (userId: string) => {
      await userService.deleteUser(userId);

      let remaining: LineUser[] = [];
      setUsers((prev) => {
        remaining = prev.filter((u) => u.userId !== userId);
        storage.setCachedUsers(remaining);
        return remaining;
      });

      setSelectedUser((prev) => {
        if (prev?.userId === userId) {
          return remaining.length > 0 ? remaining[0] : null;
        }
        return prev;
      });

      return true;
    },
    []
  );

  return {
    users,
    setUsers,
    selectedUser,
    setSelectedUser,
    selectedUserId,
    isRefreshing,
    fetchUsers,
    selectUser,
    updateUserLastMessage,
    resetUserLastMessage,
    deleteUserConversation,
  };
}
