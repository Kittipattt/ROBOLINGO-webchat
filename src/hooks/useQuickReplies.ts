'use client';

import { useState, useEffect, useCallback } from 'react';
import { QuickReplyTemplate, DEFAULT_QUICK_REPLIES } from '@/lib/types';
import { storage } from '@/lib/storage';
import { quickReplyService } from '@/services/quickReplyService';

export function useQuickReplies() {
  const [quickReplies, setQuickReplies] = useState<QuickReplyTemplate[]>(DEFAULT_QUICK_REPLIES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initial load: first from local storage for zero-latency, then sync with server
  useEffect(() => {
    const cached = storage.getQuickReplies();
    if (cached && cached.length > 0) {
      setQuickReplies(cached);
    }

    quickReplyService
      .fetchQuickReplies()
      .then((serverReplies) => {
        if (serverReplies && serverReplies.length > 0) {
          setQuickReplies(serverReplies);
          storage.setQuickReplies(serverReplies);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  // Sync helper: save to memory, storage, and server
  const persistReplies = useCallback(async (updated: QuickReplyTemplate[]) => {
    setQuickReplies(updated);
    storage.setQuickReplies(updated);
    try {
      await quickReplyService.saveQuickReplies(updated);
    } catch (err) {
      console.warn('[useQuickReplies] Server sync warning (cached locally):', err);
    }
  }, []);

  // Add new quick reply template
  const addQuickReply = useCallback(
    async (text: string): Promise<QuickReplyTemplate | null> => {
      const trimmed = text.trim();
      if (!trimmed) return null;

      const newTemplate: QuickReplyTemplate = {
        id: `qr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        text: trimmed,
        createdAt: Date.now(),
      };

      const updated = [...quickReplies, newTemplate];
      await persistReplies(updated);
      return newTemplate;
    },
    [quickReplies, persistReplies]
  );

  // Update existing quick reply template
  const updateQuickReply = useCallback(
    async (id: string, newText: string): Promise<boolean> => {
      const trimmed = newText.trim();
      if (!trimmed) return false;

      const updated = quickReplies.map((item) =>
        item.id === id ? { ...item, text: trimmed } : item
      );

      await persistReplies(updated);
      return true;
    },
    [quickReplies, persistReplies]
  );

  // Delete a quick reply template
  const deleteQuickReply = useCallback(
    async (id: string): Promise<boolean> => {
      const updated = quickReplies.filter((item) => item.id !== id);
      await persistReplies(updated);
      return true;
    },
    [quickReplies, persistReplies]
  );

  // Reset to default standard quick replies
  const resetToDefaults = useCallback(async (): Promise<void> => {
    const defaults = storage.resetQuickReplies();
    await persistReplies(defaults);
  }, [persistReplies]);

  return {
    quickReplies,
    isLoaded,
    addQuickReply,
    updateQuickReply,
    deleteQuickReply,
    resetToDefaults,
  };
}
