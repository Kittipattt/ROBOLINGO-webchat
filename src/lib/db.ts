import fs from 'fs';
import path from 'path';
import { LineUser, ChatMessage, QuickReplyTemplate, DEFAULT_QUICK_REPLIES } from './types';
import {
  isSupabaseConfigured,
  getSupabaseClient,
  rowToLineUser,
  lineUserToRow,
  rowToChatMessage,
  chatMessageToRow,
  rowToQuickReply,
} from './supabase';

interface DatabaseSchema {
  users: Record<string, LineUser>;
  messages: ChatMessage[];
  quickReplies?: QuickReplyTemplate[];
}

// In-memory fallback / cache
let memoryStore: DatabaseSchema = {
  users: {},
  messages: [],
  quickReplies: DEFAULT_QUICK_REPLIES,
};

// Determine storage path (Local ./data/db.json, or /tmp/webchat-db.json for serverless)
function getDbFilePath(): string {
  if (process.env.NODE_ENV === 'production' && !process.env.DATA_DIR) {
    return path.join('/tmp', 'webchat-db.json');
  }
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  return path.join(dataDir, 'db.json');
}

function loadDatabase(): DatabaseSchema {
  try {
    const filePath = getDbFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      memoryStore = {
        users: parsed.users || {},
        messages: parsed.messages || [],
        quickReplies: parsed.quickReplies || DEFAULT_QUICK_REPLIES,
      };
      return memoryStore;
    }
  } catch (error) {
    console.warn('[DB] Failed to read db from file, using in-memory store:', error);
  }
  return memoryStore;
}

function saveDatabase(data: DatabaseSchema): void {
  memoryStore = data;
  try {
    const filePath = getDbFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.warn('[DB] Failed to save db to file (in-memory remains active):', error);
  }
}

// Initialize on load
loadDatabase();

/**
 * Get all users sorted by most recent activity
 */
export async function getAllUsers(): Promise<LineUser[]> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient()!;
      const { data, error } = await client
        .from('users')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (!error && data) {
        return data.map(rowToLineUser);
      }
      console.error('[Supabase] Failed to fetch users, falling back to local:', error?.message);
    } catch (err) {
      console.error('[Supabase] Exception fetching users:', err);
    }
  }

  const db = loadDatabase();
  return Object.values(db.users).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

/**
 * Get a specific user by LINE userId
 */
export async function getUserById(userId: string): Promise<LineUser | null> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient()!;
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        return rowToLineUser(data);
      }
    } catch (err) {
      console.error('[Supabase] Exception fetching user by ID:', err);
    }
  }

  const db = loadDatabase();
  return db.users[userId] || null;
}

/**
 * Upsert a LINE user's profile and update timestamp
 */
export async function upsertUser(data: {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
  statusMessage?: string;
  lastMessage?: string;
  lastMessageAt?: number;
  incrementUnread?: boolean;
  resetUnread?: boolean;
  lastSender?: 'user' | 'agent';
}): Promise<LineUser> {
  const db = loadDatabase();
  let existing = db.users[data.userId];

  // If Supabase is active, try reading existing user to preserve real displayName
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient()!;
      const { data: dbRow } = await client
        .from('users')
        .select('*')
        .eq('user_id', data.userId)
        .maybeSingle();
      if (dbRow) {
        existing = rowToLineUser(dbRow);
      }
    } catch {
      // ignore
    }
  }

  const now = Date.now();

  // Preserve real displayName! Never downgrade to 'LINE User' if we already know the real name.
  let displayName = data.displayName;
  if (!displayName || displayName === 'LINE User') {
    displayName =
      existing?.displayName && existing.displayName !== 'LINE User'
        ? existing.displayName
        : displayName || 'LINE User';
  }

  // Monotonic timestamp protection: never allow an older lastMessage to overwrite a newer one
  let lastMessage = data.lastMessage && data.lastMessage.trim() ? data.lastMessage : (existing?.lastMessage || '');
  let lastMessageAt = data.lastMessageAt ?? (existing?.lastMessageAt || now);
  if (existing?.lastMessageAt && (data.lastMessageAt || 0) < existing.lastMessageAt) {
    if (existing.lastMessage && existing.lastMessage.trim()) {
      lastMessage = existing.lastMessage;
    }
    lastMessageAt = existing.lastMessageAt;
  }

  const unreadCount = data.resetUnread
    ? 0
    : data.incrementUnread
    ? (existing?.unreadCount || 0) + 1
    : (existing?.unreadCount ?? 0);

  const updatedUser: LineUser = {
    userId: data.userId,
    displayName,
    pictureUrl: data.pictureUrl ?? existing?.pictureUrl,
    statusMessage: data.statusMessage ?? existing?.statusMessage,
    lastMessage,
    lastMessageAt,
    unreadCount,
    lastSender: data.lastSender ?? existing?.lastSender,
  };

  // 1. Sync to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient()!;
      const row = lineUserToRow(updatedUser);
      const { error } = await client.from('users').upsert(row);
      if (error) {
        console.error('[Supabase] Error upserting user:', error.message);
      }
    } catch (err) {
      console.error('[Supabase] Exception upserting user:', err);
    }
  }

  // 2. Always persist locally in memory and file
  db.users[data.userId] = updatedUser;
  saveDatabase(db);
  return updatedUser;
}

/**
 * Reset unread count for a user
 */
