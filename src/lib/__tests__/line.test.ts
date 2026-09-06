import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import {
  verifyLineSignature,
  getLineUserProfile,
  sendLinePushMessage,
  getLineMessageContent,
  sendLinePushImage,
} from '../line';

describe('LINE API Utility Module (src/lib/line.ts)', () => {
  const secret = 'test_channel_secret_12345';
  const token = 'test_access_token_abcdef';

  beforeEach(() => {
    vi.stubEnv('LINE_CHANNEL_SECRET', secret);
    vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', token);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('verifyLineSignature()', () => {
    it('should return true for a valid signature', () => {
      const body = JSON.stringify({ events: [{ type: 'message', message: { text: 'Hello' } }] });
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('base64');

      const result = verifyLineSignature(body, validSignature);
      expect(result).toBe(true);
    });

    it('should return false for an invalid signature', () => {
      const body = JSON.stringify({ events: [] });
      const invalidSignature = 'invalid_base64_signature==';

      const result = verifyLineSignature(body, invalidSignature);
      expect(result).toBe(false);
    });

    it('should return false if signature is missing or null', () => {
      const body = JSON.stringify({ events: [] });
      expect(verifyLineSignature(body, null)).toBe(false);
      expect(verifyLineSignature(body, '')).toBe(false);
    });

    it('should return false if body was tampered after signing', () => {
      const body = JSON.stringify({ text: 'original' });
      const signature = crypto.createHmac('sha256', secret).update(body).digest('base64');

      const tamperedBody = JSON.stringify({ text: 'tampered' });
      expect(verifyLineSignature(tamperedBody, signature)).toBe(false);
    });
  });

  describe('getLineUserProfile()', () => {
    it('should fetch and return LINE user profile details', async () => {
      const mockProfile = {
        displayName: 'John Doe',
        pictureUrl: 'https://profile.line-scdn.net/avatar.jpg',
        statusMessage: 'Hello World',
      };

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      } as any);

      const profile = await getLineUserProfile('U1234567890abcdef');
      expect(profile).toEqual(mockProfile);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/profile/U1234567890abcdef',
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      );
    });

    it('should return null when LINE profile API returns 404', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      } as any);

      const profile = await getLineUserProfile('U_nonexistent');
      expect(profile).toBeNull();
    });

    it('should return null if network error occurs', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network offline'));
      const profile = await getLineUserProfile('U12345');
      expect(profile).toBeNull();
    });
  });

  describe('sendLinePushMessage()', () => {
    it('should send push message to LINE and return success: true', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as any);

      const res = await sendLinePushMessage('U1234567890', 'สวัสดีครับ');
      expect(res.success).toBe(true);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          }),
          body: JSON.stringify({
            to: 'U1234567890',
            messages: [{ type: 'text', text: 'สวัสดีครับ' }],
          }),
        })
      );
    });

    it('should fail if userId or text is empty', async () => {
      const res1 = await sendLinePushMessage('', 'ข้อความ');
      expect(res1.success).toBe(false);

      const res2 = await sendLinePushMessage('U12345', '   ');
      expect(res2.success).toBe(false);
    });

    it('should return error details if LINE API returns non-200 error', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid user ID format',
      } as any);

      const res = await sendLinePushMessage('invalid_user', 'ข้อความ');
      expect(res.success).toBe(false);
      expect(res.error).toContain('400');
    });
  });

  describe('getLineMessageContent()', () => {
    it('should download and return buffer for messageId', async () => {
      const mockBytes = Buffer.from('mock_image_bytes');
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockBytes.buffer.slice(mockBytes.byteOffset, mockBytes.byteOffset + mockBytes.byteLength),
      } as any);

      const buffer = await getLineMessageContent('msg_img_123');
      expect(buffer).not.toBeNull();
      expect(buffer?.toString()).toBe('mock_image_bytes');
    });

    it('should return null if download fails', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      } as any);

      const buffer = await getLineMessageContent('msg_nonexistent');
      expect(buffer).toBeNull();
    });
  });

  describe('sendLinePushImage()', () => {
    it('should push image payload to LINE', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as any);

      const res = await sendLinePushImage('U12345', 'https://example.com/image.jpg');
      expect(res.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            to: 'U12345',
            messages: [
              {
                type: 'image',
                originalContentUrl: 'https://example.com/image.jpg',
                previewImageUrl: 'https://example.com/image.jpg',
              },
            ],
          }),
        })
      );
    });

    it('should reject missing userId or imageUrl', async () => {
      const res1 = await sendLinePushImage('', 'https://example.com/img.jpg');
      expect(res1.success).toBe(false);

      const res2 = await sendLinePushImage('U12345', '');
      expect(res2.success).toBe(false);
    });
  });
});
