import { NextRequest, NextResponse } from 'next/server';
import { addMessage, upsertUser } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId || `U_demo_${Math.random().toString(36).substring(2, 7)}`;
    const displayName = body.displayName || 'Test Customer';
    const text = body.text || 'สวัสดีครับ สอบถามข้อมูลบริการหน่อยครับ';
    const pictureUrl = body.pictureUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop';

    upsertUser({
      userId,
      displayName,
      pictureUrl,
      lastMessage: text,
      lastMessageAt: Date.now(),
      incrementUnread: true,
    });

    const msg = addMessage({
      userId,
      sender: 'user',
      text,
    });

    return NextResponse.json({ success: true, user: { userId, displayName }, message: msg });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
