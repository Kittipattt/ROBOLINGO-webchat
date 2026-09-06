'use client';

import { useState, useEffect, useCallback } from 'react';
import { ThemeMode } from '@/lib/types';
import { storage } from '@/lib/storage';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [mounted, setMounted] = useState(false);

  // Initialize theme on client mount
  useEffect(() => {
    const savedTheme = storage.getTheme();
    setThemeState(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    setMounted(true);
  }, []);

  // Set theme explicitly
  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    storage.setTheme(newTheme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  }, []);

  // Quick toggle between 'dark' and 'light'
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      storage.setTheme(next);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', next);
      }
      return next;
    });
  }, []);

  return {
    theme,
    mounted,
    setTheme,
    toggleTheme,
  };
}
