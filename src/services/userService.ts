import { LineUser } from '@/lib/types';
import { apiClient } from './apiClient';

/**
 * User Service Layer
 * Encapsulates all network interactions related to LINE users.
 */

export const userService = {
  /**
   * Fetch all users sorted by most recent activity
   */
  async fetchUsers(): Promise<LineUser[]> {
    const data = await apiClient<{ users: LineUser[] }>('/api/users');
    return data.users || [];
  },

  /**
   * Mark a user's messages as read on the backend
   */
  async markUserAsRead(userId: string): Promise<boolean> {
    try {
      const data = await apiClient<{ success: boolean }>('/api/users/read', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      return data.success;
    } catch {
      return false;
    }
  },

  /**
   * Delete a user profile and all their messages permanently
   */
  async deleteUser(userId: string): Promise<boolean> {
    const data = await apiClient<{ success: boolean; deleted: boolean }>('/api/users', {
      method: 'DELETE',
      params: { userId },
    });
    return data.success;
  },
};
