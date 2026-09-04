import fs from 'fs';
import path from 'path';
import { LineUser, ChatMessage } from './types';

interface DatabaseSchema {
  users: Record<string, LineUser>;
  messages: ChatMessage[];
}

// In-memory fallback / cache
let memoryStore: DatabaseSchema = {
  users: {},
  messages: [],
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
}): LineUser {
  const db = loadDatabase();
  const existing = db.users[data.userId];

  const now = Date.now();
  const updatedUser: LineUser = {
    userId: data.userId,
    displayName: data.displayName ?? existing?.displayName ?? 'LINE User',
    pictureUrl: data.pictureUrl ?? existing?.pictureUrl,
    statusMessage: data.statusMessage ?? existing?.statusMessage,
    lastMessage: data.lastMessage ?? existing?.lastMessage ?? '',
    lastMessageAt: data.lastMessageAt ?? now,
    unreadCount: data.incrementUnread
      ? (existing?.unreadCount || 0) + 1
      : (existing?.unreadCount ?? 0),
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
 * Add a new chat message
 */
export function addMessage(data: {
  userId: string;
  sender: 'user' | 'agent';
  text: string;
}): ChatMessage {
  const db = loadDatabase();
  const now = Date.now();
  const newMsg: ChatMessage = {
    id: `msg_${now}_${Math.random().toString(36).substring(2, 9)}`,
    userId: data.userId,
    sender: data.sender,
    text: data.text,
    createdAt: now,
    status: 'sent',
  };

  db.messages.push(newMsg);

  // Update user's latest message
  upsertUser({
    userId: data.userId,
    lastMessage: data.text,
    lastMessageAt: now,
    incrementUnread: data.sender === 'user',
  });

  saveDatabase(db);
  return newMsg;
}

/**
 * Clear all records from database (used for testing or resetting state)
 */
export function clearDatabase(): void {
  memoryStore = { users: {}, messages: [] };
  try {
    const filePath = getDbFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    // ignore
  }
}
