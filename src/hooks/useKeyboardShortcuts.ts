'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook for global keyboard shortcuts (e.g. ⌘K / Ctrl+K to focus search)
 */
export function useKeyboardShortcuts() {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    searchInputRef,
  };
}
