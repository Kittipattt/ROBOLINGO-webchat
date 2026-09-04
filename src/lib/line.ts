import crypto from 'crypto';

const getChannelSecret = () => process.env.LINE_CHANNEL_SECRET || '';
const getChannelAccessToken = () => process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

/**
 * Verifies LINE webhook signature using HMAC-SHA256
 */
export function verifyLineSignature(body: string, signature: string | null): boolean {
  const secret = getChannelSecret();
  if (!secret || !signature) {
    console.warn('[LINE] Channel secret or signature missing');
    return false;
  }

  try {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('base64');

    const hashBuffer = Buffer.from(hash);
    const sigBuffer = Buffer.from(signature);

    if (hashBuffer.length !== sigBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, sigBuffer);
  } catch (error) {
    console.error('[LINE] Error verifying signature:', error);
    return false;
  }
}

/**
 * Fetch LINE user profile (display name, picture URL, status message)
 */
export async function getLineUserProfile(userId: string): Promise<{
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
} | null> {
  const token = getChannelAccessToken();
  if (!token || !userId) {
    return null;
  }

  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      // Avoid stale cache
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[LINE] Failed to fetch profile for ${userId}: ${res.status} - ${errText}`);
      return null;
    }

    const data = await res.json();
    return {
      displayName: data.displayName || 'LINE User',
      pictureUrl: data.pictureUrl,
      statusMessage: data.statusMessage,
    };
  } catch (error) {
    console.error(`[LINE] Network error fetching profile for ${userId}:`, error);
    return null;
  }
}

/**
 * Push text message to LINE User
 */
export async function sendLinePushMessage(userId: string, text: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const token = getChannelAccessToken();
  if (!token) {
    return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN is not configured' };
  }

  if (!userId || !text.trim()) {
    return { success: false, error: 'userId and text are required' };
  }

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: 'text',
            text: text.trim(),
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[LINE] Push message failed (${res.status}): ${errText}`);
      return { success: false, error: `LINE API returned ${res.status}: ${errText}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[LINE] Error sending push message:', error);
    return { success: false, error: error?.message || 'Network error sending push message' };
  }
}
