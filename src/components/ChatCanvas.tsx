'use client';

import React, { useState } from 'react';
import {
  Clock,
  PanelRight,
  Sparkles,
  CheckCheck,
  Smile,
  Send,
  MessageSquare,
  QrCode,
  Check,
  Copy,
  Trash2,
} from 'lucide-react';
import { LineUser, ChatMessage } from '@/lib/types';
import { formatTime } from '@/lib/formatters';

interface ChatCanvasProps {
  selectedUser: LineUser | null;
  messages: ChatMessage[];
  onCopyUserId: (id: string) => void;
  copiedId: boolean;
  showDetailDrawer: boolean;
  onToggleDetailDrawer: () => void;
  inputText: string;
  onInputChange: (text: string) => void;
  onSendMessage: (textToSend?: string) => void;
  isSending: boolean;
  showEmojiPicker: boolean;
  onToggleEmojiPicker: () => void;
  onInsertEmoji: (emoji: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onOpenQrModal: () => void;
  onOpenDeleteModal?: () => void;
}

const QUICK_REPLIES = [
  'สวัสดีครับ ยินดีต้อนรับสู่ ROBO LINGO ครับ ✨',
  'ยินดีให้บริการครับ มีอะไรให้ช่วยเหลือเพิ่มเติมไหมครับ?',
  'ทางทีมงานกำลังตรวจสอบข้อมูลให้นะครับ สักครู่ครับ ⏳',
  'ขอบคุณที่ติดต่อเราครับ หากมีข้อสงสัยสอบถามได้ตลอดเวลาครับ 🙏',
];

const EMOJIS = ['😊', '🙏', '👍', '❤️', '🔥', '✨', '👏', '🎉', '⏳', '💡'];

export function ChatCanvas({
  selectedUser,
  messages,
  onCopyUserId,
  copiedId,
  showDetailDrawer,
  onToggleDetailDrawer,
  inputText,
  onInputChange,
  onSendMessage,
  isSending,
  showEmojiPicker,
  onToggleEmojiPicker,
  onInsertEmoji,
  messagesEndRef,
  textareaRef,
  onOpenQrModal,
  onOpenDeleteModal,
}: ChatCanvasProps) {
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const copyMessage = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  if (!selectedUser) {
    return (
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
          <h3
            style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}
          >
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
            <button className="shimmer-green-btn" onClick={onOpenQrModal}>
              <QrCode size={18} />
              <span>สแกน QR แอด LINE OA</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
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
              <span className="badge-pill badge-emerald">LINE Verified</span>
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
                onClick={() => onCopyUserId(selectedUser.userId)}
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

          {onOpenDeleteModal && (
            <button
              onClick={onOpenDeleteModal}
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.22)',
                color: '#f87171',
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
              title="จัดการ / ลบแชทนี้"
            >
              <Trash2 size={15} />
              <span>ลบแชท</span>
            </button>
          )}

          <button
            onClick={onToggleDetailDrawer}
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
            <h4
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: 6,
              }}
            >
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
              <div key={msg.id} className={`message-row ${isUser ? 'user' : 'agent'}`}>
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
                      <span
                        style={{ fontSize: 10, color: 'var(--line-green)', fontWeight: 700 }}
                      >
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
          {QUICK_REPLIES.map((reply, idx) => (
            <button
              key={idx}
              className="quick-reply-chip"
              onClick={() => onSendMessage(reply)}
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
            {EMOJIS.map((em, i) => (
              <button
                key={i}
                onClick={() => onInsertEmoji(em)}
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
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            disabled={isSending}
          />

          <div className="composer-bottom-bar">
            <div className="composer-actions-left">
              <button
                type="button"
                className="action-btn"
                onClick={onToggleEmojiPicker}
                title="ใส่อิโมจิ"
              >
                <Smile size={18} />
              </button>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Enter เพื่อส่ง</span>
            </div>

            <button
              type="button"
              className="send-btn-pro"
              onClick={() => onSendMessage()}
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
  );
}