export async function markUserAsRead(userId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient()!;
      await client.from('users').update({ unread_count: 0 }).eq('user_id', userId);
    } catch (err) {
      console.error('[Supabase] Error marking user read:', err);
    }
  }

  const db = loadDatabase();
  if (db.users[userId]) {
    db.users[userId].unreadCount = 0;
    saveDatabase(db);
  }
}

/**
 * Retrieve messages for a specific user or all messages
 */
export async function getMessages(userId?: string): Promise<ChatMessage[]> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient()!;
      let query = client.from('messages').select('*').order('created_at', { ascending: true });
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map(rowToChatMessage);
      }
      console.error('[Supabase] Failed to fetch messages, falling back to local:', error?.message);
    } catch (err) {
      console.error('[Supabase] Exception fetching messages:', err);
    }
  }

  const db = loadDatabase();
  if (!userId) {
    return db.messages;
  }
  return db.messages.filter((msg) => msg.userId === userId);
}

/**
 * Get directory for uploaded and downloaded media
 */
export function getUploadsDir(): string {
  const baseDir =
    process.env.NODE_ENV === 'production' && !process.env.DATA_DIR
      ? '/tmp'
      : process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const uploadsDir = path.join(baseDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

/**
 * Add a new chat message
 */
export async function addMessage(data: {
  userId: string;
  sender: 'user' | 'agent';
  text: string;
  imageUrl?: string;
  stickerUrl?: string;
  packageId?: string;
  stickerId?: string;
  messageType?: 'text' | 'image' | 'sticker';
}): Promise<ChatMessage> {
  const db = loadDatabase();
  const now = Date.now();
  const messageType = data.messageType || (data.stickerUrl ? 'sticker' : data.imageUrl ? 'image' : 'text');
  const text = data.text || (messageType === 'sticker' ? '🏷️ [สติกเกอร์]' : messageType === 'image' ? '📷 [รูปภาพ]' : '');

  const newMsg: ChatMessage = {
    id: `msg_${now}_${Math.random().toString(36).substring(2, 9)}`,
    userId: data.userId,
    sender: data.sender,
    text,
    imageUrl: data.imageUrl,
    stickerUrl: data.stickerUrl,
    packageId: data.packageId,
    stickerId: data.stickerId,
    messageType,
    createdAt: now,
    status: 'sent',
  };

  // 1. Sync to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient()!;
      const row = chatMessageToRow(newMsg);
      const { error } = await client.from('messages').insert(row);
      if (error) {
        console.error('[Supabase] Error adding message:', error.message);
      }
    } catch (err) {
      console.error('[Supabase] Exception adding message:', err);
    }
  }

  // 2. Update user's latest message
  await upsertUser({
    userId: data.userId,
    lastMessage: text,
    lastMessageAt: now,
    incrementUnread: data.sender === 'user',
    resetUnread: data.sender === 'agent',
    lastSender: data.sender,
  });

  // 3. Always persist locally
  db.messages.push(newMsg);
  saveDatabase(db);
  return newMsg;
}

/**
 * Clear all messages for a specific user, resetting lastMessage and unreadCount
 */
export async function clearUserMessages(userId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient()!;
      await client.from('messages').delete().eq('user_id', userId);
      await client.from('users').update({ last_message: '', unread_count: 0 }).eq('user_id', userId);
    } catch (err) {
      console.error('[Supabase] Error clearing messages:', err);
    }
  }

  const db = loadDatabase();
  db.messages = db.messages.filter((msg) => msg.userId !== userId);

  if (db.users[userId]) {
    db.users[userId].lastMessage = '';
    db.users[userId].unreadCount = 0;
  }

  saveDatabase(db);
  return true;
}

/**
 * Completely delete a user and all their associated messages
 */
export async function deleteUser(userId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient()!;
      await client.from('messages').delete().eq('user_id', userId);
      await client.from('users').delete().eq('user_id', userId);
    } catch (err) {
      console.error('[Supabase] Error deleting user:', err);
    }
  }

  const db = loadDatabase();
  const existed = Boolean(db.users[userId]);

  delete db.users[userId];
  db.messages = db.messages.filter((msg) => msg.userId !== userId);

  saveDatabase(db);
  return existed;
}

/**
 * Get quick reply templates from database
 */
export async function getDbQuickReplies(): Promise<QuickReplyTemplate[]> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient()!;
      const { data, error } = await client.from('quick_replies').select('*').order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        return data.map(rowToQuickReply);
      }
    } catch (err) {
      console.error('[Supabase] Error fetching quick replies:', err);
    }
  }

  const db = loadDatabase();
  return db.quickReplies && db.quickReplies.length > 0
    ? db.quickReplies
    : DEFAULT_QUICK_REPLIES;
}

/**
 * Save quick reply templates to database
 */
export async function saveDbQuickReplies(templates: QuickReplyTemplate[]): Promise<QuickReplyTemplate[]> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient()!;
      await client.from('quick_replies').delete().neq('id', 'placeholder_nonexistent');
      const rows = templates.map((t, idx) => ({
        id: t.id,
        text: t.text,
        category: t.category || 'general',
        created_at: idx + 1,
      }));
      await client.from('quick_replies').insert(rows);
    } catch (err) {
      console.error('[Supabase] Error saving quick replies:', err);
    }
  }

  const db = loadDatabase();
  db.quickReplies = templates;
  saveDatabase(db);
  return templates;
}

/**
 * Clear all records from database (used for testing or resetting state)
 */
export function clearDatabase(): void {
  memoryStore = { users: {}, messages: [], quickReplies: DEFAULT_QUICK_REPLIES };
  try {
    const filePath = getDbFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    // ignore
  }
}
