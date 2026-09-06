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
  Zap,
  Paperclip,
  Maximize2,
  Download,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { LineUser, ChatMessage, QuickReplyTemplate, DEFAULT_QUICK_REPLIES } from '@/lib/types';
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
  onSendImage?: (file: File, caption?: string) => void;
  isSending: boolean;
  showEmojiPicker: boolean;
  onToggleEmojiPicker: () => void;
  onInsertEmoji: (emoji: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onOpenQrModal: () => void;
  onOpenDeleteModal?: () => void;
  quickReplies?: QuickReplyTemplate[];
  onOpenQuickRepliesModal?: () => void;
}

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
  quickReplies = DEFAULT_QUICK_REPLIES,
  onOpenQuickRepliesModal,
  onSendImage,
}: ChatCanvasProps) {
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, GIF, WebP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('ขนาดไฟล์เกินกำหนด (สูงสุด 10MB)');
      return;
    }
    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleCancelImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
  };

  const handleSend = () => {
    if (selectedImageFile) {
      onSendImage?.(selectedImageFile, inputText);
      handleCancelImage();
      onInputChange('');
    } else {
      onSendMessage();
    }
  };

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
                    {msg.imageUrl && (
                      <div
                        style={{
                          marginBottom: msg.text && msg.text !== '📷 [รูปภาพ]' ? 8 : 0,
                          cursor: 'pointer',
                          borderRadius: 12,
                          overflow: 'hidden',
                          position: 'relative',
                          background: 'rgba(0, 0, 0, 0.2)',
                        }}
                        data-testid="chat-image-btn"
                        onClick={() => setLightboxUrl(msg.imageUrl || null)}
                        title="คลิกเพื่อดูภาพขนาดเต็ม"
                      >
                        <img
                          src={msg.imageUrl}
                          alt="Message attachment"
                          style={{
                            maxWidth: 300,
                            maxHeight: 260,
                            width: '100%',
                            display: 'block',
                            borderRadius: 12,
                            objectFit: 'cover',
                            transition: 'transform 0.2s ease',
                          }}
                          loading="lazy"
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 6,
                            right: 6,
                            background: 'rgba(0, 0, 0, 0.7)',
                            backdropFilter: 'blur(6px)',
                            borderRadius: 6,
                            padding: '2px 7px',
                            color: '#FFFFFF',
                            fontSize: 10.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Maximize2 size={11} />
                          <span>ดูรูปขยาย</span>
                        </div>
                      </div>
                    )}
                    {(!msg.imageUrl || (msg.text && msg.text !== '📷 [รูปภาพ]')) && (
                      <span>{msg.text}</span>
                    )}
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
        {/* Quick Replies Carousel */}
        <div className="quick-replies-carousel">
          {onOpenQuickRepliesModal && (
            <button
              type="button"
              className="quick-reply-chip"
              onClick={onOpenQuickRepliesModal}
              style={{
                background: 'rgba(6, 199, 85, 0.1)',
                borderColor: 'rgba(6, 199, 85, 0.35)',
                color: 'var(--line-green)',
                fontWeight: 600,
              }}
              title="เพิ่มหรือแก้ไขเทมเพลตคำตอบด่วน"
            >
              <Zap size={13} />
              <span>จัดการคำตอบด่วน</span>
            </button>
          )}

          {quickReplies.map((item) => (
            <button
              key={item.id}
              type="button"
              className="quick-reply-chip"
              onClick={() => onSendMessage(item.text)}
              disabled={isSending}
              title="คลิกเพื่อส่งข้อความนี้ทันที"
            >
              <span>{item.text}</span>
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

        {/* Image Attachment Preview Bar */}
        {imagePreviewUrl && (
          <div
            style={{
              marginBottom: 10,
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <img
              src={imagePreviewUrl}
              alt="Preview"
              style={{
                width: 52,
                height: 52,
                objectFit: 'cover',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedImageFile?.name}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {(selectedImageFile ? selectedImageFile.size / 1024 : 0).toFixed(1)} KB • แนบรูปภาพแล้ว (พิมพ์ข้อความกำกับหรือกดส่งได้ทันที)
              </div>
            </div>
            <button
              id="cancel-image-btn"
              type="button"
              onClick={handleCancelImage}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: 'var(--text-secondary)',
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="ยกเลิกรูปภาพ"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Composer Box */}
        <div className="composer-box">
          <textarea
            id="message-input"
            ref={textareaRef}
            className="composer-textarea"
            rows={2}
            placeholder={
              selectedImageFile
                ? `พิมพ์ข้อความกำกับภาพ (Caption) แล้วกดส่ง...`
                : `ตอบกลับ ${selectedUser.displayName}... (กด Enter เพื่อส่ง, Shift + Enter ขึ้นบรรทัดใหม่)`
            }
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
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

              <input
                id="file-upload-input"
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
                onChange={handleFileSelect}
              />
              <button
                id="attach-image-btn"
                type="button"
                className="action-btn"
                onClick={() => fileInputRef.current?.click()}
                title="แนบรูปภาพส่งเข้า LINE (รูปสินค้า, สลิปโอนเงิน)"
              >
                <Paperclip size={18} />
              </button>

              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Enter เพื่อส่ง</span>
            </div>

            <button
              id="send-button"
              type="button"
              className="send-btn-pro"
              onClick={handleSend}
              disabled={(!inputText.trim() && !selectedImageFile) || isSending}
              title="ส่งข้อความ/รูปภาพ เข้า LINE"
            >
              <span>{selectedImageFile ? 'ส่งรูปภาพ' : 'ส่งข้อความ'}</span>
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Full-Screen Lightbox Modal */}
      {lightboxUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setLightboxUrl(null)}
        >
          <div
            style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxUrl}
              alt="Enlarged view"
              style={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: 16,
                boxShadow: '0 25px 70px rgba(0, 0, 0, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            />
            <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 10 }}>
              <a
                id="lightbox-download-btn"
                href={lightboxUrl}
                target="_blank"
                rel="noreferrer"
                download
                style={{
                  background: 'rgba(0, 0, 0, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  width: 38,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                title="ดาวน์โหลดรูปภาพ"
              >
                <Download size={18} />
              </a>
              <button
                id="lightbox-close-btn"
                type="button"
                onClick={() => setLightboxUrl(null)}
                style={{
                  background: 'rgba(0, 0, 0, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  width: 38,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                title="ปิด (Close)"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
