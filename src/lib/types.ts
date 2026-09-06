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
  imageUrl?: string;
  messageType?: 'text' | 'image';
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

export interface QuickReplyTemplate {
  id: string;
  text: string;
  createdAt: number;
}

export const DEFAULT_QUICK_REPLIES: QuickReplyTemplate[] = [
  { id: 'qr_1', text: 'สวัสดีครับ ยินดีต้อนรับสู่ ROBO LINGO ครับ ✨', createdAt: 1 },
  { id: 'qr_2', text: 'ยินดีให้บริการครับ มีอะไรให้ช่วยเหลือเพิ่มเติมไหมครับ?', createdAt: 2 },
  { id: 'qr_3', text: 'ทางทีมงานกำลังตรวจสอบข้อมูลให้นะครับ สักครู่ครับ ⏳', createdAt: 3 },
  { id: 'qr_4', text: 'ขอบคุณที่ติดต่อเราครับ หากมีข้อสงสัยสอบถามได้ตลอดเวลาครับ 🙏', createdAt: 4 },
];

export type ThemeMode = 'dark' | 'light';

