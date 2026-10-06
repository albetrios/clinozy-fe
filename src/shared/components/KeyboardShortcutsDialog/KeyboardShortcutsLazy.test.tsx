import { act, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { KeyboardShortcutsLazy } from './KeyboardShortcutsLazy.tsx';

/**
 * Mount under the router — the reference is the record drawer, which guards
 * navigation — and wait for the route to render, so the key listeners are on.
 */
async function renderShortcuts(extra?: ReactNode) {
  const view = renderWithProviders(
    <>
      <KeyboardShortcutsLazy />
      {extra}
      <span data-testid="shortcuts-host" />
    </>,
  );
  await screen.findByTestId('shortcuts-host');
  return view;
}

describe('KeyboardShortcutsLazy', () => {
  beforeEach(() => useUIStore.setState({ shortcutsOpen: false }));
  afterEach(() => act(() => useUIStore.setState({ shortcutsOpen: false })));

  it('renders nothing while closed', async () => {
    await renderShortcuts();
    expect(screen.queryByTestId('keyboard-shortcuts-dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the complete reference synchronously on the first keypress and closes on Escape', async () => {
    await renderShortcuts();
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.getByTestId('keyboard-shortcuts-dialog')).toBeInTheDocument();
    expect(screen.getByText('Open command palette')).toBeInTheDocument();
    expect(screen.getByText('Show keyboard shortcuts')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(useUIStore.getState().shortcutsOpen).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens immediately on Cmd+/ and Ctrl+/', async () => {
    await renderShortcuts();
    fireEvent.keyDown(document, { key: '/', metaKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(() => useUIStore.setState({ shortcutsOpen: false }));
    fireEvent.keyDown(document, { key: '/', ctrlKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ignores shortcuts typed into editable controls', async () => {
    await renderShortcuts(<input aria-label="Search" />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: '?' });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: '/', ctrlKey: true });
    expect(useUIStore.getState().shortcutsOpen).toBe(false);
  });

  it('ignores modified question marks', async () => {
    await renderShortcuts();
    fireEvent.keyDown(document, { key: '?', metaKey: true });
    fireEvent.keyDown(document, { key: '?', altKey: true });
    expect(useUIStore.getState().shortcutsOpen).toBe(false);
  });

  it('removes listeners when unmounted', async () => {
    const { unmount } = await renderShortcuts();
    unmount();
    fireEvent.keyDown(document, { key: '?' });
    expect(useUIStore.getState().shortcutsOpen).toBe(false);
  });
});
