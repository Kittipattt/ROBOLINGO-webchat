import { QuickReplyTemplate, DEFAULT_QUICK_REPLIES } from '@/lib/types';
import { apiClient } from './apiClient';

/**
 * Quick Reply Service Layer
 * Handles network calls for quick reply template management.
 */
export const quickReplyService = {
  /**
   * Fetch all quick replies from backend
   */
  async fetchQuickReplies(): Promise<QuickReplyTemplate[]> {
    try {
      const data = await apiClient<{ quickReplies: QuickReplyTemplate[] }>('/api/quick-replies');
      return Array.isArray(data.quickReplies) && data.quickReplies.length > 0
        ? data.quickReplies
        : DEFAULT_QUICK_REPLIES;
    } catch (err) {
      console.warn('[quickReplyService] Failed to fetch quick replies from API, falling back:', err);
      return DEFAULT_QUICK_REPLIES;
    }
  },

  /**
   * Save quick reply templates to backend
   */
  async saveQuickReplies(quickReplies: QuickReplyTemplate[]): Promise<QuickReplyTemplate[]> {
    const data = await apiClient<{ success: boolean; quickReplies: QuickReplyTemplate[] }>(
      '/api/quick-replies',
      {
        method: 'POST',
        body: JSON.stringify({ quickReplies }),
      }
    );
    return data.quickReplies;
  },
};
