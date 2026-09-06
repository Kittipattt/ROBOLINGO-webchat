import { LineUser, ChatMessage, QuickReplyTemplate, DEFAULT_QUICK_REPLIES } from './types';

/**
 * Storage Layer
 * Provides SSR-safe and fault-tolerant local storage helpers.
 */

const USERS_CACHE_KEY = 'webchat_users_cache';
const MSGS_CACHE_PREFIX = 'webchat_msgs_';
const LAST_READ_MAP_KEY = 'webchat_last_read_map';
const QUICK_REPLIES_KEY = 'webchat_quick_replies';

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export const storage = {
  /**
   * Get cached user list from localStorage
   */
  getCachedUsers(): LineUser[] {
    if (!isClient()) return [];
    try {
      const raw = localStorage.getItem(USERS_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /**
   * Persist user list into localStorage
   */
  setCachedUsers(users: LineUser[]): void {
    if (!isClient()) return;
    try {
      localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(users));
    } catch {
      // Storage quota or restriction
    }
  },

  /**
   * Get cached messages for a specific user
   */
  getCachedMessages(userId: string): ChatMessage[] {
    if (!isClient() || !userId) return [];
    try {
      const raw = localStorage.getItem(`${MSGS_CACHE_PREFIX}${userId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((m: ChatMessage) => m.userId === userId);
      }
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Persist messages for a specific user
   */
  setCachedMessages(userId: string, messages: ChatMessage[]): void {
    if (!isClient() || !userId) return;
    try {
      const filtered = messages.filter((m) => m.userId === userId);
      localStorage.setItem(`${MSGS_CACHE_PREFIX}${userId}`, JSON.stringify(filtered));
    } catch {
      // Storage quota or restriction
    }
  },

  /**
   * Remove cached messages for a user (used upon clearing/deleting chat)
   */
  removeCachedMessages(userId: string): void {
    if (!isClient() || !userId) return;
    try {
      localStorage.removeItem(`${MSGS_CACHE_PREFIX}${userId}`);
    } catch {
      // Storage restriction
    }
  },

  /**
   * Retrieve the map of user last-read timestamps
   */
  getLastReadMap(): Record<string, number> {
    if (!isClient()) return {};
    try {
      const raw = localStorage.getItem(LAST_READ_MAP_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  },

  /**
   * Update the last-read timestamp for a specific user
   */
  setLastReadTimestamp(userId: string, timestamp: number): Record<string, number> {
    const current = this.getLastReadMap();
    current[userId] = timestamp;
    if (isClient()) {
      try {
        localStorage.setItem(LAST_READ_MAP_KEY, JSON.stringify(current));
      } catch {}
    }
    return current;
  },

  /**
   * Get cached quick replies or return default templates
   */
  getQuickReplies(): QuickReplyTemplate[] {
    if (!isClient()) return DEFAULT_QUICK_REPLIES;
    try {
      const raw = localStorage.getItem(QUICK_REPLIES_KEY);
      if (!raw) return DEFAULT_QUICK_REPLIES;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return DEFAULT_QUICK_REPLIES;
    } catch {
      return DEFAULT_QUICK_REPLIES;
    }
  },

  /**
   * Persist custom quick replies
   */
  setQuickReplies(replies: QuickReplyTemplate[]): void {
    if (!isClient()) return;
    try {
      localStorage.setItem(QUICK_REPLIES_KEY, JSON.stringify(replies));
    } catch {
      // Storage quota or restriction
    }
  },

  /**
   * Reset quick replies to default templates
   */
  resetQuickReplies(): QuickReplyTemplate[] {
    if (isClient()) {
      try {
        localStorage.setItem(QUICK_REPLIES_KEY, JSON.stringify(DEFAULT_QUICK_REPLIES));
      } catch {}
    }
    return DEFAULT_QUICK_REPLIES;
  },
};
