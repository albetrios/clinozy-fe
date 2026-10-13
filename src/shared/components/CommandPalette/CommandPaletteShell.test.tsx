import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { CommandPaletteShell } from './CommandPaletteShell.tsx';

// Radix turns pointer events off outside the top-most modal layer.
const user = () => userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** The dim behind the menu (a Radix overlay, portaled beside the dialog). */
function overlay(): HTMLElement {
  const node = document.querySelector('[data-slot="dialog-overlay"]');
  if (!(node instanceof HTMLElement)) throw new Error('no command menu overlay');
  return node;
}

/** Open the store, render the shell around `children` and wait for the dialog. */
async function renderShell(children: ReactNode) {
  useUIStore.setState({ commandPaletteOpen: true });
  const view = render(<CommandPaletteShell>{children}</CommandPaletteShell>);
  // Also lets Radix arm its outside-press listener (a tick after mount).
  const dialog = await screen.findByRole('dialog', { name: 'Command menu' });
  return { ...view, dialog };
}

describe('CommandPaletteShell', () => {
  afterEach(() => act(() => useUIStore.setState({ commandPaletteOpen: false })));

  it('is a modal "Command menu" dialog that Esc closes even when the content has no keyboard handler', async () => {
    const { dialog } = await renderShell(<span>Content unavailable</span>);

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // The dialog slot carries the command menu's elevation and the theme axes.
    expect(dialog).toHaveAttribute('data-slot', 'dialog-content');
    expect(screen.getByText('Content unavailable').parentElement).toBe(dialog);

    await user().keyboard('{Escape}');
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('sits 12vh from the top, min(640px, 100% − 32px) wide and at most min(560px, 76vh) tall', async () => {
    // The design's frame (H:2669–2671): a 16px gutter at every width (358px at
    // 390) — the old `w-full` under `max-w-lg` touched both sides of a phone.
    const { dialog } = await renderShell(<span>Content</span>);

    expect(dialog).toHaveClass(
      'w-full',
      'max-w-160',
      'max-h-[min(35rem,76vh)]',
      'rounded-xl',
      'animate-dropdown-in',
    );
    expect(dialog.parentElement).toHaveClass('px-4', 'pt-[12vh]', 'items-start');
  });

  it('dims the page under the menu and closes on a press outside', async () => {
    await renderShell(<span>Content</span>);

    expect(overlay()).toHaveClass('bg-overlay/35', 'animate-fade');
    await user().click(overlay());

    await waitFor(() => expect(useUIStore.getState().commandPaletteOpen).toBe(false));
  });

  it('keeps Tab inside the menu, both ways', async () => {
    await renderShell(
      <>
        <input aria-label="Search" />
        <button type="button">Retry</button>
      </>,
    );
    const u = user();
    expect(screen.getByRole('textbox')).toHaveFocus();

    await u.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('pulls focus back inside when something behind the menu takes it', async () => {
    useUIStore.setState({ commandPaletteOpen: true });
    render(
      <>
        <button type="button">Background</button>
        <CommandPaletteShell>
          <input aria-label="Search" />
          <button type="button">Retry</button>
        </CommandPaletteShell>
      </>,
    );
    await screen.findByRole('dialog', { name: 'Command menu' });
    const search = screen.getByRole('textbox');
    expect(search).toHaveFocus();

    // The page behind is hidden from assistive tech while the menu is up.
    screen.getByText('Background').focus();

    expect(search).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { baseElement } = await renderShell(<input aria-label="Search" />);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
