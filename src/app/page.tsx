'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LineUser, ChatMessage } from '@/lib/types';
import { TopNavbar } from '@/components/TopNavbar';
import { Sidebar } from '@/components/Sidebar';
import { ChatCanvas } from '@/components/ChatCanvas';
import { CustomerDetailDrawer } from '@/components/CustomerDetailDrawer';
import { QrCodeModal } from '@/components/QrCodeModal';

export default function WebChatPage() {
  const [users, setUsers] = useState<LineUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<LineUser | null>(null);
  const [messagesByUserId, setMessagesByUserId] = useState<Record<string, ChatMessage[]>>({});
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'replied'>('all');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageCountRef = useRef<number>(0);

  const selectedUserId = selectedUser?.userId;
  const selectedUserIdRef = useRef<string | undefined>(selectedUserId);
  const lastReadTimestampRef = useRef<Record<string, number>>({});

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  // Active messages strictly filtered for the selected user
  const activeMessages = useMemo(() => {
    if (!selectedUserId) return [];
    return (messagesByUserId[selectedUserId] || []).filter((m) => m.userId === selectedUserId);
  }, [selectedUserId, messagesByUserId]);

  // Keyboard shortcut (Cmd+K / Ctrl+K) to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Web Audio notification sound
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio context may be restricted before interaction
    }
  }, [soundEnabled]);

  // Fetch users with non-destructive state merging
  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/users?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
      if (res.ok) {
        const data = await res.json();
        const incoming: LineUser[] = data.users || [];

        if (incoming.length > 0) {
          setUsers((prev) => {
            const map = new Map<string, LineUser>();
            prev.forEach((u) => map.set(u.userId, u));
            const activeId = selectedUserIdRef.current;

            incoming.forEach((u) => {
              const existing = map.get(u.userId);

              // Never overwrite a real display name with 'LINE User'
              const bestDisplayName =
                u.displayName && u.displayName !== 'LINE User'
                  ? u.displayName
                  : existing?.displayName && existing.displayName !== 'LINE User'
                  ? existing.displayName
                  : u.displayName || 'LINE User';

              const bestPictureUrl = u.pictureUrl || existing?.pictureUrl;
              const bestStatusMessage = u.statusMessage || existing?.statusMessage;

              // Monotonic timestamp protection: never allow an older poll to overwrite a newer message
              // and never allow an empty/whitespace lastMessage from API to overwrite an existing non-empty message
              let bestLastMessage = (existing?.lastMessage && existing.lastMessage.trim())
                ? existing.lastMessage
                : (u.lastMessage || '');
              let bestLastMessageAt = existing?.lastMessageAt || u.lastMessageAt;

              if ((u.lastMessageAt || 0) >= (existing?.lastMessageAt || 0)) {
                if (u.lastMessage && u.lastMessage.trim()) {
                  bestLastMessage = u.lastMessage;
                }
                bestLastMessageAt = u.lastMessageAt;
              }

              // Fallback to active chat messages if bestLastMessage is still empty
              if (!bestLastMessage || !bestLastMessage.trim()) {
                try {
                  const raw = localStorage.getItem(`webchat_msgs_${u.userId}`);
                  if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      const lastChat = parsed[parsed.length - 1];
                      if (lastChat.text) {
                        bestLastMessage = lastChat.text;
                        bestLastMessageAt = Math.max(bestLastMessageAt || 0, lastChat.createdAt);
                      }
                    }
                  }
                } catch {}
              }

              // Unread count tracking:
              // 1. If user is currently active/open, keep unreadCount at 0.
              // 2. If message timestamp <= lastReadTimestamp, user has already read it -> unreadCount = 0.
              // 3. Only if a genuinely newer message arrived (msgTimestamp > lastReadTimestamp) and user is NOT active, mark unread.
              const isCurrentActive = activeId === u.userId;
              const userLastReadAt = lastReadTimestampRef.current[u.userId] || 0;
              const msgTimestamp = bestLastMessageAt || u.lastMessageAt || 0;

              let bestUnreadCount = 0;
              if (isCurrentActive) {
                bestUnreadCount = 0;
                lastReadTimestampRef.current[u.userId] = Math.max(userLastReadAt, msgTimestamp, Date.now());
                try {
                  localStorage.setItem('webchat_last_read_map', JSON.stringify(lastReadTimestampRef.current));
                } catch {}
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
              });
            });
            const merged = Array.from(map.values()).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
            try {
              localStorage.setItem('webchat_users_cache', JSON.stringify(merged));
            } catch {}
            return merged;
          });

          // Sync any new incoming lastMessage directly into chat messages so UI never lags behind sidebar
          incoming.forEach((u) => {
            if (u.lastMessage && u.lastMessageAt) {
              setMessagesByUserId((prevMap) => {
                const list = prevMap[u.userId] || [];
                const exists = list.some(
                  (m) =>
                    (m.text === u.lastMessage && Math.abs(m.createdAt - (u.lastMessageAt || 0)) < 5000) ||
                    m.createdAt === u.lastMessageAt
                );
                if (!exists) {
                  const synMsg: ChatMessage = {
                    id: `msg_${u.lastMessageAt}_sync`,
                    userId: u.userId,
                    sender: 'user',
                    text: u.lastMessage!,
                    createdAt: u.lastMessageAt!,
                    status: 'sent',
                  };
                  const updated = [...list, synMsg].sort((a, b) => a.createdAt - b.createdAt);
                  try {
                    localStorage.setItem(`webchat_msgs_${u.userId}`, JSON.stringify(updated));
                  } catch {}
                  return {
                    ...prevMap,
                    [u.userId]: updated,
                  };
                }
                return prevMap;
              });
            }
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
        }
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  // Fetch messages strictly scoped to userId
  const fetchMessages = useCallback(
    async (userId: string, silent = false) => {
      try {
        const res = await fetch(`/api/messages?userId=${encodeURIComponent(userId)}&_t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        });
        if (res.ok) {
          const data = await res.json();
          const incoming: ChatMessage[] = (data.messages || []).filter(
            (m: ChatMessage) => m.userId === userId
          );

          setMessagesByUserId((prevMap) => {
            const prevForUser = (prevMap[userId] || []).filter(
              (m: ChatMessage) => m.userId === userId
            );

            // Read from localStorage to ensure historical messages are never wiped
            let cachedForUser: ChatMessage[] = [];
            try {
              const raw = localStorage.getItem(`webchat_msgs_${userId}`);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  cachedForUser = parsed.filter((m: ChatMessage) => m.userId === userId);
                }
              }
            } catch {}

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
                  continue; // Official record present, drop synthetic placeholder
                }
              }
              deduplicated.push(item);
            }

            const merged = deduplicated;

            if (merged.length === 0) {
              return prevMap;
            }

            if (
              lastMessageCountRef.current > 0 &&
              merged.length > lastMessageCountRef.current
            ) {
              const latest = merged[merged.length - 1];
              if (latest.sender === 'user') {
                playNotificationSound();
              }
            }
            lastMessageCountRef.current = merged.length;

            // Keep sidebar's lastMessage in sync with the true newest message in chat
            if (merged.length > 0) {
              const latestChat = merged[merged.length - 1];
              setUsers((prevUsers) => {
                const target = prevUsers.find((u) => u.userId === userId);
                if (
                  target &&
                  (latestChat.createdAt >= (target.lastMessageAt || 0) ||
                    !target.lastMessage ||
                    !target.lastMessage.trim())
                ) {
                  const updated = prevUsers
                    .map((u) =>
                      u.userId === userId
                        ? {
                            ...u,
                            lastMessage: latestChat.text,
                            lastMessageAt: Math.max(u.lastMessageAt || 0, latestChat.createdAt),
                          }
                        : u
                    )
                    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
                  try {
                    localStorage.setItem('webchat_users_cache', JSON.stringify(updated));
                  } catch {}
                  return updated;
                }
                return prevUsers;
              });
            }

            try {
              localStorage.setItem(`webchat_msgs_${userId}`, JSON.stringify(merged));
            } catch {}

            return {
              ...prevMap,
              [userId]: merged,
            };
          });
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    },
    [playNotificationSound]
  );

  // Initial load and restoration from local storage
  useEffect(() => {
    try {
      const savedReadMap = localStorage.getItem('webchat_last_read_map');
      if (savedReadMap) {
        lastReadTimestampRef.current = JSON.parse(savedReadMap);
      }

      const cachedUsers = localStorage.getItem('webchat_users_cache');
      if (cachedUsers) {
        const parsed = JSON.parse(cachedUsers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUsers(parsed);
          setSelectedUser((curr) => curr || parsed[0]);

          const initialId = parsed[0].userId;
          selectedUserIdRef.current = initialId;
          const cachedMsgs = localStorage.getItem(`webchat_msgs_${initialId}`);
          if (cachedMsgs) {
            const parsedMsgs = JSON.parse(cachedMsgs);
            if (Array.isArray(parsedMsgs)) {
              const cleaned = parsedMsgs.filter((m: ChatMessage) => m.userId === initialId);
              setMessagesByUserId({ [initialId]: cleaned });
              localStorage.setItem(`webchat_msgs_${initialId}`, JSON.stringify(cleaned));
            }
          }
        }
      }
    } catch {}

    fetchUsers();

    const interval = setInterval(() => {
      fetchUsers(true);
      if (selectedUserIdRef.current) {
        fetchMessages(selectedUserIdRef.current, true);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [fetchUsers, fetchMessages]);

  // When selected user changes, restore cached messages for that user and fetch fresh
  useEffect(() => {
    if (selectedUserId) {
      selectedUserIdRef.current = selectedUserId;
      lastReadTimestampRef.current[selectedUserId] = Date.now();
      try {
        localStorage.setItem('webchat_last_read_map', JSON.stringify(lastReadTimestampRef.current));
      } catch {}

      try {
        const cached = localStorage.getItem(`webchat_msgs_${selectedUserId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter((m: ChatMessage) => m.userId === selectedUserId);
            setMessagesByUserId((prevMap) => {
              const currentInMem = prevMap[selectedUserId] || [];
              if (currentInMem.length >= cleaned.length && currentInMem.length > 0) {
                return prevMap;
              }
              return {
                ...prevMap,
                [selectedUserId]: cleaned,
              };
            });
            lastMessageCountRef.current = cleaned.length;
          }
        }
      } catch {}

      fetchMessages(selectedUserId);

      fetch('/api/users/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
      }).catch(() => {});
    }
  }, [selectedUserId, fetchMessages]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !selectedUser || isSending) return;

    const targetUserId = selectedUser.userId;
    setIsSending(true);
    setInputText('');
    setShowEmojiPicker(false);

    const tempId = `temp_${Date.now()}`;
    const now = Date.now();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      userId: targetUserId,
      sender: 'agent',
      text,
      createdAt: now,
      status: 'sending',
    };

    setMessagesByUserId((prevMap) => ({
      ...prevMap,
      [targetUserId]: [...(prevMap[targetUserId] || []), optimisticMessage],
    }));

    // Record read timestamp for target user
    lastReadTimestampRef.current[targetUserId] = now;
    try {
      localStorage.setItem('webchat_last_read_map', JSON.stringify(lastReadTimestampRef.current));
    } catch {}

    // Immediately update sidebar's last message with outbound message
    setUsers((prevUsers) => {
      const updated = prevUsers
        .map((u) =>
          u.userId === targetUserId
            ? { ...u, lastMessage: text, lastMessageAt: now }
            : u
        )
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      try {
        localStorage.setItem('webchat_users_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId,
          text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessagesByUserId((prevMap) => {
          const userMsgs = prevMap[targetUserId] || [];
          const updated = userMsgs.map((m) =>
            m.id === tempId ? data.message || { ...m, status: 'sent' } : m
          );
          try {
            localStorage.setItem(`webchat_msgs_${targetUserId}`, JSON.stringify(updated));
          } catch {}
          return {
            ...prevMap,
            [targetUserId]: updated,
          };
        });
        fetchUsers(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`เกิดข้อผิดพลาดในการส่งข้อความ: ${errData.error || 'Server error'}`);
        setMessagesByUserId((prevMap) => {
          const userMsgs = prevMap[targetUserId] || [];
          return {
            ...prevMap,
            [targetUserId]: userMsgs.map((m) =>
              m.id === tempId ? { ...m, status: 'error' } : m
            ),
          };
        });
      }
    } catch (err: any) {
      alert(`เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว: ${err?.message}`);
      setMessagesByUserId((prevMap) => {
        const userMsgs = prevMap[targetUserId] || [];
        return {
          ...prevMap,
          [targetUserId]: userMsgs.map((m) =>
            m.id === tempId ? { ...m, status: 'error' } : m
          ),
        };
      });
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const copyUserId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSelectUser = useCallback((user: LineUser) => {
    setSelectedUser(user);
    selectedUserIdRef.current = user.userId;

    const now = Date.now();
    lastReadTimestampRef.current[user.userId] = Math.max(
      lastReadTimestampRef.current[user.userId] || 0,
      user.lastMessageAt || 0,
      now
    );
    try {
      localStorage.setItem('webchat_last_read_map', JSON.stringify(lastReadTimestampRef.current));
    } catch {}

    setUsers((prev) =>
      prev.map((u) => (u.userId === user.userId ? { ...u, unreadCount: 0 } : u))
    );

    // Instantly load cached messages from localStorage so conversation renders without delay
    try {
      const raw = localStorage.getItem(`webchat_msgs_${user.userId}`);
      let localMsgs: ChatMessage[] = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localMsgs = parsed.filter((m: ChatMessage) => m.userId === user.userId);
        }
      }

      // If user has a latest message, ensure it is in localMsgs right now
      if (user.lastMessage && user.lastMessageAt) {
        const exists = localMsgs.some(
          (m) =>
            (m.text === user.lastMessage && Math.abs(m.createdAt - (user.lastMessageAt || 0)) < 5000) ||
            m.createdAt === user.lastMessageAt
        );
        if (!exists) {
          localMsgs.push({
            id: `msg_${user.lastMessageAt}_sel`,
            userId: user.userId,
            sender: 'user',
            text: user.lastMessage,
            createdAt: user.lastMessageAt,
            status: 'sent',
          });
          localMsgs.sort((a, b) => a.createdAt - b.createdAt);
          localStorage.setItem(`webchat_msgs_${user.userId}`, JSON.stringify(localMsgs));
        }
      }

      setMessagesByUserId((prevMap) => ({
        ...prevMap,
        [user.userId]: localMsgs,
      }));
      lastMessageCountRef.current = localMsgs.length;
    } catch {}

    // Immediately trigger fresh message fetch from server
    fetchMessages(user.userId, true);

    try {
      const cached = localStorage.getItem('webchat_users_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const updated = parsed.map((u: LineUser) =>
            u.userId === user.userId ? { ...u, unreadCount: 0 } : u
          );
          localStorage.setItem('webchat_users_cache', JSON.stringify(updated));
        }
      }
    } catch {}

    fetch('/api/users/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.userId }),
    }).catch(() => {});
  }, [fetchMessages]);

  return (
    <div className="app-container">
      <TopNavbar
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        isRefreshing={isRefreshing}
        onRefresh={() => fetchUsers()}
        onOpenQrModal={() => setShowQrModal(true)}
      />

      <div className="workspace-grid">
        <Sidebar
          users={users}
          selectedUser={selectedUser}
          onSelectUser={handleSelectUser}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchInputRef={searchInputRef}
        />

        <ChatCanvas
          selectedUser={selectedUser}
          messages={activeMessages}
          onCopyUserId={copyUserId}
          copiedId={copiedId}
          showDetailDrawer={showDetailDrawer}
          onToggleDetailDrawer={() => setShowDetailDrawer(!showDetailDrawer)}
          inputText={inputText}
          onInputChange={setInputText}
          onSendMessage={handleSendMessage}
          isSending={isSending}
          showEmojiPicker={showEmojiPicker}
          onToggleEmojiPicker={() => setShowEmojiPicker(!showEmojiPicker)}
          onInsertEmoji={(em) => setInputText((prev) => prev + em)}
          messagesEndRef={messagesEndRef}
          textareaRef={textareaRef}
          onOpenQrModal={() => setShowQrModal(true)}
        />

        {selectedUser && showDetailDrawer && (
          <CustomerDetailDrawer
            selectedUser={selectedUser}
            messageCount={activeMessages.length}
            onClose={() => setShowDetailDrawer(false)}
            copiedId={copiedId}
            onCopyUserId={copyUserId}
          />
        )}
      </div>

      <QrCodeModal isOpen={showQrModal} onClose={() => setShowQrModal(false)} />
    </div>
  );
}
