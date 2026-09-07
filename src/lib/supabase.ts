import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LineUser, ChatMessage, QuickReplyTemplate } from './types';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

export function getSupabaseKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY
  );
}

/**
 * Check if Supabase credentials are configured in environment variables
 */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  return Boolean(url && key && url.startsWith('http'));
}

/**
 * Get singleton Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!cachedClient) {
    const url = getSupabaseUrl()!;
    const key = getSupabaseKey()!;
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return cachedClient;
}

/**
 * Upload an image buffer directly to Supabase Storage (bucket: chat-attachments)
 * and return the public permanent URL.
 */
export async function uploadImageToSupabase(
  buffer: Buffer,
  filename: string,
  contentType: string = 'image/jpeg'
): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const bucketName = 'chat-attachments';
    const { data, error } = await client.storage
      .from(bucketName)
      .upload(filename, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error('[Supabase Storage] Upload error:', error.message);
      return null;
    }

    const { data: publicUrlData } = client.storage
      .from(bucketName)
      .getPublicUrl(filename);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('[Supabase Storage] Unexpected upload failure:', err);
    return null;
  }
}

/**
 * Database Row Models
 */
export interface SupabaseUserRow {
  user_id: string;
  display_name: string;
  picture_url?: string | null;
  status_message?: string | null;
  last_message?: string | null;
  last_message_at: number;
  unread_count: number;
  last_sender?: 'user' | 'agent' | null;
}

export interface SupabaseMessageRow {
  id: string;
  user_id: string;
  sender: 'user' | 'agent';
  text?: string | null;
  image_url?: string | null;
  sticker_url?: string | null;
  package_id?: string | null;
  sticker_id?: string | null;
  message_type?: 'text' | 'image' | 'sticker' | null;
  created_at: number;
  status?: 'sending' | 'sent' | 'error' | null;
}

export interface SupabaseQuickReplyRow {
  id: string;
  text: string;
  category?: string | null;
  created_at?: number | null;
}

/**
 * Converters: Row <-> Domain Model
 */
export function rowToLineUser(row: SupabaseUserRow): LineUser {
  return {
    userId: row.user_id,
    displayName: row.display_name || 'LINE User',
    pictureUrl: row.picture_url || undefined,
    statusMessage: row.status_message || undefined,
    lastMessage: row.last_message || '',
    lastMessageAt: Number(row.last_message_at || 0),
    unreadCount: Number(row.unread_count || 0),
    lastSender: row.last_sender || 'user',
  };
}

export function lineUserToRow(user: LineUser): SupabaseUserRow {
  return {
    user_id: user.userId,
    display_name: user.displayName,
    picture_url: user.pictureUrl || null,
    status_message: user.statusMessage || null,
    last_message: user.lastMessage || '',
    last_message_at: user.lastMessageAt || 0,
    unread_count: user.unreadCount || 0,
    last_sender: user.lastSender || 'user',
  };
}

export function rowToChatMessage(row: SupabaseMessageRow): ChatMessage {
  return {
    id: row.id,
    userId: row.user_id,
    sender: row.sender,
    text: row.text || '',
    imageUrl: row.image_url || undefined,
    stickerUrl: row.sticker_url || undefined,
    packageId: row.package_id || undefined,
    stickerId: row.sticker_id || undefined,
    messageType: row.message_type || 'text',
    createdAt: Number(row.created_at || 0),
    status: row.status || 'sent',
  };
}

export function chatMessageToRow(msg: ChatMessage): SupabaseMessageRow {
  return {
    id: msg.id,
    user_id: msg.userId,
    sender: msg.sender,
    text: msg.text || '',
    image_url: msg.imageUrl || null,
    sticker_url: msg.stickerUrl || null,
    package_id: msg.packageId || null,
    sticker_id: msg.stickerId || null,
    message_type: msg.messageType || 'text',
    created_at: msg.createdAt,
    status: msg.status || 'sent',
  };
}

export function rowToQuickReply(row: SupabaseQuickReplyRow): QuickReplyTemplate {
  return {
    id: row.id,
    text: row.text,
    category: row.category || 'general',
    createdAt: Number(row.created_at || 0),
  };
}
