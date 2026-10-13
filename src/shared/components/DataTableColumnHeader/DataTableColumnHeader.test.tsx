import { type SortingState, useTable } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { dataTableFeatures } from '@/shared/components/DataTable/index.ts';

import { DataTableColumnHeader } from './DataTableColumnHeader.tsx';

function Harness({
  sortable = true,
  align,
  startsDescending,
}: {
  sortable?: boolean;
  align?: 'end';
  startsDescending?: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useTable({
    features: dataTableFeatures,
    data: [{ amount: 2 }, { amount: 1 }],
    columns: [
      {
        accessorKey: 'amount',
        header: 'Amount',
        enableSorting: sortable,
        meta: { align, sortStartsDescending: startsDescending },
      },
    ],
    state: { sorting },
    onSortingChange: setSorting,
  });
  const column = table.getColumn('amount');
  if (!column) throw new Error('column missing');
  return (
    <>
      <DataTableColumnHeader column={column} title="Amount" />
      <output data-testid="sorting">{JSON.stringify(sorting)}</output>
    </>
  );
}

const sorting = () => screen.getByTestId('sorting').textContent;

describe('DataTableColumnHeader', () => {
  it('cycles ascending → descending → off — even for numbers, which TanStack sorts desc first', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Amount' });
    expect(button).toHaveAttribute('title', 'Sort by Amount');

    await user.click(button);
    expect(sorting()).toBe('[{"id":"amount","desc":false}]');
    await user.click(button);
    expect(sorting()).toBe('[{"id":"amount","desc":true}]');
    await user.click(button);
    expect(sorting()).toBe('[]');
  });

  it('runs newest first → off for a column that starts descending (H:6147)', async () => {
    const user = userEvent.setup();
    render(<Harness startsDescending />);
    const button = screen.getByRole('button', { name: 'Amount' });

    await user.click(button);
    expect(sorting()).toBe('[{"id":"amount","desc":true}]');
    await user.click(button);
    expect(sorting()).toBe('[]');
  });

  it('marks the sorted column with the strong fill and a full-opacity arrow', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Amount' });
    expect(button.className).toContain('text-muted-foreground');
    expect(button.querySelector('svg')?.getAttribute('class')).toContain('opacity-45');

    await user.click(button);
    expect(button.className).toContain('bg-muted-strong');
    expect(button.querySelector('svg')?.getAttribute('class')).toContain('opacity-100');
  });

  it('renders a plain label for a column that cannot sort', () => {
    render(<Harness sortable={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
  });

  it('aligns an amount column to the inline end', () => {
    render(<Harness align="end" />);
    const button = screen.getByRole('button', { name: 'Amount' });
    expect(button.className).toContain('justify-end');
    // An end-aligned arrow keeps its place at the column's edge.
    expect(button.querySelector('[data-slot="sort-label"]')).not.toHaveClass('-me-1.5');
  });

  it('lets a start-aligned label use the end padding before it truncates (H:678)', () => {
    render(<Harness />);
    const group = screen
      .getByRole('button', { name: 'Amount' })
      .querySelector('[data-slot="sort-label"]');
    expect(group).toHaveClass('-me-1.5');
    expect(group?.firstElementChild).toHaveClass('truncate');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Harness />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
