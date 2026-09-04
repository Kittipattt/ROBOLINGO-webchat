'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ShieldCheck,
  X,
  PlusCircle,
  Copy,
  Check,
} from 'lucide-react';
import { LineUser, ChatMessage } from '@/lib/types';

export default function WebChatPage() {
  const [users, setUsers] = useState<LineUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<LineUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Simulation form state
  const [simName, setSimName] = useState('ผู้ทดสอบ LINE');
  const [simText, setSimText] = useState('สวัสดีครับ สอบถามข้อมูลเรื่องสินค้าและบริการครับ');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef<number>(0);

  // Synthesize gentle notification sound using Web Audio API
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio context might be restricted before first user gesture
    }
  }, [soundEnabled]);

  // Fetch all users
  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  // Fetch messages for active user
  const fetchMessages = useCallback(
    async (userId: string, silent = false) => {
      try {
        const res = await fetch(`/api/messages?userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          const newMessages: ChatMessage[] = data.messages || [];

          // Play sound if new message arrived from LINE user
          if (
            lastMessageCountRef.current > 0 &&
            newMessages.length > lastMessageCountRef.current
          ) {
            const latest = newMessages[newMessages.length - 1];
            if (latest.sender === 'user') {
              playNotificationSound();
            }
          }
          lastMessageCountRef.current = newMessages.length;
          setMessages(newMessages);
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    },
    [playNotificationSound]
  );

  // Initial load and polling
  useEffect(() => {
    fetchUsers();

    // Poll users and messages every 2.5 seconds for instant real-time experience
    const interval = setInterval(() => {
      fetchUsers(true);
      if (selectedUser?.userId) {
        fetchMessages(selectedUser.userId, true);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [fetchUsers, fetchMessages, selectedUser?.userId]);

  // When active user changes
  useEffect(() => {
    if (selectedUser?.userId) {
      lastMessageCountRef.current = 0;
      fetchMessages(selectedUser.userId);

      // Mark user as read
      fetch('/api/users/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.userId }),
      }).then(() => {
        // Local update of unread count
        setUsers((prev) =>
          prev.map((u) => (u.userId === selectedUser.userId ? { ...u, unreadCount: 0 } : u))
        );
      });
    } else {
      setMessages([]);
    }
  }, [selectedUser, fetchMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message handler
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !selectedUser || isSending) return;

    setIsSending(true);
    setInputText('');

    // Optimistic message update
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
        // Replace optimistic message with actual saved message
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? data.message || { ...m, status: 'sent' } : m))
        );
        fetchUsers(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`เกิดข้อผิดพลาดในการส่ง LINE Message: ${errData.error || 'Server error'}`);
        // Mark as error
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
    }
  };

  // Quick replies
  const quickReplies = [
    'สวัสดีครับ ยินดีต้อนรับครับ 😊',
    'ยินดีให้บริการครับ มีอะไรให้ช่วยเหลือเพิ่มเติมไหมครับ?',
    'ทางทีมงานกำลังตรวจสอบข้อมูลให้สักครู่นะครับ ⏳',
    'ขอบคุณที่ติดต่อเราครับ หากมีข้อสงสัยสอบถามได้ตลอดเวลาครับ 🙏',
  ];

  // Filtered users by search
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.lastMessage.toLowerCase().includes(q) ||
      u.userId.toLowerCase().includes(q)
    );
  });

  const handleSimulateMessage = async () => {
    if (!simText.trim()) return;
    try {
      const res = await fetch('/api/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: simName.trim() || 'ผู้ทดสอบ LINE',
          text: simText.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowSimulateModal(false);
        setSimText('');
        await fetchUsers();
        if (data.user?.userId) {
          const matched = users.find((u) => u.userId === data.user.userId) || {
            userId: data.user.userId,
            displayName: data.user.displayName,
            lastMessage: simText.trim(),
            lastMessageAt: Date.now(),
            unreadCount: 1,
          };
          setSelectedUser(matched);
        }
      }
    } catch (err) {
      alert('Simulation failed: ' + err);
    }
  };

  const copyUserId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
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
      <header className="top-navbar glass-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #06C755 0%, #048C3B 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(6, 199, 85, 0.4)',
            }}
          >
            <MessageSquare size={20} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>
                ROBO LINGO
              </span>
              <span
                style={{
                  fontSize: 11,
                  background: 'rgba(255, 255, 255, 0.1)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  color: '#9CA3AF',
                  fontWeight: 600,
                }}
              >
                Webchat Console
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9CA3AF' }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#06C755',
                  boxShadow: '0 0 8px #06C755',
                }}
              />
              <span>Connected to LINE OA:</span>
              <strong style={{ color: '#06C755' }}>@194rgooz</strong>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Add LINE OA Button */}
          <button
            onClick={() => setShowQrModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'rgba(6, 199, 85, 0.12)',
              border: '1px solid rgba(6, 199, 85, 0.35)',
              color: '#06C755',
              padding: '7px 14px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <QrCode size={16} />
            <span>แอด LINE OA ทดสอบ</span>
          </button>

          {/* Test message simulator */}
          <button
            onClick={() => setShowSimulateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              color: '#E5E7EB',
              padding: '7px 13px',
              borderRadius: 10,
              fontSize: 13,
              cursor: 'pointer',
            }}
            title="จำลองข้อความที่ส่งจากผู้ใช้ LINE"
          >
            <PlusCircle size={15} color="#06B6D4" />
            <span>จำลองข้อความเข้า</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              color: soundEnabled ? '#06C755' : '#6B7280',
              padding: '8px',
              borderRadius: 10,
              cursor: 'pointer',
            }}
            title={soundEnabled ? 'เปิดเสียงแจ้งเตือนแล้ว' : 'ปิดเสียงแจ้งเตือน'}
          >
            {soundEnabled ? <Bell size={16} /> : <BellOff size={16} />}
          </button>

          {/* Refresh */}
          <button
            onClick={() => fetchUsers()}
            disabled={isRefreshing}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              color: '#9CA3AF',
              padding: '8px',
              borderRadius: 10,
              cursor: 'pointer',
            }}
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Content Area: Split View */}
      <div className="main-content">
        {/* Left Sidebar: User Conversations List */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>บทสนทนา</h2>
                <span className="badge badge-green">
                  {users.length} {users.length === 1 ? 'ผู้ใช้' : 'ผู้ใช้'}
                </span>
              </div>
            </div>

            {/* Search Input */}
            <div className="search-input-wrapper">
              <Search
                size={16}
                color="#6B7280"
                style={{ position: 'absolute', left: 12, pointerEvents: 'none' }}
              />
              <input
                type="text"
                className="search-input"
                placeholder="ค้นหาชื่อ หรือข้อความล่าสุด..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Users List */}
          <div className="user-list">
            {filteredUsers.length === 0 ? (
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#6B7280',
                  fontSize: 13.5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UserIcon size={24} color="#4B5563" />
                </div>
                <div>
                  <p style={{ fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>
                    ยังไม่มีข้อความจากผู้ใช้ LINE
                  </p>
                  <p style={{ fontSize: 12 }}>
                    สแกน QR Code หรือกดปุ่ม <strong>"จำลองข้อความเข้า"</strong> ด้านบนเพื่อเริ่มทดสอบ
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
                    <div className="avatar-wrapper">
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
                      <div className="status-dot" />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 3,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: isSelected ? 700 : 600,
                            fontSize: 14.5,
                            color: isSelected ? '#FFFFFF' : '#E5E7EB',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {user.displayName}
                        </span>
                        <span style={{ fontSize: 11, color: '#6B7280', flexShrink: 0 }}>
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
                            color: user.unreadCount > 0 ? '#E5E7EB' : '#9CA3AF',
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
                          <span className="badge-unread animate-pulse-glow">
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

        {/* Right Area: Chat Panel */}
        {selectedUser ? (
          <main className="chat-panel">
            {/* Active User Header */}
            <div className="chat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="avatar-wrapper" style={{ width: 44, height: 44 }}>
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
                  <div className="status-dot" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB' }}>
                      {selectedUser.displayName}
                    </h3>
                    <span
                      style={{
                        background: 'rgba(6, 199, 85, 0.15)',
                        color: '#06C755',
                        fontSize: 11,
                        padding: '1px 7px',
                        borderRadius: 6,
                        fontWeight: 600,
                      }}
                    >
                      LINE User
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span
                      style={{
                        fontSize: 12,
                        color: '#6B7280',
                        fontFamily: 'monospace',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      ID: {selectedUser.userId.substring(0, 18)}...
                    </span>
                    <button
                      onClick={() => copyUserId(selectedUser.userId)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copiedId ? '#06C755' : '#9CA3AF',
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

              {/* Status info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    color: '#9CA3AF',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Clock size={13} />
                  <span>กิจกรรมล่าสุด {formatTime(selectedUser.lastMessageAt)}</span>
                </span>
              </div>
            </div>

            {/* Chat Messages List */}
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      background: 'rgba(6, 199, 85, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <Sparkles size={28} color="#06C755" />
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 600, color: '#E5E7EB', marginBottom: 6 }}>
                    เริ่มต้นการสนทนากับ {selectedUser.displayName}
                  </h4>
                  <p style={{ fontSize: 13.5, maxWidth: 360, lineHeight: 1.5 }}>
                    พิมพ์ข้อความด้านล่างเพื่อส่ง Push Message ผ่าน LINE Official Account ไปยังแอป LINE ของผู้ใช้ได้ทันที
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`message-row ${isUser ? 'user' : 'agent'} animate-fade-in`}
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
                                background: '#374151',
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

                      <div style={{ maxWidth: '100%' }}>
                        <div className="message-bubble">{msg.text}</div>
                        <div className="message-meta">
                          <span>{formatTime(msg.createdAt)}</span>
                          {!isUser && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                              <CheckCheck size={14} color="#A7F3D0" />
                              <span style={{ fontSize: 10 }}>ส่งไปยัง LINE แล้ว</span>
                            </span>
                          )}
                          {isUser && (
                            <span style={{ fontSize: 10, color: '#06C755', fontWeight: 600 }}>
                              • LINE
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

            {/* Chat Input Container */}
            <div className="chat-input-container">
              {/* Quick Reply Pills */}
              <div className="quick-replies">
                {quickReplies.map((reply, idx) => (
                  <button
                    key={idx}
                    className="quick-reply-pill"
                    onClick={() => handleSendMessage(reply)}
                    disabled={isSending}
                  >
                    {reply}
                  </button>
                ))}
              </div>

              {/* Textarea + Send Button */}
              <form
                className="chat-input-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
              >
                <textarea
                  className="chat-textarea"
                  rows={1}
                  placeholder={`พิมพ์ข้อความตอบกลับ ${selectedUser.displayName} (กด Enter เพื่อส่ง)...`}
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
                <button
                  type="submit"
                  className="send-button"
                  disabled={!inputText.trim() || isSending}
                  title="ส่งข้อความ (Enter)"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </main>
        ) : (
          /* Empty State when no user is selected */
          <main className="chat-panel" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-state">
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  background: 'rgba(6, 199, 85, 0.08)',
                  border: '1px solid rgba(6, 199, 85, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 24,
                  boxShadow: '0 0 30px rgba(6, 199, 85, 0.1)',
                }}
              >
                <MessageSquare size={38} color="#06C755" />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: '#F9FAFB', marginBottom: 8 }}>
                ยินดีต้อนรับสู่ Webchat Console
              </h3>
              <p
                style={{
                  fontSize: 14.5,
                  maxWidth: 460,
                  lineHeight: 1.6,
                  color: '#9CA3AF',
                  marginBottom: 28,
                }}
              >
                เลือกผู้ใช้จากแถบด้านซ้ายเพื่อเปิดดูประวัติการสนทนาและส่งข้อความตอบกลับ หรือแอด LINE OA
                เพื่อทดลองส่งข้อความเข้ามาสดๆ ได้เลยครับ
              </p>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setShowQrModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--line-green)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(6, 199, 85, 0.35)',
                  }}
                >
                  <QrCode size={18} />
                  <span>สแกน QR แอด LINE OA</span>
                </button>

                <button
                  onClick={() => setShowSimulateModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--border-subtle)',
                    color: '#E5E7EB',
                    padding: '10px 18px',
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <PlusCircle size={18} color="#06B6D4" />
                  <span>ทดสอบด้วยข้อความจำลอง</span>
                </button>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="modal-backdrop" onClick={() => setShowQrModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: '#06C755',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <QrCode size={18} color="#FFF" />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>แอด LINE Official Account</h3>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  padding: 4,
                }}
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
              {/* QR Code image via Google charts API for @194rgooz */}
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=https://line.me/R/ti/p/@194rgooz"
                alt="LINE OA QR Code"
                style={{ width: 200, height: 200, borderRadius: 8 }}
              />
              <span
                style={{
                  marginTop: 12,
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#111827',
                  letterSpacing: '0.02em',
                }}
              >
                LINE ID: @194rgooz
              </span>
              <span style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                สแกนผ่านแอป LINE บนโทรศัพท์มือถือ
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
                  background: '#06C755',
                  color: '#FFFFFF',
                  padding: '11px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={16} />
                <span>เปิดลิงก์แอดเพื่อน</span>
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

      {/* Simulate Message Modal */}
      {showSimulateModal && (
        <div className="modal-backdrop" onClick={() => setShowSimulateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PlusCircle size={20} color="#06B6D4" />
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>จำลองข้อความเข้าจาก LINE</h3>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 18, lineHeight: 1.5 }}>
              ฟังก์ชันนี้จำลองกรณีมีผู้ใช้พิมพ์ส่งข้อความหา LINE OA เพื่อให้คุณทดสอบฟีเจอร์การรับข้อความและเลือกตอบกลับได้ทันที
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, color: '#D1D5DB', marginBottom: 6 }}>
                  ชื่อผู้ส่ง (LINE Display Name)
                </label>
                <input
                  type="text"
                  className="search-input"
                  style={{ paddingLeft: 12 }}
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  placeholder="เช่น Somchai, Kitty, John Doe"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, color: '#D1D5DB', marginBottom: 6 }}>
                  ข้อความที่ส่ง
                </label>
                <textarea
                  className="search-input"
                  style={{ paddingLeft: 12, minHeight: 80, resize: 'vertical' }}
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  placeholder="พิมพ์ข้อความทดสอบ..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSimulateModal(false)}
                style={{
                  padding: '9px 18px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  color: '#D1D5DB',
                  borderRadius: 10,
                  fontSize: 13.5,
                  cursor: 'pointer',
                }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSimulateMessage}
                style={{
                  padding: '9px 20px',
                  background: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: 10,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',
                }}
              >
                ส่งข้อความจำลอง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
