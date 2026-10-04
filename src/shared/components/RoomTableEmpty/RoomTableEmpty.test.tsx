import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Pill } from '@/shared/icons/index.ts';

import { RoomTableEmpty } from './RoomTableEmpty.tsx';

const base = {
  tone: 'blush',
  icon: <Pill />,
  title: 'No medicine matches',
  description: 'Nothing here yet. Try another tab or search.',
  label: 'Medicines',
} as const;

describe('RoomTableEmpty', () => {
  it('shows the skeleton while the list loads', () => {
    render(
      <RoomTableEmpty {...base} loading filtered={false} onClearFilters={vi.fn()} />,
    );
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(8);
    expect(screen.queryByTestId('empty-state')).toBeNull();
  });

  it('offers "Clear filters" when filters hide everything', async () => {
    const onClearFilters = vi.fn();
    const user = userEvent.setup();
    render(
      <RoomTableEmpty
        {...base}
        loading={false}
        filtered
        onClearFilters={onClearFilters}
      />,
    );
    await user.click(screen.getByTestId('empty-state-clear-filters'));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it('is the room empty state with the tab action, and accessible', async () => {
    const { container } = render(
      <RoomTableEmpty
        {...base}
        loading={false}
        filtered={false}
        onClearFilters={vi.fn()}
        action={<button type="button">New medicine</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No medicine matches' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'New medicine' })).toBeVisible();
    expect(screen.getByTestId('empty-state')).toHaveAttribute('data-tone', 'blush');
    expect(await axe(container)).toHaveNoViolations();
  });
});
