import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/store/useUIStore/index.ts', () => ({
  useUIStore: (
    selector: (s: {
      shortcutsOpen: boolean;
      setShortcutsOpen: (v: boolean) => void;
    }) => unknown,
  ) => selector({ shortcutsOpen: true, setShortcutsOpen: vi.fn() }),
}));

import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog.tsx';

describe('KeyboardShortcutsDialog', () => {
  it('lists keyboard shortcuts when open', () => {
    render(<KeyboardShortcutsDialog />);
    expect(screen.getByTestId('keyboard-shortcuts-dialog')).toBeInTheDocument();
    expect(screen.getByText('Open command palette')).toBeInTheDocument();
    expect(screen.getByText('Show keyboard shortcuts')).toBeInTheDocument();
  });
});
