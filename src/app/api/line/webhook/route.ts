import { NextRequest, NextResponse } from 'next/server';
import { verifyLineSignature, getLineUserProfile } from '@/lib/line';
import { addMessage, upsertUser } from '@/lib/db';
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

      // 2. Handle Text Message Event
      if (event.type === 'message' && event.message?.type === 'text') {
        const text = event.message.text || '';

        // Fetch User Profile from LINE if not yet known or to update avatar/name
        const profile = await getLineUserProfile(userId);

        // Update/create user in DB
        upsertUser({
          userId,
          displayName: profile?.displayName || 'LINE User',
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
        });

        console.log(`[Webhook] Stored message from ${profile?.displayName || userId}: "${text}"`);
      }

      // 3. Handle Follow Event (User adds OA as friend)
      if (event.type === 'follow') {
        const profile = await getLineUserProfile(userId);
        upsertUser({
          userId,
          displayName: profile?.displayName || 'LINE User',
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
