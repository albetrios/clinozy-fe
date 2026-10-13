import { useEffect } from 'react';

import { isEditableTarget } from '@/lib/editable-focus.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog.tsx';

/**
 * Static reference loaded with the deferred app layout, ready on the first keypress.
 * Registers global `?` and Cmd/Ctrl+/ listeners.
 */
export function KeyboardShortcutsLazy() {
  const open = useUIStore((s) => s.shortcutsOpen);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (e.key === '?' && !meta && !e.altKey) {
        e.preventDefault();
        useUIStore.getState().setShortcutsOpen(true);
        return;
      }
      if (meta && e.key === '/') {
        e.preventDefault();
        useUIStore.getState().setShortcutsOpen(true);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!open) return null;

  return <KeyboardShortcutsDialog />;
}
