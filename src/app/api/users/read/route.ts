import { NextRequest, NextResponse } from 'next/server';
import { markUserAsRead } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (userId) {
      markUserAsRead(userId);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
