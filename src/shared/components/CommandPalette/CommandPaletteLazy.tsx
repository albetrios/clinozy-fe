import { Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { onceAsync, useRetryableLazy } from '@/lib/lazy-module.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/picker.constants.ts';
import { SkeletonBar, SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { Search } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import {
  COMMAND_SEARCH_CLASS,
  COMMAND_SEARCH_ICON_CLASS,
  COMMAND_SEARCH_MAX_LENGTH,
  COMMAND_SEARCH_ROW_CLASS,
  useCommandPaletteSearch,
} from './command-palette-context.ts';
import { CommandPaletteKbd } from './CommandPaletteKbd.tsx';
import { CommandPaletteShell } from './CommandPaletteShell.tsx';

// cmdk stays behind this import, outside the entry preload graph.
const loadCommandPalette = onceAsync(() =>
  import('./CommandPalette.tsx').then((m) => ({ default: m.CommandPaletteContent })),
);

function CommandPalettePending() {
  const { t } = useTranslation(LAYOUT_NS);
  const { t: tPicker } = useTranslation(PICKER_NS);
  const { query, setQuery, searchFocus, rememberFocus, rememberSelection } =
    useCommandPaletteSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (searchFocus.current.focused) {
      input?.focus();
      input?.setSelectionRange(searchFocus.current.start, searchFocus.current.end);
    }
    return () => {
      if (input && document.activeElement === input) {
        rememberSelection(input);
      }
    };
  }, [searchFocus, rememberSelection]);

  return (
    <>
      <div className={COMMAND_SEARCH_ROW_CLASS}>
        <Search aria-hidden="true" className={COMMAND_SEARCH_ICON_CLASS} />
        <input
          ref={inputRef}
          data-slot="input"
          aria-label={t(LAYOUT_KEYS.app.search)}
          placeholder={t(LAYOUT_KEYS.app.commandPalette.placeholder)}
          maxLength={COMMAND_SEARCH_MAX_LENGTH}
          className={COMMAND_SEARCH_CLASS}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            rememberFocus(true);
          }}
          onBlur={() => {
            rememberFocus(false);
          }}
        />
        <CommandPaletteKbd>{tPicker(PICKER_KEYS.escKey)}</CommandPaletteKbd>
      </div>
      {/* The design's list geometry (H:2674): a heading, then 40px rows — their
          text replaced in place by the flat bars (`_patterns.md:282`). The rows
          announce the load. */}
      <div
        data-testid="command-palette-pending"
        className="text-body flex flex-col p-1.5"
      >
        <SkeletonBar className="ms-2.5 mt-2.5 mb-1 w-16" />
        <SkeletonRows rows={5} rowClassName="h-10 px-2.5" />
      </div>
    </>
  );
}

function CommandPaletteBody() {
  const { t } = useTranslation(ERRORS_NS);
  const { Component: Content, retry } = useRetryableLazy(loadCommandPalette);
  return (
    <SectionErrorBoundary
      title={t(ERRORS_KEYS.widget.commandPalette)}
      onReset={retry}
      testId="command-palette-error"
      variant="inline"
    >
      <Suspense fallback={<CommandPalettePending />}>
        <Content />
      </Suspense>
    </SectionErrorBoundary>
  );
}

/** Eager dialog and keyboard shortcut, deferred command engine and list. */
export function CommandPaletteLazy() {
  const open = useUIStore((s) => s.commandPaletteOpen);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        useUIStore.getState().toggleCommandPalette();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!open) return null;

  return (
    <CommandPaletteShell>
      <CommandPaletteBody />
    </CommandPaletteShell>
  );
}
