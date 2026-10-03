import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { SkeletonBar, SkeletonRows } from './SkeletonRows.tsx';

const bars = () =>
  screen
    .getAllByTestId('skeleton-row')
    .map((row) => row.querySelector('[data-slot="skeleton"]:last-child'));

describe('SkeletonRows', () => {
  it('cycles the content widths 64 / 48 / 60%', () => {
    render(<SkeletonRows rows={4} />);
    const widths = bars().map((bar) =>
      ['w-[64%]', 'w-[48%]', 'w-[60%]'].find((width) => bar?.classList.contains(width)),
    );
    expect(widths).toEqual(['w-[64%]', 'w-[48%]', 'w-[60%]', 'w-[64%]']);
  });

  it('draws the picker’s four rows at 62 / 48 / 70 / 40%', () => {
    render(<SkeletonRows pattern="picker" />);
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(4);
    const classes = bars().map((bar) => bar?.className ?? '');
    expect(classes[0]).toContain('w-[62%]');
    expect(classes[1]).toContain('w-[48%]');
    expect(classes[2]).toContain('w-[70%]');
    expect(classes[3]).toContain('w-[40%]');
  });

  it('draws flat muted-strong bars that never animate (no shimmer, reduced motion safe)', () => {
    render(<SkeletonRows rows={1} />);
    const [bar] = bars();
    expect(bar).toHaveClass(
      'bg-muted-strong',
      'animate-none',
      'h-[0.72em]',
      'rounded-md',
    );
    expect(bar).not.toHaveClass('animate-pulse');
  });

  it('keeps avatars round', () => {
    render(<SkeletonRows rows={2} avatar />);
    const [row] = screen.getAllByTestId('skeleton-row');
    const avatar = row?.querySelector('[data-slot="skeleton"]');
    expect(avatar).toHaveClass('size-8', 'rounded-full');
  });

  it('turns clicks off and announces what is loading', () => {
    render(<SkeletonRows label="Patients" />);
    expect(screen.getByTestId('skeleton-rows')).toHaveAttribute('aria-busy', 'true');
    for (const row of screen.getAllByTestId('skeleton-row')) {
      expect(row).toHaveClass('pointer-events-none');
      expect(row).toHaveAttribute('aria-hidden', 'true');
    }
    expect(screen.getByRole('status')).toHaveTextContent('Loading Patients…');
  });

  it('announces a bare "Loading…" without a label', () => {
    render(<SkeletonRows />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<SkeletonRows avatar label="Leads" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('SkeletonBar', () => {
  it('turns an input into a 36px rounded-lg bar', () => {
    const { container } = render(<SkeletonBar shape="field" />);
    expect(container.firstChild).toHaveClass(
      'h-9',
      'w-full',
      'rounded-lg',
      'bg-muted-strong',
    );
  });
});
