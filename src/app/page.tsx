'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  User as UserIcon,
  Search,
  Sparkles,
  QrCode,
  ExternalLink,
  CheckCheck,
  Bell,
  BellOff,
  RefreshCw,
  Clock,
  X,
  Copy,
  Check,
  PanelRight,
  Smile,
  ShieldCheck,
  Inbox,
  Sparkle,
} from 'lucide-react';
import { LineUser, ChatMessage } from '@/lib/types';

export default function WebChatPage() {
  const [users, setUsers] = useState<LineUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<LineUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageCountRef = useRef<number>(0);

  // Keyboard shortcut (Cmd+K / Ctrl+K)
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

  // Fetch messages for active user with non-destructive state merging
  const fetchMessages = useCallback(
    async (userId: string, silent = false) => {
      try {
        const res = await fetch(`/api/messages?userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          const incoming: ChatMessage[] = data.messages || [];

          setMessages((prev) => {
            // If incoming is empty but we already have messages in UI, do not wipe out!
            if (incoming.length === 0 && prev.length > 0) {
              return prev;
            }

            const map = new Map<string, ChatMessage>();
            prev.forEach((m) => map.set(m.id, m));
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
            return merged;
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

  const selectedUserId = selectedUser?.userId;

  // When selected user changes, restore cached messages immediately then fetch
  useEffect(() => {
    if (selectedUserId) {
      try {
        const cached = localStorage.getItem(`webchat_msgs_${selectedUserId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            lastMessageCountRef.current = parsed.length;
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

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !selectedUser || isSending) return;

    setIsSending(true);
    setInputText('');
    setShowEmojiPicker(false);

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      userId: selectedUser.userId,
      sender: 'agent',
      text,
      createdAt: Date.now(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.userId,
          text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? data.message || { ...m, status: 'sent' } : m))
        );
        fetchUsers(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`เกิดข้อผิดพลาดในการส่งข้อความ: ${errData.error || 'Server error'}`);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m))
        );
      }
    } catch (err: any) {
      alert(`เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว: ${err?.message}`);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m))
      );
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const quickReplies = [
    'สวัสดีครับ ยินดีต้อนรับสู่ ROBO LINGO ครับ ✨',
    'ยินดีให้บริการครับ มีอะไรให้ช่วยเหลือเพิ่มเติมไหมครับ?',
    'ทางทีมงานกำลังตรวจสอบข้อมูลให้นะครับ สักครู่ครับ ⏳',
    'ขอบคุณที่ติดต่อเราครับ หากมีข้อสงสัยสอบถามได้ตลอดเวลาครับ 🙏',
  ];

  const emojis = ['😊', '🙏', '👍', '❤️', '🔥', '✨', '👏', '🎉', '⏳', '💡'];

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        u.displayName.toLowerCase().includes(q) ||
        u.lastMessage.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (activeTab === 'unread') {
        return u.unreadCount > 0;
      }
      if (activeTab === 'replied') {
        return u.unreadCount === 0;
      }
      return true;
    });
  }, [users, searchQuery, activeTab]);

  const copyUserId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const copyMessage = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <header className="top-navbar">
        <div className="brand-section">
          <div className="brand-icon">
            <MessageSquare size={22} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="brand-title">ROBO LINGO</span>
              <span className="brand-badge">Live Chat Console</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-muted)' }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--line-green)',
                  boxShadow: '0 0 8px var(--line-green)',
                }}
              />
              <span>LINE OA Official:</span>
              <strong style={{ color: 'var(--line-green)' }}>@194rgooz</strong>
              <span style={{ color: 'var(--border-medium)' }}>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#10B981' }}>
                <ShieldCheck size={13} />
                <span>API Connected</span>
              </span>
            </div>
          </div>
        </div>

        {/* Global Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* QR Code / Add LINE button */}
          <button
            className="shimmer-green-btn"
            onClick={() => setShowQrModal(true)}
            title="สแกน QR Code เพื่อเชื่อมต่อ LINE OA"
          >
            <QrCode size={16} />
            <span>QR Code บัญชี LINE</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              background: soundEnabled ? 'rgba(6, 199, 85, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${soundEnabled ? 'rgba(6, 199, 85, 0.3)' : 'var(--border-subtle)'}`,
              color: soundEnabled ? 'var(--line-green)' : 'var(--text-muted)',
              padding: '9px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s',
            }}
            title={soundEnabled ? 'เปิดเสียงแจ้งเตือนแล้ว' : 'ปิดเสียงแจ้งเตือน'}
          >
            {soundEnabled ? <Bell size={16} /> : <BellOff size={16} />}
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchUsers()}
            disabled={isRefreshing}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '9px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main 3-Column Workspace */}
      <div className="workspace-grid">
        {/* COLUMN 1: Conversations Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>การสนทนา</h2>
                <span className="badge-pill badge-emerald">
                  {users.length} คน
                </span>
              </div>

              {users.some((u) => u.unreadCount > 0) && (
                <span className="badge-unread-count">
                  {users.reduce((acc, curr) => acc + curr.unreadCount, 0)}
                </span>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="filter-tabs">
              <button
                className={`filter-tab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                ทั้งหมด
              </button>
              <button
                className={`filter-tab ${activeTab === 'unread' ? 'active' : ''}`}
                onClick={() => setActiveTab('unread')}
              >
                ยังไม่อ่าน
                {users.filter((u) => u.unreadCount > 0).length > 0 && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--accent-rose)',
                    }}
                  />
                )}
              </button>
              <button
                className={`filter-tab ${activeTab === 'replied' ? 'active' : ''}`}
                onClick={() => setActiveTab('replied')}
              >
                ตอบแล้ว
              </button>
            </div>

            {/* Search Box */}
            <div className="search-wrapper">
              <Search
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: 14, pointerEvents: 'none' }}
              />
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder="ค้นหาชื่อ, ข้อความล่าสุด..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="search-shortcut">⌘K</span>
            </div>
          </div>

          {/* Conversations List */}
          <div className="user-list">
            {filteredUsers.length === 0 ? (
              <div
                style={{
                  padding: '50px 24px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px dashed var(--border-medium)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Inbox size={26} color="var(--text-muted)" />
                </div>
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {searchQuery ? 'ไม่พบการสนทนาที่ค้นหา' : 'ยังไม่มีบทสนทนา'}
                  </p>
                  <p style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                    เมื่อลูกค้าส่งข้อความเข้ามาทาง LINE OA ระบบจะแสดงข้อความและโปรไฟล์อัตโนมัติ
                  </p>
                </div>
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedUser?.userId === user.userId;
                return (
                  <button
                    key={user.userId}
                    className={`user-card ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedUser(user)}
                  >
                    <div className="avatar-container">
                      {user.pictureUrl ? (
                        <img
                          src={user.pictureUrl}
                          alt={user.displayName}
                          className="avatar-img"
                        />
                      ) : (
                        <div className="avatar-fallback">
                          {user.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="avatar-badge-dot" />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: isSelected ? 700 : 600,
                            fontSize: 14.5,
                            color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {user.displayName}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {formatTime(user.lastMessageAt)}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 13,
                            color: user.unreadCount > 0 ? '#FFFFFF' : 'var(--text-secondary)',
                            fontWeight: user.unreadCount > 0 ? 600 : 400,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            margin: 0,
                          }}
                        >
                          {user.lastMessage || 'ไม่มีข้อความ'}
                        </p>

                        {user.unreadCount > 0 && (
                          <span className="badge-unread-count">
                            {user.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* COLUMN 2: Live Chat Canvas */}
        {selectedUser ? (
          <main className="chat-canvas">
            {/* Header */}
            <div className="chat-header">
              <div className="header-user-info">
                <div className="avatar-container" style={{ width: 44, height: 44 }}>
                  {selectedUser.pictureUrl ? (
                    <img
                      src={selectedUser.pictureUrl}
                      alt={selectedUser.displayName}
                      className="avatar-img"
                    />
                  ) : (
                    <div className="avatar-fallback" style={{ fontSize: 16 }}>
                      {selectedUser.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="avatar-badge-dot" />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedUser.displayName}
                    </h3>
                    <span className="badge-pill badge-emerald">
                      LINE Verified
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        fontFamily: 'monospace',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      ID: {selectedUser.userId.substring(0, 20)}...
                    </span>
                    <button
                      onClick={() => copyUserId(selectedUser.userId)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copiedId ? 'var(--line-green)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="คัดลอก User ID"
                    >
                      {copiedId ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side Header Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginRight: 8,
                  }}
                >
                  <Clock size={13} />
                  <span>ล่าสุด {formatTime(selectedUser.lastMessageAt)}</span>
                </span>

                <button
                  onClick={() => setShowDetailDrawer(!showDetailDrawer)}
                  style={{
                    background: showDetailDrawer
                      ? 'rgba(6, 199, 85, 0.12)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${
                      showDetailDrawer ? 'rgba(6, 199, 85, 0.3)' : 'var(--border-subtle)'
                    }`,
                    color: showDetailDrawer ? 'var(--line-green)' : 'var(--text-secondary)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  title="เปิด/ปิด แถบข้อมูลลูกค้า"
                >
                  <PanelRight size={15} />
                  <span>ข้อมูลลูกค้า</span>
                </button>
              </div>
            </div>

            {/* Chat Messages Stream */}
            <div className="chat-stream">
              <div className="date-separator">
                <span className="date-pill">บทสนทนาผ่าน LINE Messaging API</span>
              </div>

              {messages.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    padding: 40,
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'var(--line-green-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <Sparkles size={28} color="var(--line-green)" />
                  </div>
                  <h4 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                    เริ่มต้นการสนทนากับ {selectedUser.displayName}
                  </h4>
                  <p style={{ fontSize: 13.5, maxWidth: 360, lineHeight: 1.6 }}>
                    พิมพ์ข้อความด้านล่างเพื่อส่ง Push Message เข้าไปยังแอป LINE ของผู้ใช้ได้ทันที
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`message-row ${isUser ? 'user' : 'agent'}`}
                    >
                      {isUser && (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            flexShrink: 0,
                            marginTop: 4,
                          }}
                        >
                          {selectedUser.pictureUrl ? (
                            <img
                              src={selectedUser.pictureUrl}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                background: '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                color: '#fff',
                                fontWeight: 700,
                              }}
                            >
                              {selectedUser.displayName.charAt(0)}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="message-bubble-wrapper">
                        <div className="message-bubble">
                          {msg.text}
                          <button
                            onClick={() => copyMessage(msg.text, msg.id)}
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              opacity: copiedMsgId === msg.id ? 1 : 0,
                              background: 'rgba(0,0,0,0.3)',
                              border: 'none',
                              color: '#FFFFFF',
                              borderRadius: 4,
                              padding: '2px 4px',
                              cursor: 'pointer',
                              fontSize: 10,
                              transition: 'opacity 0.2s',
                            }}
                          >
                            {copiedMsgId === msg.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div className="message-meta">
                          <span>{formatTime(msg.createdAt)}</span>
                          {!isUser && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <CheckCheck size={14} color="#A7F3D0" />
                              <span style={{ fontSize: 10 }}>ส่งเข้า LINE แล้ว</span>
                            </span>
                          )}
                          {isUser && (
                            <span style={{ fontSize: 10, color: 'var(--line-green)', fontWeight: 700 }}>
                              • จากผู้ใช้ LINE
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="composer-container">
              {/* Quick Replies */}
              <div className="quick-replies-carousel">
                {quickReplies.map((reply, idx) => (
                  <button
                    key={idx}
                    className="quick-reply-chip"
                    onClick={() => handleSendMessage(reply)}
                    disabled={isSending}
                  >
                    <span>{reply}</span>
                  </button>
                ))}
              </div>

              {/* Emoji quick bar */}
              {showEmojiPicker && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 10,
                    background: 'var(--bg-surface-elevated)',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                  }}
                >
                  {emojis.map((em, i) => (
                    <button
                      key={i}
                      onClick={() => setInputText((prev) => prev + em)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: 18,
                        cursor: 'pointer',
                        padding: '2px 4px',
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              {/* Composer Box */}
              <div className="composer-box">
                <textarea
                  ref={textareaRef}
                  className="composer-textarea"
                  rows={2}
                  placeholder={`ตอบกลับ ${selectedUser.displayName}... (กด Enter เพื่อส่ง, Shift + Enter ขึ้นบรรทัดใหม่)`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isSending}
                />

                <div className="composer-bottom-bar">
                  <div className="composer-actions-left">
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      title="ใส่อิโมจิ"
                    >
                      <Smile size={18} />
                    </button>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      Enter เพื่อส่ง
                    </span>
                  </div>

                  <button
                    type="button"
                    className="send-btn-pro"
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || isSending}
                    title="ส่งข้อความ Push เข้า LINE"
                  >
                    <span>ส่งข้อความ</span>
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          </main>
        ) : (
          /* Empty State when no conversation is selected */
          <main className="chat-canvas" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: 40,
                maxWidth: 480,
              }}
            >
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 26,
                  background: 'rgba(6, 199, 85, 0.08)',
                  border: '1px solid rgba(6, 199, 85, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 24,
                  boxShadow: '0 0 35px rgba(6, 199, 85, 0.15)',
                }}
              >
                <MessageSquare size={42} color="var(--line-green)" />
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
                Webchat Console
              </h3>
              <p
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.65,
                  color: 'var(--text-secondary)',
                  marginBottom: 30,
                }}
              >
                เลือกลูกค้าจากแถบด้านซ้ายเพื่อเปิดดูประวัติและพิมพ์ข้อความตอบกลับ หรือแอด LINE OA
                เพื่อเริ่มรับส่งข้อความผ่าน LINE Official Account ได้ทันที
              </p>

              <div>
                <button className="shimmer-green-btn" onClick={() => setShowQrModal(true)}>
                  <QrCode size={18} />
                  <span>สแกน QR แอด LINE OA</span>
                </button>
              </div>
            </div>
          </main>
        )}

        {/* COLUMN 3: Customer Detail Drawer */}
        {selectedUser && showDetailDrawer && (
          <aside className="detail-drawer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Customer Intelligence
              </span>
              <button
                onClick={() => setShowDetailDrawer(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="drawer-profile-card">
              <div className="avatar-container" style={{ width: 72, height: 72, marginBottom: 14 }}>
                {selectedUser.pictureUrl ? (
                  <img
                    src={selectedUser.pictureUrl}
                    alt={selectedUser.displayName}
                    className="avatar-img"
                  />
                ) : (
                  <div className="avatar-fallback" style={{ fontSize: 26 }}>
                    {selectedUser.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="avatar-badge-dot" style={{ width: 16, height: 16 }} />
              </div>

              <h4 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {selectedUser.displayName}
              </h4>
              <span className="badge-pill badge-emerald" style={{ marginBottom: 12 }}>
                LINE Platform User
              </span>

              {selectedUser.statusMessage && (
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 12 }}>
                  "{selectedUser.statusMessage}"
                </p>
              )}

              <div
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.25)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                  {selectedUser.userId.substring(0, 16)}...
                </span>
                <button
                  onClick={() => copyUserId(selectedUser.userId)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copiedId ? 'var(--line-green)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {copiedId ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Statistics */}
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, display: 'block' }}>
                สถิติการสนทนา
              </span>
              <div className="drawer-stat-grid">
                <div className="drawer-stat-box">
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ข้อความในห้องนี้</span>
                  <strong style={{ fontSize: 18, color: 'var(--text-primary)' }}>
                    {messages.length}
                  </strong>
                </div>
                <div className="drawer-stat-box">
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>สถานะ</span>
                  <strong style={{ fontSize: 14, color: 'var(--line-green)' }}>
                    Active
                  </strong>
                </div>
              </div>
            </div>

            {/* Channel Info */}
            <div
              style={{
                background: 'var(--bg-surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, display: 'block' }}>
                ข้อมูลช่องทาง (Channel)
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Channel ID:</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>2011444753</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>LINE OA ID:</span>
                  <span style={{ color: 'var(--line-green)', fontWeight: 700 }}>@194rgooz</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Webhook:</span>
                  <span style={{ color: '#10B981' }}>Connected</span>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="modal-backdrop-pro" onClick={() => setShowQrModal(false)}>
          <div className="modal-dialog-pro" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--line-green)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <QrCode size={20} color="#FFF" />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                    LINE Official Account
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    สแกน QR เพื่อเพิ่มเพื่อนและเริ่มการสนทนา
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: '#FFFFFF',
                borderRadius: 16,
                padding: 24,
                marginBottom: 20,
              }}
            >
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=https://line.me/R/ti/p/@194rgooz"
                alt="LINE OA QR Code"
                style={{ width: 200, height: 200, borderRadius: 8 }}
              />
              <span
                style={{
                  marginTop: 12,
                  fontSize: 17,
                  fontWeight: 800,
                  color: '#111827',
                  letterSpacing: '0.02em',
                }}
              >
                LINE ID: @194rgooz
              </span>
              <span style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                เปิดแอป LINE บนโทรศัพท์มือถือแล้วสแกน QR Code
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <a
                href="https://line.me/R/ti/p/@194rgooz"
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'var(--line-green)',
                  color: '#FFFFFF',
                  padding: '11px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={16} />
                <span>เปิดแอป LINE เพื่อเพิ่มเพื่อน</span>
              </a>
              <button
                onClick={() => setShowQrModal(false)}
                style={{
                  padding: '11px 20px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  color: '#E5E7EB',
                  borderRadius: 10,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
