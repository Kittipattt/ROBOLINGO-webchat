export interface LineUser {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  lastMessage: string;
  lastMessageAt: number; // Unix timestamp in ms
  unreadCount: number;
  lastSender?: 'user' | 'agent';
}

export interface ChatMessage {
  id: string;
  userId: string;
  sender: 'user' | 'agent';
  text: string;
  createdAt: number; // Unix timestamp in ms
  status?: 'sending' | 'sent' | 'error';
}

export interface LineWebhookEvent {
  type: string;
  mode?: string;
  timestamp: number;
  source: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  message?: {
    id: string;
    type: string;
    text?: string;
    [key: string]: unknown;
  };
}

export interface LineWebhookPayload {
  destination?: string;
  events: LineWebhookEvent[];
}
