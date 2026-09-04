import { NextResponse } from 'next/server';
import { getAllUsers, upsertUser } from '@/lib/db';
import { getLineUserProfile } from '@/lib/line';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = getAllUsers();

    // Auto-enrich any user who has 'LINE User' or missing profile details
    const enrichedUsers = await Promise.all(
      users.map(async (u) => {
        if (
          (!u.displayName || u.displayName === 'LINE User' || !u.pictureUrl) &&
          u.userId.startsWith('U') &&
          !u.userId.includes('test')
        ) {
          try {
            const profile = await getLineUserProfile(u.userId);
            if (profile?.displayName && profile.displayName !== 'LINE User') {
              return upsertUser({
                userId: u.userId,
                displayName: profile.displayName,
                pictureUrl: profile.pictureUrl,
                statusMessage: profile.statusMessage,
                lastMessage: u.lastMessage,
                lastMessageAt: u.lastMessageAt,
              });
            }
          } catch {
            // Keep existing user if network fails
          }
        }
        return u;
      })
    );

    return NextResponse.json(
      { users: enrichedUsers },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch users' }, { status: 500 });
  }
}
