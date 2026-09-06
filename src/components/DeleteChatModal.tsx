'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle, Eraser, X, Loader2, UserMinus } from 'lucide-react';
import { LineUser } from '@/lib/types';

interface DeleteChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: LineUser | null;
  messageCount: number;
  onClearMessages: (userId: string) => Promise<void>;
  onDeleteConversation: (userId: string) => Promise<void>;
}

export function DeleteChatModal({
  isOpen,
  onClose,
  targetUser,
  messageCount,
  onClearMessages,
  onDeleteConversation,
}: DeleteChatModalProps) {
  const [actionType, setActionType] = useState<'clear' | 'delete'>('clear');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  if (!isOpen || !targetUser) return null;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      if (actionType === 'clear') {
        await onClearMessages(targetUser.userId);
      } else {
        await onDeleteConversation(targetUser.userId);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการดำเนินการ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface-modal)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 24,
          padding: 28,
          maxWidth: 500,
          width: '100%',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(239, 68, 68, 0.15)',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
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
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f87171',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)',
            }}
          >
            <Trash2 size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              จัดการการสนทนา
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              เลือกว่าจะล้างเฉพาะข้อความ หรือลบข้อมูลผู้ใช้ออกจากระบบ
            </p>
          </div>
        </div>

        {/* User preview card */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 16,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div className="avatar-container" style={{ width: 44, height: 44, flexShrink: 0 }}>
            {targetUser.pictureUrl && !avatarError ? (
              <img
                src={targetUser.pictureUrl}
                alt={targetUser.displayName}
                className="avatar-img"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="avatar-fallback" style={{ fontSize: 16 }}>
                {targetUser.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {targetUser.displayName}
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-secondary)',
                }}
              >
                {messageCount} ข้อความ
              </span>
            </div>
            <span
              style={{
                fontSize: 11.5,
                color: 'var(--text-muted)',
                fontFamily: 'monospace',
                display: 'block',
                marginTop: 2,
              }}
            >
              ID: {targetUser.userId.substring(0, 18)}...
            </span>
          </div>
        </div>

        {/* Options Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {/* Option 1: Clear Messages */}
          <div
            onClick={() => setActionType('clear')}
            style={{
              padding: '14px 16px',
              borderRadius: 16,
              background:
                actionType === 'clear' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              border: `1.5px solid ${
                actionType === 'clear' ? 'rgba(245, 158, 11, 0.45)' : 'var(--border-subtle)'
              }`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              transition: 'all 0.2s',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background:
                  actionType === 'clear' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: actionType === 'clear' ? '#fbbf24' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <Eraser size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: actionType === 'clear' ? '#fbbf24' : 'var(--text-primary)',
                  }}
                >
                  ล้างประวัติข้อความ (Clear Messages)
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    padding: '2px 8px',
                    borderRadius: 8,
                    background:
                      actionType === 'clear'
                        ? 'rgba(245, 158, 11, 0.2)'
                        : 'rgba(255, 255, 255, 0.06)',
                    color: actionType === 'clear' ? '#fbbf24' : 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  แนะนำ
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  margin: '4px 0 0 0',
                  lineHeight: 1.4,
                }}
              >
                ลบประวัติแชททั้งหมดในห้องนี้ แต่ยังคงเก็บโปรไฟล์ลูกค้าไว้ในรายชื่อแชท
              </p>
            </div>
          </div>

          {/* Option 2: Delete Conversation & User */}
          <div
            onClick={() => setActionType('delete')}
            style={{
              padding: '14px 16px',
              borderRadius: 16,
              background:
                actionType === 'delete' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.02)',
              border: `1.5px solid ${
                actionType === 'delete' ? 'rgba(239, 68, 68, 0.5)' : 'var(--border-subtle)'
              }`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              transition: 'all 0.2s',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background:
                  actionType === 'delete' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: actionType === 'delete' ? '#f87171' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <UserMinus size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: actionType === 'delete' ? '#f87171' : 'var(--text-primary)',
                  }}
                >
                  ลบห้องสนทนาออกจากระบบ (Delete User)
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    padding: '2px 8px',
                    borderRadius: 8,
                    background:
                      actionType === 'delete'
                        ? 'rgba(239, 68, 68, 0.25)'
                        : 'rgba(255, 255, 255, 0.06)',
                    color: actionType === 'delete' ? '#fca5a5' : 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  ลบถาวร
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  margin: '4px 0 0 0',
                  lineHeight: 1.4,
                }}
              >
                ลบทั้งข้อมูลลูกค้าและข้อความทั้งหมดออกจากระบบ WebChat อย่างสมบูรณ์
              </p>
            </div>
          </div>
        </div>

        {/* Warning Callout */}
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 12,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 24,
          }}
        >
          <AlertTriangle size={16} color="#f87171" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.4 }}>
            การกระทำนี้จะลบข้อมูลจากฐานข้อมูลของระบบทันที และไม่สามารถกู้คืนได้
          </span>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              color: '#fecaca',
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-sm)',
              background:
                actionType === 'clear'
                  ? 'linear-gradient(135deg, #d97706, #b45309)'
                  : 'linear-gradient(135deg, #dc2626, #b91c1c)',
              border: 'none',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow:
                actionType === 'clear'
                  ? '0 4px 16px rgba(217, 119, 6, 0.4)'
                  : '0 4px 16px rgba(220, 38, 38, 0.4)',
              transition: 'all 0.2s',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>กำลังดำเนินการ...</span>
              </>
            ) : (
              <>
                <Trash2 size={15} />
                <span>
                  {actionType === 'clear' ? 'ยืนยันการล้างประวัติ' : 'ยืนยันการลบห้องสนทนา'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
