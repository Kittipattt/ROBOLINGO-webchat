import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

// Import Route Handlers
import { GET as getUsers } from '../users/route';
import { GET as getMessages, POST as postMessage } from '../messages/route';
import { POST as markRead } from '../users/read/route';
import { POST as postWebhook, GET as getWebhook } from '../line/webhook/route';

describe('API Route Handlers (src/app/api)', () => {
  const secret = 'test_secret_for_webhook_api';
  const token = 'test_token_for_push_api';

  beforeEach(() => {
    vi.stubEnv('LINE_CHANNEL_SECRET', secret);
    vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', token);
    vi.restoreAllMocks();
  });

  describe('GET /api/users', () => {
    it('should return 200 with users list', async () => {
      const res = await getUsers();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data.users)).toBe(true);
    });
  });

  describe('GET & POST /api/messages', () => {
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
  });
});
