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
  getDbQuickReplies,
  saveDbQuickReplies,
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
    it('should upsert a new LINE user profile', async () => {
      const user = await upsertUser({
        userId: 'U111',
        displayName: 'Somchai',
        pictureUrl: 'https://example.com/pic.jpg',
        lastMessage: 'สวัสดีครับ',
      });

      expect(user.userId).toBe('U111');
      expect(user.displayName).toBe('Somchai');
      expect(user.unreadCount).toBe(0);

      const fetched = await getUserById('U111');
      expect(fetched?.displayName).toBe('Somchai');
    });

    it('should increment unread count when incrementUnread is true', async () => {
      await upsertUser({
        userId: 'U222',
        displayName: 'Kittipat',
        incrementUnread: true,
      });

      let user = await getUserById('U222');
      expect(user?.unreadCount).toBe(1);

      await upsertUser({
        userId: 'U222',
        incrementUnread: true,
      });

      user = await getUserById('U222');
      expect(user?.unreadCount).toBe(2);
    });

    it('should reset unread count when marked as read', async () => {
      await upsertUser({
        userId: 'U333',
        displayName: 'Alice',
        incrementUnread: true,
      });

      await markUserAsRead('U333');
      const user = await getUserById('U333');
      expect(user?.unreadCount).toBe(0);
    });

    it('should sort users by lastMessageAt descending', async () => {
      await upsertUser({
        userId: 'U_old',
        displayName: 'Old User',
        lastMessageAt: 1000,
      });

      await upsertUser({
        userId: 'U_new',
        displayName: 'New User',
        lastMessageAt: 2000,
      });

      const users = await getAllUsers();
      expect(users[0].userId).toBe('U_new');
      expect(users[1].userId).toBe('U_old');
    });

    it('should never downgrade an existing real displayName to LINE User', async () => {
      await upsertUser({
        userId: 'U_jajah',
        displayName: 'Ja_jah 🏢',
        pictureUrl: 'https://example.com/avatar.jpg',
      });

      // Subsequent update with missing or default 'LINE User' displayName
      const updated = await upsertUser({
        userId: 'U_jajah',
        displayName: 'LINE User',
        lastMessage: 'ขอซื้ออโวคาโด้',
      });

      expect(updated.displayName).toBe('Ja_jah 🏢');
      expect(updated.pictureUrl).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('Message Management', () => {
    it('should store and retrieve messages by userId', async () => {
      await addMessage({
        userId: 'U444',
        sender: 'user',
        text: 'ข้อความจากผู้ใช้',
      });

      await addMessage({
        userId: 'U444',
        sender: 'agent',
        text: 'ข้อความตอบกลับจากแอดมิน',
      });

      const conversation = await getMessages('U444');
      expect(conversation).toHaveLength(2);
      expect(conversation[0].text).toBe('ข้อความจากผู้ใช้');
      expect(conversation[1].text).toBe('ข้อความตอบกลับจากแอดมิน');
    });

    it('should update user lastMessage and lastMessageAt when message is added', async () => {
      await addMessage({
        userId: 'U555',
        sender: 'user',
        text: 'ข้อความล่าสุด',
      });

      const user = await getUserById('U555');
      expect(user).not.toBeNull();
      expect(user?.lastMessage).toBe('ข้อความล่าสุด');
      expect(user?.unreadCount).toBe(1); // User message increments unread
    });

    it('should store and retrieve image messages with imageUrl and messageType', async () => {
      const msg = await addMessage({
        userId: 'U666',
        sender: 'user',
        text: '',
        imageUrl: '/api/images/img_test.jpg',
        messageType: 'image',
      });

      expect(msg.imageUrl).toBe('/api/images/img_test.jpg');
      expect(msg.messageType).toBe('image');
      expect(msg.text).toBe('📷 [รูปภาพ]');

      const user = await getUserById('U666');
      expect(user?.lastMessage).toBe('📷 [รูปภาพ]');
    });

    it('should store and retrieve sticker messages with stickerUrl, packageId, and stickerId', async () => {
      const msg = await addMessage({
        userId: 'U777',
        sender: 'user',
        text: '',
        stickerUrl: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002734/android/sticker.png',
        packageId: '11537',
        stickerId: '52002734',
        messageType: 'sticker',
      });

      expect(msg.stickerUrl).toBe('https://stickershop.line-scdn.net/stickershop/v1/sticker/52002734/android/sticker.png');
      expect(msg.packageId).toBe('11537');
      expect(msg.stickerId).toBe('52002734');
      expect(msg.messageType).toBe('sticker');
      expect(msg.text).toBe('🏷️ [สติกเกอร์]');

      const user = await getUserById('U777');
      expect(user?.lastMessage).toBe('🏷️ [สติกเกอร์]');
    });
  });

  describe('Conversation & User Deletion', () => {
    it('clearUserMessages should remove all messages for a user and reset lastMessage to empty', async () => {
      await upsertUser({
        userId: 'U_clear_test',
        displayName: 'Target User',
        lastMessage: 'ก่อนล้าง',
        incrementUnread: true,
      });

      await addMessage({
        userId: 'U_clear_test',
        sender: 'user',
        text: 'ข้อความที่จะถูกลบ',
      });

      expect(await getMessages('U_clear_test')).toHaveLength(1);

      await clearUserMessages('U_clear_test');

      expect(await getMessages('U_clear_test')).toHaveLength(0);
      const user = await getUserById('U_clear_test');
      expect(user).not.toBeNull();
      expect(user?.lastMessage).toBe('');
      expect(user?.unreadCount).toBe(0);
    });

    it('deleteUser should remove both user profile and all associated messages', async () => {
      await upsertUser({
        userId: 'U_delete_test',
        displayName: 'User to Delete',
      });

      await addMessage({
        userId: 'U_delete_test',
        sender: 'user',
        text: 'ข้อความของผู้ใช้ที่จะถูกลบ',
      });

      expect(await getUserById('U_delete_test')).not.toBeNull();
      expect(await getMessages('U_delete_test')).toHaveLength(1);

      const deleted = await deleteUser('U_delete_test');
      expect(deleted).toBe(true);

      expect(await getUserById('U_delete_test')).toBeNull();
      expect(await getMessages('U_delete_test')).toHaveLength(0);
      const allUsers = await getAllUsers();
      expect(allUsers.some((u) => u.userId === 'U_delete_test')).toBe(false);
    });
  });

  describe('Quick Reply Templates Management', () => {
    it('should return default quick replies when database is empty', async () => {
      const replies = await getDbQuickReplies();
      expect(replies.length).toBeGreaterThanOrEqual(4);
      expect(replies[0].text).toContain('สวัสดีครับ');
    });

    it('should save and retrieve custom quick reply templates', async () => {
      const customReplies = [
        { id: 'custom_1', text: 'พร้อมส่งสินค้าทันทีครับ 📦', createdAt: 12345 },
      ];

      await saveDbQuickReplies(customReplies);
      const fetched = await getDbQuickReplies();
      expect(fetched).toHaveLength(1);
      expect(fetched[0].text).toBe('พร้อมส่งสินค้าทันทีครับ 📦');
    });
  });
});
