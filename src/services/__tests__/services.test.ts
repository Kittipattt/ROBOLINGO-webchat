import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userService } from '../userService';
import { chatService } from '../chatService';
import { quickReplyService } from '../quickReplyService';

describe('Service Layer Unit Tests (src/services)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('userService', () => {
    it('fetchUsers should call /api/users and return user list', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [{ userId: 'U_1', displayName: 'Customer 1' }],
        }),
      } as any);

      const users = await userService.fetchUsers();
      expect(users).toHaveLength(1);
      expect(users[0].userId).toBe('U_1');
    });

    it('markUserAsRead should post to /api/users/read', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as any);

      const result = await userService.markUserAsRead('U_1');
      expect(result).toBe(true);
    });

    it('deleteUser should call DELETE /api/users', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, deleted: true }),
      } as any);

      const result = await userService.deleteUser('U_1');
      expect(result).toBe(true);
    });
  });

  describe('chatService', () => {
    it('fetchMessages should fetch and return messages for userId', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: 'm1', userId: 'U_1', text: 'Hello' }],
        }),
      } as any);

      const msgs = await chatService.fetchMessages('U_1');
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe('Hello');
    });

    it('sendMessage should POST message to /api/messages', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: { id: 'm2', userId: 'U_1', text: 'Reply', sender: 'agent' },
        }),
      } as any);

      const msg = await chatService.sendMessage('U_1', 'Reply');
      expect(msg.id).toBe('m2');
      expect(msg.sender).toBe('agent');
    });

    it('uploadImage should POST file to /api/upload and return url', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, url: '/api/images/img_123.jpg', filename: 'img_123.jpg' }),
      } as any);

      const file = new File(['mock_image'], 'photo.jpg', { type: 'image/jpeg' });
      const res = await chatService.uploadImage(file);
      expect(res.url).toBe('/api/images/img_123.jpg');
    });

    it('clearMessages should DELETE /api/messages', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, userId: 'U_1' }),
      } as any);

      const result = await chatService.clearMessages('U_1');
      expect(result).toBe(true);
    });
  });

  describe('quickReplyService', () => {
    it('fetchQuickReplies should return templates from server', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          quickReplies: [{ id: 'qr_1', text: 'สวัสดีครับ' }],
        }),
      } as any);

      const replies = await quickReplyService.fetchQuickReplies();
      expect(replies).toHaveLength(1);
      expect(replies[0].text).toBe('สวัสดีครับ');
    });

    it('saveQuickReplies should POST templates to /api/quick-replies', async () => {
      const payload = [{ id: 'qr_1', text: 'สวัสดีครับ', createdAt: 100 }];
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          quickReplies: payload,
        }),
      } as any);

      const saved = await quickReplyService.saveQuickReplies(payload);
      expect(saved).toEqual(payload);
    });
  });
});
