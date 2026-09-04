import { NextRequest, NextResponse } from 'next/server';
import { getMessages, addMessage } from '@/lib/db';
import { sendLinePushMessage } from '@/lib/line';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || undefined;

    const messages = getMessages(userId);
    return NextResponse.json({ messages });
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

    // 1. Send Push message to LINE user (skip external LINE API for local simulation users)
    const isSimulatedUser = userId.startsWith('U_demo_') || userId.startsWith('test_');
    
    if (!isSimulatedUser) {
      const pushResult = await sendLinePushMessage(userId, text.trim());
      if (!pushResult.success) {
        console.error('[Messages API] Push error:', pushResult.error);
        return NextResponse.json(
          { error: pushResult.error || 'Failed to send message to LINE' },
          { status: 502 }
        );
      }
    } else {
      console.log(`[Messages API] Simulated user ${userId}: bypassed real LINE push`);
    }

    // 2. Save outbound message in DB
    const message = addMessage({
      userId,
      sender: 'agent',
      text: text.trim(),
    });

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('[Messages API] Internal error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
