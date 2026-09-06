'use client';

import React from 'react';
import { MessageSquare, ShieldCheck, QrCode, Bell, BellOff, RefreshCw, Sun, Moon } from 'lucide-react';
import { ThemeMode } from '@/lib/types';

interface TopNavbarProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenQrModal: () => void;
}

export function TopNavbar({
  soundEnabled,
  onToggleSound,
  theme,
  onToggleTheme,
  isRefreshing,
  onRefresh,
  onOpenQrModal,
}: TopNavbarProps) {
  return (
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 12,
              color: 'var(--text-muted)',
            }}
          >
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
          onClick={onOpenQrModal}
          title="สแกน QR Code เพื่อเชื่อมต่อ LINE OA"
        >
          <QrCode size={16} />
          <span>QR Code บัญชี LINE</span>
        </button>

        {/* Sound Toggle */}
        <button
          onClick={onToggleSound}
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

        {/* Theme Quick Switcher */}
        <button
          onClick={onToggleTheme}
          style={{
            background: theme === 'light' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${theme === 'light' ? 'rgba(245, 158, 11, 0.35)' : 'var(--border-subtle)'}`,
            color: theme === 'light' ? '#D97706' : '#FCD34D',
            padding: '9px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          title={theme === 'dark' ? 'สลับเป็นโหมดสว่าง (Light Mode)' : 'สลับเป็นโหมดมืด (Dark Mode)'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
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
  );
}
