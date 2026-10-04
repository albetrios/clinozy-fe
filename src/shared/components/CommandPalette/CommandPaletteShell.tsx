import { Dialog as DialogPrimitive } from 'radix-ui';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { CommandPaletteContext, type SearchFocus } from './command-palette-context.ts';

/** What can hold focus inside the menu — the search, Retry, a row. */
const FOCUSABLE_SELECTOR = 'input, button, [tabindex]:not([tabindex="-1"])';

/**
 * The command menu's dialog — the design's frame (H:2669–2671) on a Radix
 * dialog, so it joins the same layer stack as the drawers, pickers and menus:
 * Esc, an outside press and the focus trap belong to whichever surface is on
 * top (KICKOFF §6.0 Esc order), and over an open drawer one Esc closes the
 * menu alone. The dialog and its focus lifecycle survive content loading and
 * retries; the shell, not Radix, hands focus back on close.
 */
export function CommandPaletteShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation(LAYOUT_NS);
  // State, not a ref: the portal mounts the dialog a render after the shell.
  const [content, setContent] = useState<HTMLDivElement | null>(null);
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
    if (!content) return undefined;
    // A failed lazy child removes the focused input without rerendering this
    // shell; Radix then parks focus on the dialog itself. Hand it to the first
    // control instead (the search, or Retry).
    const focusObserver = new MutationObserver(() => {
      const active = document.activeElement;
      if (active === content || !content.contains(active)) {
        content.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
      }
    });
    focusObserver.observe(content, { childList: true, subtree: true });
    return () => focusObserver.disconnect();
  }, [content]);

  // The palette unmounts the instant it closes, so only cleanup can hand focus
  // back — to whatever had it, when that is still on the page.
  useEffect(
    () => () => {
      if (!useUIStore.getState().commandPaletteOpen && previousFocus?.isConnected) {
        previousFocus.focus();
      }
    },
    [previousFocus],
  );

  const contextValue = useMemo(
    () => ({ query, setQuery, searchFocus, rememberFocus, rememberSelection }),
    [query, rememberFocus, rememberSelection],
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      <DialogPrimitive.Root
        open
        onOpenChange={(next) => {
          if (!next) setOpen(false);
        }}
      >
        <DialogPrimitive.Portal>
          {/* The dim behind the menu; a press on it closes the menu. The slot
              marks a modal dialog as up (it hides the feedback trigger). */}
          <DialogPrimitive.Overlay
            data-slot="dialog-overlay"
            className="bg-overlay/35 animate-fade fixed inset-0 z-50"
          />
          {/* The design's frame (H:2669–2671): 12vh from the top and a 16px
              gutter at every width — min(640px, 100% − 32px), 358px at 390 —
              at most min(560px, 76vh) tall, content-box like the design (its
              1px border sits outside). The dialog slot carries the command
              menu's elevation (0 24px 64px /.22) and the theme axes. */}
          <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] pb-4">
            <DialogPrimitive.Content
              ref={setContent}
              aria-modal="true"
              aria-label={t(LAYOUT_KEYS.app.commandPalette.ariaLabel)}
              data-testid="command-palette"
              // Focus: the search row focuses itself (caret after any seed) and
              // Radix steps in only when nothing inside holds it; on close the
              // shell's cleanup hands it back, so Radix's own return stands down.
              onCloseAutoFocus={(event) => event.preventDefault()}
              data-slot="dialog-content"
              className="bg-popover text-popover-foreground animate-dropdown-in pointer-events-auto box-content flex max-h-[min(35rem,76vh)] w-full max-w-160 flex-col overflow-hidden rounded-xl border outline-none"
            >
              {children}
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </CommandPaletteContext.Provider>
  );
}
