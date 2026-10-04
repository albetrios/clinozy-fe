import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

vi.mock('@/shared/store/useUIStore/index.ts', () => ({
  useUIStore: (
    selector: (s: {
      shortcutsOpen: boolean;
      setShortcutsOpen: (v: boolean) => void;
    }) => unknown,
  ) => selector({ shortcutsOpen: true, setShortcutsOpen: vi.fn() }),
}));

import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog.tsx';

/**
 * Every shortcut the app answers (KICKOFF §6.0 Keyboard; `shell.md:46`;
 * `_patterns.md:271–274`), in the dialog's order. ⌘ on a Mac, Ctrl elsewhere.
 */
const SHORTCUTS: readonly [label: string, keys: string | RegExp][] = [
  ['Open command palette', /^(⌘|Ctrl) K$/],
  ['Show keyboard shortcuts', '?'],
  ['Show keyboard shortcuts (alternate)', /^(⌘|Ctrl) \/$/],
  ['Open or close All sections', 'G'],
  ['Jump to a section', '1–9 · 0'],
  ['Search the list', '/'],
  ['Next or previous lead (in Leads)', 'j · k'],
  ['Close dialog', 'Esc'],
];

describe('KeyboardShortcutsDialog', () => {
  it('lists every shortcut with its keys: ⌘K, ?, G, 1–9 · 0, /, j · k in Leads, Esc', () => {
    render(<KeyboardShortcutsDialog />);
    const rows = within(screen.getByTestId('keyboard-shortcuts-dialog')).getAllByRole(
      'listitem',
    );

    expect(rows).toHaveLength(SHORTCUTS.length);
    SHORTCUTS.forEach(([label, keys], index) => {
      const row = rows[index]!;
      expect(row).toHaveTextContent(label);
      const kbd = row.querySelector('kbd');
      if (typeof keys === 'string') expect(kbd).toHaveTextContent(keys);
      else expect(kbd?.textContent).toMatch(keys);
    });
  });

  it('has no accessibility violations', async () => {
    const { baseElement } = render(<KeyboardShortcutsDialog />);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
