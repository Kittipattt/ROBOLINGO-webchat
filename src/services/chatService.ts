import { ChatMessage } from '@/lib/types';
import { apiClient } from './apiClient';

/**
 * Chat Service Layer
 * Encapsulates all network interactions related to chat messages.
 */

export const chatService = {
  /**
   * Fetch all messages scoped to a specific userId
   */
  async fetchMessages(userId: string): Promise<ChatMessage[]> {
    const data = await apiClient<{ messages: ChatMessage[] }>('/api/messages', {
      params: { userId },
    });
    return (data.messages || []).filter((m) => m.userId === userId);
  },

  /**
   * Send an outbound message to a LINE user
   */
  async sendMessage(userId: string, text: string): Promise<ChatMessage> {
    const data = await apiClient<{ success: boolean; message: ChatMessage }>('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ userId, text }),
    });
    return data.message;
  },

  /**
   * Clear all chat history for a specific userId
   */
  async clearMessages(userId: string): Promise<boolean> {
    const data = await apiClient<{ success: boolean; userId: string }>('/api/messages', {
      method: 'DELETE',
      params: { userId },
    });
    return data.success;
  },
};
