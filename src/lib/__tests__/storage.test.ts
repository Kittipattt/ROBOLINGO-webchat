import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../storage';
import { LineUser, ChatMessage } from '../types';

describe('Storage Layer Unit Tests (src/lib/storage.ts)', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStore[key];
      }),
      clear: vi.fn(() => {
        mockStore = {};
      }),
    };

    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('window', { localStorage: localStorageMock });
  });

  describe('User Caching', () => {
    it('should return empty array when no users are cached', () => {
      expect(storage.getCachedUsers()).toEqual([]);
    });

    it('should persist and retrieve cached users', () => {
      const mockUsers: LineUser[] = [
        {
          userId: 'U100',
          displayName: 'Test User',
          lastMessage: 'Hello',
          lastMessageAt: 12345678,
          unreadCount: 0,
        },
      ];

      storage.setCachedUsers(mockUsers);
      const retrieved = storage.getCachedUsers();
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].userId).toBe('U100');
      expect(retrieved[0].displayName).toBe('Test User');
    });
  });

  describe('Message Caching', () => {
    it('should return empty array when no messages exist for user', () => {
      expect(storage.getCachedMessages('U_unknown')).toEqual([]);
    });

    it('should persist, retrieve, and remove cached messages', () => {
      const mockMessages: ChatMessage[] = [
        {
          id: 'msg_1',
          userId: 'U200',
          sender: 'user',
          text: 'ข้อความทดสอบ',
          createdAt: 1000,
          status: 'sent',
        },
      ];

      storage.setCachedMessages('U200', mockMessages);
      expect(storage.getCachedMessages('U200')).toHaveLength(1);

      storage.removeCachedMessages('U200');
      expect(storage.getCachedMessages('U200')).toHaveLength(0);
    });
  });

  describe('Last Read Map', () => {
    it('should record and retrieve last read timestamps', () => {
      expect(storage.getLastReadMap()).toEqual({});

      storage.setLastReadTimestamp('U300', 99999);
      const map = storage.getLastReadMap();
      expect(map['U300']).toBe(99999);
    });
  });

  describe('Quick Replies Storage', () => {
    it('should return default quick replies if nothing is in storage', () => {
      const replies = storage.getQuickReplies();
      expect(replies.length).toBeGreaterThanOrEqual(4);
    });

    it('should persist and retrieve custom quick replies', () => {
      const custom = [{ id: 'qr_test', text: 'ยินดีต้อนรับครับ', createdAt: 1 }];
      storage.setQuickReplies(custom);
      expect(storage.getQuickReplies()).toEqual(custom);
    });

    it('should reset quick replies to defaults', () => {
      const custom = [{ id: 'qr_test', text: 'ยินดีต้อนรับครับ', createdAt: 1 }];
      storage.setQuickReplies(custom);
      expect(storage.getQuickReplies()).toHaveLength(1);

      const reset = storage.resetQuickReplies();
      expect(reset.length).toBeGreaterThanOrEqual(4);
      expect(storage.getQuickReplies().length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Theme Storage', () => {
    it('should default to dark theme when storage is empty', () => {
      expect(storage.getTheme()).toBe('dark');
    });

    it('should persist and retrieve light theme', () => {
      storage.setTheme('light');
      expect(storage.getTheme()).toBe('light');
    });

    it('should persist and retrieve dark theme', () => {
      storage.setTheme('dark');
      expect(storage.getTheme()).toBe('dark');
    });
  });
});

