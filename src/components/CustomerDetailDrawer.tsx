'use client';

import React from 'react';
import { X, Copy, Check, Trash2 } from 'lucide-react';
import { LineUser } from '@/lib/types';

interface CustomerDetailDrawerProps {
  selectedUser: LineUser;
  messageCount: number;
  onClose: () => void;
  copiedId: boolean;
  onCopyUserId: (id: string) => void;
  onOpenDeleteModal?: () => void;
}

export function CustomerDetailDrawer({
  selectedUser,
  messageCount,
  onClose,
  copiedId,
  onCopyUserId,
  onOpenDeleteModal,
}: CustomerDetailDrawerProps) {
  return (
    <aside className="detail-drawer">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
          }}
        >
          Customer Intelligence
        </span>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          title="ปิดแถบข้อมูล"
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
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
              marginBottom: 12,
            }}
          >
            "{selectedUser.statusMessage}"
          </p>
        )}

        <div
          style={{
            width: '100%',
            background: 'var(--bg-user-id-box)',
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
            onClick={() => onCopyUserId(selectedUser.userId)}
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
            title="คัดลอก User ID"
          >
            {copiedId ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedId ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-muted)',
            marginBottom: 10,
            display: 'block',
          }}
        >
          สถิติการสนทนา
        </span>
        <div className="drawer-stat-grid">
          <div className="drawer-stat-box">
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ข้อความในห้องนี้</span>
            <strong style={{ fontSize: 18, color: 'var(--text-primary)' }}>
              {messageCount}
            </strong>
          </div>
          <div className="drawer-stat-box">
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>สถานะ</span>
            <strong style={{ fontSize: 14, color: 'var(--line-green)' }}>Active</strong>
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
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-muted)',
            marginBottom: 10,
            display: 'block',
          }}
        >
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

      {/* Danger Zone */}
      {onOpenDeleteModal && (
        <div
          style={{
            marginTop: 'auto',
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.22)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#f87171',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Trash2 size={13} />
            จัดการการสนทนา (Danger Zone)
          </span>
          <p
            style={{
              fontSize: 11.5,
              color: 'var(--text-muted)',
              marginBottom: 10,
              lineHeight: 1.4,
            }}
          >
            ล้างประวัติข้อความ หรือลบผู้ใช้นี้ออกจากระบบ WebChat
          </p>
          <button
            onClick={onOpenDeleteModal}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radius-sm)',
              color: '#fca5a5',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <Trash2 size={13} />
            <span>ลบหรือล้างประวัติแชท</span>
          </button>
        </div>
      )}
    </aside>
  );
}
