import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { CommandPaletteContext, type SearchFocus } from './command-palette-context.ts';

/** The dialog and its focus lifecycle survive content loading and retries. */
export function CommandPaletteShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation(LAYOUT_NS);
  const dialogRef = useRef<HTMLDialogElement>(null);
  /**
   * Seeded ONCE, from whatever asked for this opening — a dashboard suggestion
   * chip names something specific ("Invite members"), and a palette that opens
   * blank makes the user restate it. Read through the initializer rather than
   * an effect so the first paint already shows the filtered list, and never
   * read again: typing here must not write back to the store.
   */
  const [query, setQuery] = useState(() => useUIStore.getState().commandPaletteSeed);
  // A seeded palette puts the caret AFTER the seed, so the first keystroke
  // extends the suggestion instead of landing in front of it.
  const seedCaret = query.length === 0 ? null : query.length;
  const searchFocus = useRef<SearchFocus>({
    focused: true,
    start: seedCaret,
    end: seedCaret,
  });
  const [previousFocus] = useState(() => document.activeElement as HTMLElement | null);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const rememberFocus = useCallback((focused: boolean) => {
    searchFocus.current.focused = focused;
  }, []);
  const rememberSelection = useCallback((input: HTMLInputElement) => {
    searchFocus.current = {
      focused: true,
      start: input.selectionStart,
      end: input.selectionEnd,
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    const focusableSelector = 'input, button, [tabindex]:not([tabindex="-1"])';
    // A failed lazy child removes the focused input without rerendering this shell.
    const focusObserver = new MutationObserver(() => {
      if (dialog?.isConnected && !dialog.contains(document.activeElement)) {
        dialog.querySelector<HTMLElement>(focusableSelector)?.focus();
      }
    });
    if (dialog) focusObserver.observe(dialog, { childList: true, subtree: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialog?.querySelectorAll<HTMLElement>(focusableSelector);
      if (!focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (!dialog?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      focusObserver.disconnect();
      document.removeEventListener('keydown', onKeyDown);
      if (!useUIStore.getState().commandPaletteOpen && previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [previousFocus, setOpen]);

  const contextValue = useMemo(
    () => ({ query, setQuery, searchFocus, rememberFocus, rememberSelection }),
    [query, rememberFocus, rememberSelection],
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      <dialog
        open
        className="text-foreground fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0"
        aria-modal="true"
        aria-label={t(LAYOUT_KEYS.app.commandPalette.ariaLabel)}
        data-testid="command-palette"
        ref={dialogRef}
      >
        <div
          className="bg-overlay/35 animate-fade fixed inset-0"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
        {/* The design's frame (H:2669–2671): 12vh from the top and a 16px
            gutter at every width — min(640px, 100% − 32px), 358px at 390 —
            at most min(560px, 76vh) tall, content-box like the design (its
            1px border sits outside). The dialog slot carries the command
            menu's elevation (0 24px 64px /.22) and the theme axes. */}
        <div className="pointer-events-none fixed inset-0 flex items-start justify-center px-4 pt-[12vh] pb-4">
          <div
            data-slot="dialog-content"
            className="bg-popover text-popover-foreground animate-dropdown-in pointer-events-auto box-content flex max-h-[min(35rem,76vh)] w-full max-w-160 flex-col overflow-hidden rounded-xl border"
          >
            {children}
          </div>
        </div>
      </dialog>
    </CommandPaletteContext.Provider>
  );
}
