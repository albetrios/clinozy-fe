import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Receipt, Trash } from '@/shared/icons/index.ts';

import { DataTableBulkBar } from './DataTableBulkBar.tsx';

const ROWS = [{ id: 'a' }, { id: 'b' }];

function renderBar(overrides: Partial<Parameters<typeof DataTableBulkBar>[0]> = {}) {
  const props = {
    selected: ROWS,
    total: 5,
    onSelectAll: vi.fn(),
    onClear: vi.fn(),
    actions: [
      { id: 'export', label: 'Export', icon: Receipt, onSelect: vi.fn() },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash,
        onSelect: vi.fn(),
        destructive: true,
      },
    ],
    ...overrides,
  };
  const { container } = render(<DataTableBulkBar {...props} />);
  return { ...props, container };
}

describe('DataTableBulkBar', () => {
  it('reads "<N> selected" with "Select all <N>" while the selection is partial', async () => {
    const user = userEvent.setup();
    const props = renderBar();
    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    expect(bar).toHaveTextContent('2 selected');
    expect(bar).toHaveAttribute('data-surface', 'light-pinned');

    await user.click(screen.getByRole('button', { name: 'Select all 5' }));
    expect(props.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('drops "Select all" once everything is selected', () => {
    renderBar({ total: 2 });
    expect(screen.queryByRole('button', { name: /select all/i })).not.toBeInTheDocument();
  });

  it('runs an action over the selected rows and tints the destructive one', async () => {
    const user = userEvent.setup();
    const props = renderBar();
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(props.actions[0]?.onSelect).toHaveBeenCalledWith(ROWS);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain(
      'text-destructive-border',
    );
  });

  it('shows the Esc hint and clears from the × (title "Clear selection · Esc")', async () => {
    const user = userEvent.setup();
    const props = renderBar();
    expect(screen.getByText('Esc')).toBeInTheDocument();
    const clear = screen.getByRole('button', { name: 'Clear selection' });
    expect(clear).toHaveAttribute('title', 'Clear selection · Esc');
    await user.click(clear);
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('docks with the bulk-in motion', () => {
    renderBar();
    expect(screen.getByRole('toolbar').className).toContain('animate-bulk-in');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderBar();
    expect(await axe(container)).toHaveNoViolations();
  });
});
