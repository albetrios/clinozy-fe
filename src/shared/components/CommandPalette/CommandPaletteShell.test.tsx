import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { CommandPaletteShell } from './CommandPaletteShell.tsx';

describe('CommandPaletteShell', () => {
  afterEach(() => act(() => useUIStore.setState({ commandPaletteOpen: false })));

  it('retains dialog geometry and dismisses even when content has no keyboard handler', () => {
    useUIStore.setState({ commandPaletteOpen: true });
    render(
      <CommandPaletteShell>
        <span>Content unavailable</span>
      </CommandPaletteShell>,
    );
    expect(screen.getByRole('dialog', { name: 'Command menu' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    // The dialog slot carries the command menu's elevation and the theme axes.
    expect(screen.getByText('Content unavailable').parentElement).toHaveAttribute(
      'data-slot',
      'dialog-content',
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('sits 12vh from the top, min(640px, 100% − 32px) wide and at most min(560px, 76vh) tall', () => {
    // The design's frame (H:2669–2671): a 16px gutter at every width (358px at
    // 390) — the old `w-full` under `max-w-lg` touched both sides of a phone.
    useUIStore.setState({ commandPaletteOpen: true });
    render(
      <CommandPaletteShell>
        <span>Content</span>
      </CommandPaletteShell>,
    );

    const panel = screen.getByText('Content').parentElement;
    expect(panel).toHaveClass(
      'w-full',
      'max-w-160',
      'max-h-[min(35rem,76vh)]',
      'rounded-xl',
    );
    expect(panel?.parentElement).toHaveClass('px-4', 'pt-[12vh]', 'items-start');
  });

  it('dims the page under the menu and closes on a tap outside', () => {
    useUIStore.setState({ commandPaletteOpen: true });
    render(
      <CommandPaletteShell>
        <span>Content</span>
      </CommandPaletteShell>,
    );

    const backdrop = screen.getByRole('dialog').querySelector('[aria-hidden="true"]');
    expect(backdrop).toHaveClass('bg-overlay/35', 'animate-fade');
    fireEvent.click(backdrop!);
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('cycles reverse Tab inside the shell while content changes', () => {
    useUIStore.setState({ commandPaletteOpen: true });
    render(
      <CommandPaletteShell>
        <input aria-label="Search" />
        <button type="button">Retry</button>
      </CommandPaletteShell>,
    );
    screen.getByRole('textbox').focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('recovers forward and reverse Tab from outside the modal', () => {
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
    const background = screen.getByRole('button', { name: 'Background' });
    background.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('textbox')).toHaveFocus();
    background.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus();
  });
});
