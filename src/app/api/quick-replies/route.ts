import { NextRequest, NextResponse } from 'next/server';
import { getDbQuickReplies, saveDbQuickReplies } from '@/lib/db';
import { QuickReplyTemplate } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const quickReplies = getDbQuickReplies();
    return NextResponse.json(
      { quickReplies },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch quick replies' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quickReplies } = body;

    if (!Array.isArray(quickReplies)) {
      return NextResponse.json(
        { error: 'quickReplies array is required' },
        { status: 400 }
      );
    }

    // Clean and validate
    const validated: QuickReplyTemplate[] = quickReplies
      .filter((item: any) => item && typeof item.text === 'string' && item.text.trim())
      .map((item: any, idx: number) => ({
        id: item.id || `qr_${Date.now()}_${idx}`,
        text: item.text.trim(),
        createdAt: item.createdAt || Date.now(),
      }));

    const saved = saveDbQuickReplies(validated);
    return NextResponse.json({ success: true, quickReplies: saved });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to save quick replies' },
      { status: 500 }
    );
  }
}
