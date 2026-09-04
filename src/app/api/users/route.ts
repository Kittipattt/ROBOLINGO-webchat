import { NextResponse } from 'next/server';
import { getAllUsers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = getAllUsers();
    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch users' }, { status: 500 });
  }
}
