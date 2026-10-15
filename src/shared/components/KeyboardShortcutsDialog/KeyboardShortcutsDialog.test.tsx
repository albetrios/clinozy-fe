import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const { viewport } = vi.hoisted(() => ({
  viewport: { tier: 'desktop' as ViewportTier },
}));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog.tsx';

/**
 * Every shortcut the app answers (KICKOFF §6.0 Keyboard; `shell.md:46`;
 * `_patterns.md:271–274`), in the reference's order. ⌘ on a Mac, Ctrl elsewhere.
 */
const SHORTCUTS: readonly [label: string, keys: string | RegExp][] = [
  ['Open command palette', /^(⌘|Ctrl) K$/],
  ['Show keyboard shortcuts', '?'],
  ['Show keyboard shortcuts (alternate)', /^(⌘|Ctrl) \/$/],
  ['Open or close All sections', 'G'],
  ['Jump to a section', '1–9 · 0'],
  ['Search the list', '/'],
  ['Next or previous lead (in Leads)', 'j · k'],
  ['Save the open form', /^(⌘|Ctrl) ↵$/],
  ["Speak into the field you're in", /^(⌘ ⇧|Ctrl Shift) Space$/],
  ['Close dialog', 'Esc'],
];

/** Render the drawer under the router (the record drawer guards navigation). */
async function renderDrawer() {
  const view = renderWithProviders(<KeyboardShortcutsDialog />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

describe('KeyboardShortcutsDialog — the drawer', () => {
  beforeEach(() => {
    viewport.tier = 'desktop';
    useUIStore.setState({ shortcutsOpen: true });
  });
  afterEach(() => act(() => useUIStore.setState({ shortcutsOpen: false })));

  it('lists every shortcut with its keys: ⌘K, ?, G, 1–9 · 0, /, j · k in Leads, ⌘ ↵, ⌘ ⇧ Space, Esc', async () => {
    await renderDrawer();
    const rows = within(
      await screen.findByTestId('keyboard-shortcuts-dialog'),
    ).getAllByRole('listitem');

    expect(rows).toHaveLength(SHORTCUTS.length);
    SHORTCUTS.forEach(([label, keys], index) => {
      const row = rows[index]!;
      expect(row).toHaveTextContent(label);
      const kbd = row.querySelector('kbd');
      if (typeof keys === 'string') expect(kbd).toHaveTextContent(keys);
      else expect(kbd?.textContent).toMatch(keys);
    });
  });

  it('opens as the record drawer: named, described, 560px from md, the list on the canvas, no footer', async () => {
    await renderDrawer();

    const drawer = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(drawer).toBe(screen.getByTestId('keyboard-shortcuts-dialog'));
    expect(drawer).toHaveAccessibleDescription(
      'Quick reference for navigation and actions.',
    );
    // A read-only list, no fields: the drawers' light width.
    expect(drawer.className).toContain('md:w-[min(560px,calc(100vw-56px))]');
    expect(screen.getByTestId('keyboard-shortcuts-dialog-body')).toHaveClass('bg-canvas');
    expect(
      screen.queryByTestId('keyboard-shortcuts-dialog-footer'),
    ).not.toBeInTheDocument();
  });

  it('starts on its title', async () => {
    await renderDrawer();
    await waitFor(() =>
      expect(screen.getByTestId('keyboard-shortcuts-dialog-title')).toHaveFocus(),
    );
  });

  it.each([
    ['desktop', 'outside the drawer'],
    ['phone', 'inside the header'],
  ] as const)('closes from its × on %s (%s)', async (tier) => {
    viewport.tier = tier;
    const user = userEvent.setup();
    await renderDrawer();

    await user.click(await screen.findByTestId('keyboard-shortcuts-dialog-close'));

    expect(useUIStore.getState().shortcutsOpen).toBe(false);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    await renderDrawer();
    await screen.findByTestId('keyboard-shortcuts-dialog');

    await user.keyboard('{Escape}');

    expect(useUIStore.getState().shortcutsOpen).toBe(false);
  });

  it('has no accessibility violations', async () => {
    const { baseElement } = await renderDrawer();
    await screen.findByTestId('keyboard-shortcuts-dialog');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
