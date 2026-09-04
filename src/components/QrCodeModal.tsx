'use client';

import React from 'react';
import { QrCode, X, ExternalLink } from 'lucide-react';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QrCodeModal({ isOpen, onClose }: QrCodeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-pro" onClick={onClose}>
      <div className="modal-dialog-pro" onClick={(e) => e.stopPropagation()}>
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
            onClick={onClose}
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
            onClick={onClose}
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
  );
}
