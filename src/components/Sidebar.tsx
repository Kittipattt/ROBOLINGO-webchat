'use client';

import React, { useMemo } from 'react';
import { Search, Inbox } from 'lucide-react';
import { LineUser } from '@/lib/types';
import { formatTime } from '@/lib/formatters';

interface SidebarProps {
  users: LineUser[];
  selectedUser: LineUser | null;
  onSelectUser: (user: LineUser) => void;
  activeTab: 'all' | 'unread' | 'replied';
  onTabChange: (tab: 'all' | 'unread' | 'replied') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function Sidebar({
  users,
  selectedUser,
  onSelectUser,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  searchInputRef,
}: SidebarProps) {
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

  const totalUnread = users.reduce((acc, curr) => acc + curr.unreadCount, 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>การสนทนา</h2>
            <span className="badge-pill badge-emerald">{users.length} คน</span>
          </div>

          {totalUnread > 0 && <span className="badge-unread-count">{totalUnread}</span>}
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button
            className={`filter-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => onTabChange('all')}
          >
            ทั้งหมด
          </button>
          <button
            className={`filter-tab ${activeTab === 'unread' ? 'active' : ''}`}
            onClick={() => onTabChange('unread')}
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
            onClick={() => onTabChange('replied')}
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
            onChange={(e) => onSearchChange(e.target.value)}
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
            const isUnread = (user.unreadCount || 0) > 0;
            return (
              <button
                key={user.userId}
                className={`user-card ${isSelected ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
                onClick={() => onSelectUser(user)}
              >
                <div className="avatar-container">
                  {user.pictureUrl ? (
                    <img src={user.pictureUrl} alt={user.displayName} className="avatar-img" />
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
                      <span className="badge-unread-count">{user.unreadCount}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
