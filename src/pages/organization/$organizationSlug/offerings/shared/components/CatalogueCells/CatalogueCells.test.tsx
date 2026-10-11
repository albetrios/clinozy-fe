import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import type { Branch } from '@/shared/api/app/app-schema.ts';

import { BranchChips, CellText, UpdatedCell } from './CatalogueCells.tsx';
import { useBranchFilterCopy, useBranchFold } from './use-branch-copy.ts';

const ADAJAN = { id: 'b-adajan', name: 'Adajan', tone: 'sage' } as Branch;
const VESU = { id: 'b-vesu', name: 'Vesu', tone: 'sky' } as Branch;
const BRANCHES = [ADAJAN, VESU];

describe('the cells both Offerings tables share', () => {
  it('chips each branch in its tone, or a grey "All branches", and nothing without values', async () => {
    const { container, rerender } = render(
      <BranchChips values={[ADAJAN.id, VESU.id]} branches={BRANCHES} />,
    );
    expect(screen.getByText('Adajan').closest('[data-slot="pill"]')).toHaveAttribute(
      'data-tone',
      'sage',
    );
    expect(screen.getByText('Vesu').closest('[data-slot="pill"]')).toHaveAttribute(
      'data-tone',
      'sky',
    );
    expect(await axe(container)).toHaveNoViolations();
    rerender(<BranchChips values={['all']} branches={BRANCHES} />);
    expect(
      screen.getByText('All branches').closest('[data-slot="pill"]'),
    ).toHaveAttribute('data-tone', 'neutral');
    rerender(<BranchChips values={[]} branches={BRANCHES} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('draws a value over its grey sub-line, at the weight asked', () => {
    render(<CellText text="₹1,200" sub="list price" weight="semibold" align="end" />);
    expect(screen.getByText('₹1,200')).toHaveClass('font-semibold');
    expect(screen.getByText('list price')).toHaveClass('text-muted-foreground');
  });

  it('shows when a record was last saved — no one is named (G10)', () => {
    const { container } = render(<UpdatedCell updatedAt="2026-09-24T09:20:00.000Z" />);
    // A week or more back: the date alone (the rooms' one time rule).
    expect(screen.getByText(/Sep 24/)).toBeInTheDocument();
    expect(container.querySelector('[data-slot="avatar"]')).toBeNull();
  });

  it('folds the branches into the meta line, "All branches" quiet with its grey dot', () => {
    const { result } = renderHook(() => useBranchFold());
    expect(result.current(['all'], BRANCHES)).toEqual({
      value: 'All branches',
      dotClassName: expect.stringContaining('bg-tone-stone-foreground'),
      quiet: true,
    });
    expect(result.current([VESU.id, ADAJAN.id], BRANCHES)).toEqual({
      value: 'Vesu, Adajan',
      dotClassName: expect.stringContaining('bg-tone-sky-foreground'),
    });
    expect(result.current([], BRANCHES)).toBeNull();
  });

  it('words the Branches filter section', () => {
    const { result } = renderHook(() => useBranchFilterCopy());
    expect(result.current('Branches', BRANCHES)).toEqual({
      label: 'Branches',
      options: {
        all: { label: 'All branches' },
        [ADAJAN.id]: { label: 'Adajan', tone: 'sage' },
        [VESU.id]: { label: 'Vesu', tone: 'sky' },
      },
    });
  });
});
