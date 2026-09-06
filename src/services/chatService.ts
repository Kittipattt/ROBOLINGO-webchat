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
   * Upload an image file to the server
   */
  async uploadImage(file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload image');
    }

    return await res.json();
  },

  /**
   * Send an outbound message to a LINE user
   */
  async sendMessage(
    userId: string,
    text: string,
    imageUrl?: string,
    messageType?: 'text' | 'image' | 'sticker',
    stickerData?: { packageId?: string; stickerId?: string; stickerUrl?: string }
  ): Promise<ChatMessage> {
    const data = await apiClient<{ success: boolean; message: ChatMessage }>('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        text,
        imageUrl,
        messageType,
        packageId: stickerData?.packageId,
        stickerId: stickerData?.stickerId,
        stickerUrl: stickerData?.stickerUrl,
      }),
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
