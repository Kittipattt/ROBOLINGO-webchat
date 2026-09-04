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
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        const incoming: LineUser[] = data.users || [];

        if (incoming.length > 0) {
          setUsers((prev) => {
            const map = new Map<string, LineUser>();
            prev.forEach((u) => map.set(u.userId, u));
            incoming.forEach((u) => {
              const existing = map.get(u.userId);
              map.set(u.userId, {
                ...existing,
                ...u,
                unreadCount: existing ? existing.unreadCount : u.unreadCount,
              });
            });
            const merged = Array.from(map.values()).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
            try {
              localStorage.setItem('webchat_users_cache', JSON.stringify(merged));
            } catch {}
            return merged;
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
        const res = await fetch(`/api/messages?userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          const incoming: ChatMessage[] = (data.messages || []).filter(
            (m: ChatMessage) => m.userId === userId
          );

          setMessagesByUserId((prevMap) => {
            const prevForUser = (prevMap[userId] || []).filter(
              (m: ChatMessage) => m.userId === userId
            );

            // If incoming is empty but we already have messages in UI for this user, do not wipe out!
            if (incoming.length === 0 && prevForUser.length > 0) {
              return prevMap;
            }

            const map = new Map<string, ChatMessage>();
            prevForUser.forEach((m) => map.set(m.id, m));
            incoming.forEach((m) => map.set(m.id, m));
            const merged = Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);

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
      const cachedUsers = localStorage.getItem('webchat_users_cache');
      if (cachedUsers) {
        const parsed = JSON.parse(cachedUsers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUsers(parsed);
          setSelectedUser((curr) => curr || parsed[0]);

          // Load & sanitize cached messages for initial user
          const initialId = parsed[0].userId;
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
      if (selectedUser?.userId) {
        fetchMessages(selectedUser.userId, true);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [fetchUsers, fetchMessages, selectedUser?.userId]);

  // When selected user changes, restore cached messages for that user and fetch fresh
  useEffect(() => {
    if (selectedUserId) {
      try {
        const cached = localStorage.getItem(`webchat_msgs_${selectedUserId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            // Filter strictly by selectedUserId to cleanse any previously polluted cache
            const cleaned = parsed.filter((m: ChatMessage) => m.userId === selectedUserId);
            setMessagesByUserId((prevMap) => ({
              ...prevMap,
              [selectedUserId]: cleaned,
            }));
            lastMessageCountRef.current = cleaned.length;
            localStorage.setItem(`webchat_msgs_${selectedUserId}`, JSON.stringify(cleaned));
          }
        }
      } catch {}

      fetchMessages(selectedUserId);

      fetch('/api/users/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
      }).then(() => {
        setUsers((prev) =>
          prev.map((u) => (u.userId === selectedUserId ? { ...u, unreadCount: 0 } : u))
        );
      });
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
    const optimisticMessage: ChatMessage = {
      id: tempId,
      userId: targetUserId,
      sender: 'agent',
      text,
      createdAt: Date.now(),
      status: 'sending',
    };

    setMessagesByUserId((prevMap) => ({
      ...prevMap,
      [targetUserId]: [...(prevMap[targetUserId] || []), optimisticMessage],
    }));

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
          onSelectUser={setSelectedUser}
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
