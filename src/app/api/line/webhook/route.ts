import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyLineSignature, getLineUserProfile, getLineMessageContent } from '@/lib/line';
import { addMessage, upsertUser, getUploadsDir } from '@/lib/db';
import { LineWebhookPayload } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-line-signature');

    // 1. Verify Webhook Signature
    const isValid = verifyLineSignature(rawBody, signature);
    if (!isValid) {
      console.warn('[Webhook] Invalid LINE signature rejected');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: LineWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const events = payload.events || [];
    console.log(`[Webhook] Received ${events.length} event(s)`);

    // Process each event
    for (const event of events) {
      // 1. Check if event has a user source
      const userId = event.source?.userId;
      if (!userId) continue;

      // 2. Handle Message Event (Text, Sticker, Image, Video, Audio, Location, File)
      if (event.type === 'message' && event.message) {
        const msg = event.message as Record<string, any>;
        let text = '';
        let imageUrl: string | undefined = undefined;
        let messageType: 'text' | 'image' = 'text';

        if (msg.type === 'text') {
          text = msg.text || '';
        } else if (msg.type === 'sticker') {
          text = '🏷️ [สติกเกอร์]';
        } else if (msg.type === 'image') {
          text = '📷 [รูปภาพ]';
          messageType = 'image';
          try {
            const imageBuffer = await getLineMessageContent(msg.id);
            if (imageBuffer) {
              const filename = `img_line_${msg.id}.jpg`;
              const uploadsDir = getUploadsDir();
              fs.writeFileSync(path.join(uploadsDir, filename), imageBuffer);
              imageUrl = `/api/images/${filename}`;
            }
          } catch (err) {
            console.error(`[Webhook] Error saving image content for message ${msg.id}:`, err);
          }
        } else if (msg.type === 'video') {
          text = '🎥 [วิดีโอ]';
        } else if (msg.type === 'audio') {
          text = '🎵 [ข้อความเสียง]';
        } else if (msg.type === 'location') {
          text = `📍 [ตำแหน่งที่ตั้ง] ${msg.title || msg.address || ''}`.trim();
        } else if (msg.type === 'file') {
          text = `📁 [ไฟล์] ${msg.fileName || ''}`.trim();
        } else {
          text = `[ข้อความ ${msg.type}]`;
        }

        // Fetch User Profile from LINE if not yet known or to update avatar/name
        const profile = await getLineUserProfile(userId);

        // Update/create user in DB
        upsertUser({
          userId,
          displayName: profile?.displayName,
          pictureUrl: profile?.pictureUrl,
          statusMessage: profile?.statusMessage,
          lastMessage: text,
          lastMessageAt: event.timestamp || Date.now(),
          incrementUnread: true,
        });

        // Add message to DB
        addMessage({
          userId,
          sender: 'user',
          text,
          imageUrl,
          messageType,
        });

        console.log(`[Webhook] Stored ${msg.type} message from ${profile?.displayName || userId}: "${text}"`);
      }

      // 3. Handle Follow Event (User adds OA as friend or unblocks)
      if (event.type === 'follow') {
        const profile = await getLineUserProfile(userId);
        upsertUser({
          userId,
          displayName: profile?.displayName,
          pictureUrl: profile?.pictureUrl,
          statusMessage: profile?.statusMessage,
          lastMessage: 'Added LINE OA as friend',
          lastMessageAt: event.timestamp || Date.now(),
        });
        console.log(`[Webhook] User followed: ${profile?.displayName || userId}`);
      }
    }

    // LINE requires 200 OK immediately
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error: any) {
    console.error('[Webhook] Internal error processing webhook:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    message: 'LINE Webhook endpoint is active and ready to receive events.',
    timestamp: new Date().toISOString(),
  });
}
