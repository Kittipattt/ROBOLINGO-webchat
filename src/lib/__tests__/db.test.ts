import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getAllUsers,
  getUserById,
  upsertUser,
  markUserAsRead,
  addMessage,
  getMessages,
  clearUserMessages,
  deleteUser,
  clearDatabase,
} from '../db';

describe('Database & Persistence Module (src/lib/db.ts)', () => {
  const testDataDir = path.join(process.cwd(), 'data-test');

  beforeEach(() => {
    process.env.DATA_DIR = testDataDir;
    clearDatabase();
  });

  afterEach(() => {
    clearDatabase();
    delete process.env.DATA_DIR;
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('User Management', () => {
    it('should upsert a new LINE user profile', () => {
      const user = upsertUser({
        userId: 'U111',
        displayName: 'Somchai',
        pictureUrl: 'https://example.com/pic.jpg',
        lastMessage: 'สวัสดีครับ',
      });

      expect(user.userId).toBe('U111');
      expect(user.displayName).toBe('Somchai');
      expect(user.unreadCount).toBe(0);

      const fetched = getUserById('U111');
      expect(fetched?.displayName).toBe('Somchai');
    });

    it('should increment unread count when incrementUnread is true', () => {
      upsertUser({
        userId: 'U222',
        displayName: 'Kittipat',
        incrementUnread: true,
      });

      let user = getUserById('U222');
      expect(user?.unreadCount).toBe(1);

      upsertUser({
        userId: 'U222',
        incrementUnread: true,
      });

      user = getUserById('U222');
      expect(user?.unreadCount).toBe(2);
    });

    it('should reset unread count when marked as read', () => {
      upsertUser({
        userId: 'U333',
        displayName: 'Alice',
        incrementUnread: true,
      });

      markUserAsRead('U333');
      const user = getUserById('U333');
      expect(user?.unreadCount).toBe(0);
    });

    it('should sort users by lastMessageAt descending', () => {
      upsertUser({
        userId: 'U_old',
        displayName: 'Old User',
        lastMessageAt: 1000,
      });

      upsertUser({
        userId: 'U_new',
        displayName: 'New User',
        lastMessageAt: 2000,
      });

      const users = getAllUsers();
      expect(users[0].userId).toBe('U_new');
      expect(users[1].userId).toBe('U_old');
    });

    it('should never downgrade an existing real displayName to LINE User', () => {
      upsertUser({
        userId: 'U_jajah',
        displayName: 'Ja_jah 🏢',
        pictureUrl: 'https://example.com/avatar.jpg',
      });

      // Subsequent update with missing or default 'LINE User' displayName
      const updated = upsertUser({
        userId: 'U_jajah',
        displayName: 'LINE User',
        lastMessage: 'ขอซื้ออโวคาโด้',
      });

      expect(updated.displayName).toBe('Ja_jah 🏢');
      expect(updated.pictureUrl).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('Message Management', () => {
    it('should store and retrieve messages by userId', () => {
      const msg1 = addMessage({
        userId: 'U444',
        sender: 'user',
        text: 'ข้อความจากผู้ใช้',
      });

      const msg2 = addMessage({
        userId: 'U444',
        sender: 'agent',
        text: 'ข้อความตอบกลับจากแอดมิน',
      });

      const conversation = getMessages('U444');
      expect(conversation).toHaveLength(2);
      expect(conversation[0].text).toBe('ข้อความจากผู้ใช้');
      expect(conversation[1].text).toBe('ข้อความตอบกลับจากแอดมิน');
    });

    it('should update user lastMessage and lastMessageAt when message is added', () => {
      addMessage({
        userId: 'U555',
        sender: 'user',
        text: 'ข้อความล่าสุด',
      });

      const user = getUserById('U555');
      expect(user).not.toBeNull();
      expect(user?.lastMessage).toBe('ข้อความล่าสุด');
      expect(user?.unreadCount).toBe(1); // User message increments unread
    });
  });

  describe('Conversation & User Deletion', () => {
    it('clearUserMessages should remove all messages for a user and reset lastMessage to empty', () => {
      upsertUser({
        userId: 'U_clear_test',
        displayName: 'Target User',
        lastMessage: 'ก่อนล้าง',
        incrementUnread: true,
      });

      addMessage({
        userId: 'U_clear_test',
        sender: 'user',
        text: 'ข้อความที่จะถูกลบ',
      });

      expect(getMessages('U_clear_test')).toHaveLength(1);

      clearUserMessages('U_clear_test');

      expect(getMessages('U_clear_test')).toHaveLength(0);
      const user = getUserById('U_clear_test');
      expect(user).not.toBeNull();
      expect(user?.lastMessage).toBe('');
      expect(user?.unreadCount).toBe(0);
    });

    it('deleteUser should remove both user profile and all associated messages', () => {
      upsertUser({
        userId: 'U_delete_test',
        displayName: 'User to Delete',
      });

      addMessage({
        userId: 'U_delete_test',
        sender: 'user',
        text: 'ข้อความของผู้ใช้ที่จะถูกลบ',
      });

      expect(getUserById('U_delete_test')).not.toBeNull();
      expect(getMessages('U_delete_test')).toHaveLength(1);

      const deleted = deleteUser('U_delete_test');
      expect(deleted).toBe(true);

      expect(getUserById('U_delete_test')).toBeNull();
      expect(getMessages('U_delete_test')).toHaveLength(0);
      expect(getAllUsers().some((u) => u.userId === 'U_delete_test')).toBe(false);
    });
  });
});
