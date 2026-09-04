import { NextRequest, NextResponse } from 'next/server';
import { getMessages, addMessage, getUserById, upsertUser } from '@/lib/db';
import { sendLinePushMessage, getLineUserProfile } from '@/lib/line';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || undefined;

    const messages = getMessages(userId);
    return NextResponse.json(
      { messages },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, text } = body;

    if (!userId || !text || !text.trim()) {
      return NextResponse.json({ error: 'userId and text are required' }, { status: 400 });
    }

    // 1. Send Push message to LINE user via LINE Messaging API
    const pushResult = await sendLinePushMessage(userId, text.trim());
    if (!pushResult.success) {
      console.error('[Messages API] Push error:', pushResult.error);
      return NextResponse.json(
        { error: pushResult.error || 'Failed to send message to LINE' },
        { status: 502 }
      );
    }

    // 2. Save outbound message in DB
    const message = addMessage({
      userId,
      sender: 'agent',
      text: text.trim(),
    });

    // 3. Ensure profile is enriched if previously unknown or generic
    const existingUser = getUserById(userId);
    if (
      (!existingUser || existingUser.displayName === 'LINE User' || !existingUser.pictureUrl) &&
      userId.startsWith('U') &&
      !userId.includes('test')
    ) {
      try {
        const profile = await getLineUserProfile(userId);
        if (profile?.displayName && profile.displayName !== 'LINE User') {
          upsertUser({
            userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
            statusMessage: profile.statusMessage,
          });
        }
      } catch {}
    }

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('[Messages API] Internal error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
