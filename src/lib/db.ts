import fs from 'fs';
import path from 'path';
import { LineUser, ChatMessage, QuickReplyTemplate, DEFAULT_QUICK_REPLIES } from './types';

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
export function getAllUsers(): LineUser[] {
  const db = loadDatabase();
  return Object.values(db.users).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

/**
 * Get a specific user by LINE userId
 */
export function getUserById(userId: string): LineUser | null {
  const db = loadDatabase();
  return db.users[userId] || null;
}

/**
 * Upsert a LINE user's profile and update timestamp
 */
export function upsertUser(data: {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
  statusMessage?: string;
  lastMessage?: string;
  lastMessageAt?: number;
  incrementUnread?: boolean;
  resetUnread?: boolean;
  lastSender?: 'user' | 'agent';
}): LineUser {
  const db = loadDatabase();
  const existing = db.users[data.userId];

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
  // and never allow an empty/whitespace lastMessage to overwrite an existing non-empty lastMessage
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

  db.users[data.userId] = updatedUser;
  saveDatabase(db);
  return updatedUser;
}

/**
 * Reset unread count for a user
 */
export function markUserAsRead(userId: string): void {
  const db = loadDatabase();
  if (db.users[userId]) {
    db.users[userId].unreadCount = 0;
    saveDatabase(db);
  }
}

/**
 * Retrieve messages for a specific user or all messages
 */
export function getMessages(userId?: string): ChatMessage[] {
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
export function addMessage(data: {
  userId: string;
  sender: 'user' | 'agent';
  text: string;
  imageUrl?: string;
  stickerUrl?: string;
  packageId?: string;
  stickerId?: string;
  messageType?: 'text' | 'image' | 'sticker';
}): ChatMessage {
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

  db.messages.push(newMsg);

  // Update user's latest message
  upsertUser({
    userId: data.userId,
    lastMessage: text,
    lastMessageAt: now,
    incrementUnread: data.sender === 'user',
    resetUnread: data.sender === 'agent',
    lastSender: data.sender,
  });

  saveDatabase(db);
  return newMsg;
}

/**
 * Clear all messages for a specific user, resetting lastMessage and unreadCount
 */
export function clearUserMessages(userId: string): boolean {
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
export function deleteUser(userId: string): boolean {
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
export function getDbQuickReplies(): QuickReplyTemplate[] {
  const db = loadDatabase();
  return db.quickReplies && db.quickReplies.length > 0
    ? db.quickReplies
    : DEFAULT_QUICK_REPLIES;
}

/**
 * Save quick reply templates to database
 */
export function saveDbQuickReplies(templates: QuickReplyTemplate[]): QuickReplyTemplate[] {
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
