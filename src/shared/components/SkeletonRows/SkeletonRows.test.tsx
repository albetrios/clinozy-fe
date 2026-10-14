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

  it('draws one full width cycle by default', () => {
    render(<SkeletonRows />);
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(3);
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

  it('opts in to a staggered sheen sweep (shimmer)', () => {
    render(<SkeletonRows rows={3} avatar shimmer />);
    const [first, second] = bars();
    // The sweep is `skeleton-sheen.css`; the primitive's pulse stays off.
    expect(first).toHaveClass('bg-muted-strong', 'skeleton-sheen', 'animate-none');
    expect(first).not.toHaveClass('animate-pulse');
    expect(first).toHaveAttribute('data-sweep', '0');
    expect(second).toHaveAttribute('data-sweep', '1');
    // The avatar sweeps with its row.
    const avatar = screen
      .getAllByTestId('skeleton-row')[1]
      ?.querySelector('[data-slot="skeleton"]');
    expect(avatar).toHaveClass('skeleton-sheen', 'rounded-full');
    expect(avatar).toHaveAttribute('data-sweep', '1');
  });

  it('keeps flat bars free of the sheen', () => {
    render(<SkeletonRows rows={2} />);
    for (const bar of bars()) {
      expect(bar).not.toHaveClass('skeleton-sheen');
      expect(bar).not.toHaveAttribute('data-sweep');
    }
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
  it('takes a host width over the cycle', () => {
    const { container } = render(<SkeletonBar index={1} className="w-3/5" />);
    expect(container.firstChild).toHaveClass('w-3/5');
    expect(container.firstChild).not.toHaveClass('w-[48%]');
  });

  it('cycles the shimmer stagger every three rows', () => {
    const { container } = render(<SkeletonBar index={4} shimmer />);
    expect(container.firstChild).toHaveAttribute('data-sweep', '1');
  });

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
