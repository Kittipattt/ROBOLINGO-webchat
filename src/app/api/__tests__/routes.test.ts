import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

// Import Route Handlers
import { GET as getUsers, DELETE as deleteUserApi } from '../users/route';
import { GET as getMessages, POST as postMessage, DELETE as deleteMessagesApi } from '../messages/route';
import { POST as markRead } from '../users/read/route';
import { POST as postWebhook, GET as getWebhook } from '../line/webhook/route';
import { GET as getQuickRepliesApi, POST as postQuickRepliesApi } from '../quick-replies/route';
import { POST as uploadApi } from '../upload/route';
import { GET as getImageApi } from '../images/[filename]/route';

describe('API Route Handlers (src/app/api)', () => {
  const secret = 'test_secret_for_webhook_api';
  const token = 'test_token_for_push_api';

  beforeEach(() => {
    vi.stubEnv('LINE_CHANNEL_SECRET', secret);
    vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', token);
    vi.restoreAllMocks();
  });

  describe('GET & DELETE /api/users', () => {
    it('should return 200 with users list', async () => {
      const res = await getUsers();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data.users)).toBe(true);
    });

    it('DELETE /api/users should reject missing userId with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/users');
      const res = await deleteUserApi(req);
      expect(res.status).toBe(400);
    });

    it('DELETE /api/users should successfully delete user with 200', async () => {
      const req = new NextRequest('http://localhost:3000/api/users?userId=U_to_delete');
      const res = await deleteUserApi(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.userId).toBe('U_to_delete');
    });
  });

  describe('GET, POST & DELETE /api/messages', () => {
    it('GET /api/messages should return list of messages', async () => {
      const req = new NextRequest('http://localhost:3000/api/messages?userId=U_test');
      const res = await getMessages(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data.messages)).toBe(true);
    });

    it('POST /api/messages should reject missing userId or text with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/messages', {
        method: 'POST',
        body: JSON.stringify({ userId: '', text: '' }),
      });

      const res = await postMessage(req);
      expect(res.status).toBe(400);
    });

    it('POST /api/messages should send LINE message and return 200 on success', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/messages', {
        method: 'POST',
        body: JSON.stringify({ userId: 'U_client_1', text: 'สวัสดีครับ ยินดีให้บริการ' }),
      });

      const res = await postMessage(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message.text).toBe('สวัสดีครับ ยินดีให้บริการ');
    });

    it('POST /api/messages should support sending image messages', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'U_client_1',
          text: 'นี่คือใบเสร็จครับ',
          imageUrl: 'https://example.com/slip.jpg',
          messageType: 'image',
        }),
      });

      const res = await postMessage(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message.imageUrl).toBe('https://example.com/slip.jpg');
      expect(data.message.messageType).toBe('image');
    });

    it('DELETE /api/messages should reject missing userId with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/messages');
      const res = await deleteMessagesApi(req);
      expect(res.status).toBe(400);
    });

    it('DELETE /api/messages should clear messages and return 200', async () => {
      const req = new NextRequest('http://localhost:3000/api/messages?userId=U_client_1');
      const res = await deleteMessagesApi(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.userId).toBe('U_client_1');
    });
  });

  describe('POST /api/users/read', () => {
    it('should return 200 on marking user read', async () => {
      const req = new NextRequest('http://localhost:3000/api/users/read', {
        method: 'POST',
        body: JSON.stringify({ userId: 'U_client_1' }),
      });

      const res = await markRead(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('LINE Webhook Endpoint (/api/line/webhook)', () => {
    it('GET /api/line/webhook should return online status', async () => {
      const res = await getWebhook();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('online');
    });

    it('POST /api/line/webhook should reject invalid signature with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/line/webhook', {
        method: 'POST',
        headers: {
          'x-line-signature': 'invalid_signature',
        },
        body: JSON.stringify({ events: [] }),
      });

      const res = await postWebhook(req);
      expect(res.status).toBe(401);
    });

    it('POST /api/line/webhook should accept valid event and return 200', async () => {
      const payload = {
        events: [
          {
            type: 'message',
            timestamp: Date.now(),
            source: { type: 'user', userId: 'U_webhook_test' },
            message: { id: '1', type: 'text', text: 'ข้อความทดสอบจาก LINE' },
          },
        ],
      };
      const rawBody = JSON.stringify(payload);
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('base64');

      // Mock LINE profile API
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          displayName: 'LINE Customer',
          pictureUrl: 'https://example.com/line.jpg',
        }),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/line/webhook', {
        method: 'POST',
        headers: {
          'x-line-signature': validSignature,
        },
        body: rawBody,
      });

      const res = await postWebhook(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('ok');
    });

    it('POST /api/line/webhook should accept sticker events and record [สติกเกอร์]', async () => {
      const payload = {
        events: [
          {
            type: 'message',
            timestamp: Date.now(),
            source: { type: 'user', userId: 'U_webhook_sticker_test' },
            message: { id: '2', type: 'sticker', packageId: '1', stickerId: '1' },
          },
        ],
      };
      const rawBody = JSON.stringify(payload);
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('base64');

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          displayName: 'Sticker User',
        }),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/line/webhook', {
        method: 'POST',
        headers: {
          'x-line-signature': validSignature,
        },
        body: rawBody,
      });

      const res = await postWebhook(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('ok');
    });

    it('POST /api/line/webhook should handle image message events by downloading image', async () => {
      const payload = {
        events: [
          {
            type: 'message',
            timestamp: Date.now(),
            source: { type: 'user', userId: 'U_webhook_image_test' },
            message: { id: 'img_webhook_999', type: 'image' },
          },
        ],
      };
      const rawBody = JSON.stringify(payload);
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('base64');

      const mockContent = Buffer.from('fake-line-image-data');
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockContent.buffer.slice(mockContent.byteOffset, mockContent.byteOffset + mockContent.byteLength),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            displayName: 'Image Sender',
          }),
        } as any);

      const req = new NextRequest('http://localhost:3000/api/line/webhook', {
        method: 'POST',
        headers: {
          'x-line-signature': validSignature,
        },
        body: rawBody,
      });

      const res = await postWebhook(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('ok');
    });
  });

  describe('GET & POST /api/quick-replies', () => {
    it('GET /api/quick-replies should return quick replies list with 200', async () => {
      const res = await getQuickRepliesApi();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data.quickReplies)).toBe(true);
      expect(data.quickReplies.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/quick-replies should reject non-array payload with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/quick-replies', {
        method: 'POST',
        body: JSON.stringify({ quickReplies: 'invalid' }),
      });

      const res = await postQuickRepliesApi(req);
      expect(res.status).toBe(400);
    });

    it('POST /api/quick-replies should save valid quick replies with 200', async () => {
      const payload = {
        quickReplies: [
          { id: 'qr_test_1', text: 'ยินดีให้บริการตลอด 24 ชม. ครับ' },
        ],
      };

      const req = new NextRequest('http://localhost:3000/api/quick-replies', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const res = await postQuickRepliesApi(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.quickReplies).toHaveLength(1);
      expect(data.quickReplies[0].text).toBe('ยินดีให้บริการตลอด 24 ชม. ครับ');
    });
  });

  describe('POST /api/upload', () => {
    it('should reject missing file with 400', async () => {
      const formData = new FormData();
      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadApi(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('No file uploaded');
    });

    it('should reject unsupported mime type with 400', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test-text'], { type: 'text/plain' }), 'test.txt');

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadApi(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Unsupported file type');
    });

    it('should successfully save valid image and return URL with 200', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([Buffer.from('fake-png-content')], { type: 'image/png' }),
        'sample.png'
      );

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadApi(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.url).toMatch(/^\/api\/images\/img_\d+_[a-f0-9]+\.png$/);
      expect(data.mimeType).toBe('image/png');
    });
  });

  describe('GET /api/images/[filename]', () => {
    it('should reject path traversal attempts with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/images/..%2Fsecret.txt');
      const res = await getImageApi(req, {
        params: Promise.resolve({ filename: '../secret.txt' }),
      });
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent image', async () => {
      const req = new NextRequest('http://localhost:3000/api/images/missing_image_12345.png');
      const res = await getImageApi(req, {
        params: Promise.resolve({ filename: 'missing_image_12345.png' }),
      });
      expect(res.status).toBe(404);
    });

    it('should serve uploaded image with 200 and correct content-type', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([Buffer.from('fake-png-content-for-serving')], { type: 'image/png' }),
        'test_serve.png'
      );

      const uploadReq = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadRes = await uploadApi(uploadReq);
      const uploadData = await uploadRes.json();
      expect(uploadData.filename).toBeDefined();

      const getReq = new NextRequest(`http://localhost:3000/api/images/${uploadData.filename}`);
      const getRes = await getImageApi(getReq, {
        params: Promise.resolve({ filename: uploadData.filename }),
      });

      expect(getRes.status).toBe(200);
      expect(getRes.headers.get('content-type')).toBe('image/png');
      expect(getRes.headers.get('cache-control')).toContain('immutable');
    });
  });
});
