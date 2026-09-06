'use client';

import React, { useState } from 'react';
import {
  X,
  Zap,
  Plus,
  Pencil,
  Trash2,
  Check,
  RotateCcw,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { QuickReplyTemplate } from '@/lib/types';

interface QuickRepliesModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickReplies: QuickReplyTemplate[];
  onAddReply: (text: string) => Promise<QuickReplyTemplate | null>;
  onUpdateReply: (id: string, text: string) => Promise<boolean>;
  onDeleteReply: (id: string) => Promise<boolean>;
  onResetDefaults: () => Promise<void>;
}

export function QuickRepliesModal({
  isOpen,
  onClose,
  quickReplies,
  onAddReply,
  onUpdateReply,
  onDeleteReply,
  onResetDefaults,
}: QuickRepliesModalProps) {
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newText.trim();
    if (!trimmed || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddReply(trimmed);
      setNewText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (item: QuickReplyTemplate) => {
    setEditingId(item.id);
    setEditingText(item.text);
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;

    await onUpdateReply(id, trimmed);
    setEditingId(null);
    setEditingText('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface-modal)',
          border: '1px solid rgba(6, 199, 85, 0.3)',
          borderRadius: 24,
          padding: 28,
          maxWidth: 580,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(6, 199, 85, 0.12)',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 22,
            right: 22,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          title="ปิดหน้าต่าง"
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: 'rgba(6, 199, 85, 0.12)',
              border: '1px solid rgba(6, 199, 85, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--line-green)',
              boxShadow: '0 0 20px rgba(6, 199, 85, 0.2)',
            }}
          >
            <Zap size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                จัดการเทมเพลตคำตอบด่วน
              </h3>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'rgba(6, 199, 85, 0.15)',
                  border: '1px solid rgba(6, 199, 85, 0.3)',
                  color: 'var(--line-green)',
                  fontWeight: 600,
                }}
              >
                {quickReplies.length} รายการ
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              เพิ่ม แก้ไข หรือลบข้อความที่ใช้บ่อย เพื่อตอบลูกค้าได้เร็วยิ่งขึ้น
            </p>
          </div>
        </div>

        {/* Add New Template Input Form */}
        <form onSubmit={handleAdd} style={{ marginBottom: 20 }}>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-medium)',
              borderRadius: 16,
              padding: '8px 12px 8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: 'inset 0 1px 4px rgba(0, 0, 0, 0.2)',
            }}
          >
            <MessageSquare size={17} color="var(--line-green)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="พิมพ์ข้อความด่วนใหม่ เช่น เลขที่บัญชีสำหรับชำระเงิน..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: 13.5,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!newText.trim() || isSubmitting}
              style={{
                background: newText.trim()
                  ? 'var(--gradient-emerald)'
                  : 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                color: newText.trim() ? '#ffffff' : 'var(--text-muted)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: newText.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                boxShadow: newText.trim() ? '0 2px 10px rgba(6, 199, 85, 0.3)' : 'none',
              }}
            >
              <Plus size={15} />
              <span>เพิ่มคำตอบ</span>
            </button>
          </div>
        </form>

        {/* Templates List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            paddingRight: 4,
            marginBottom: 20,
          }}
        >
          {quickReplies.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 16,
                border: '1px dashed var(--border-subtle)',
              }}
            >
              <Sparkles size={28} color="var(--text-muted)" style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0 }}>
                ยังไม่มีข้อความด่วนในระบบ
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                พิมพ์ข้อความใหม่ด้านบน หรือกด "คืนค่าเริ่มต้น" เพื่อโหลดข้อความมาตรฐาน
              </p>
            </div>
          ) : (
            quickReplies.map((item, idx) => {
              const isEditing = editingId === item.id;

              if (isEditing) {
                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(6, 199, 85, 0.06)',
                      border: '1px solid rgba(6, 199, 85, 0.4)',
                      borderRadius: 14,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(item.id);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      autoFocus
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => handleSaveEdit(item.id)}
                      disabled={!editingText.trim()}
                      style={{
                        background: 'var(--line-green)',
                        border: 'none',
                        color: '#ffffff',
                        padding: '6px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="บันทึกการแก้ไข"
                    >
                      <Check size={14} />
                      <span>บันทึก</span>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        padding: '6px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                      title="ยกเลิก"
                    >
                      ยกเลิก
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 14,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        fontFamily: 'monospace',
                        width: 18,
                        textAlign: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}.
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.text}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleStartEdit(item)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        width: 28,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      title="แก้ไขข้อความ"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteReply(item.id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 8,
                        width: 28,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#f87171',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      title="ลบข้อความนี้"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 16,
          }}
        >
          <button
            type="button"
            onClick={onResetDefaults}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 12.5,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title="คืนค่าเป็น 4 ข้อความมาตรฐาน"
          >
            <RotateCcw size={14} />
            <span>คืนค่าเริ่มต้น (Reset)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              padding: '8px 20px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
}
