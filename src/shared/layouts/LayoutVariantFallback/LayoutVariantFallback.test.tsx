import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { LayoutVariantFallback } from './LayoutVariantFallback.tsx';

describe('LayoutVariantFallback', () => {
  it('renders a shell-shaped busy placeholder while a layout variant chunk loads', () => {
    render(<LayoutVariantFallback />);
    const fallback = screen.getByTestId('layout-variant-fallback');
    expect(fallback).toBeInTheDocument();
    // A live region + sr-only text, not `aria-label` on a bare div: a label on an
    // element with no role is an axe `aria-prohibited-attr` violation. Asserted
    // through the resolved role rather than the literal attribute, because the
    // element is an `<output>`, which carries role="status" implicitly.
    expect(screen.getByRole('status')).toBe(fallback);
    expect(fallback).toHaveAttribute('aria-busy', 'true');
    // Translated via a11y.loading — asserting the key's English value, not a literal.
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('fills the frame rather than sitting in a strip on a blank page (SHELL-1)', () => {
    render(<LayoutVariantFallback />);
    // `min-h-24` made a shell swap read as a broken page; the placeholder has to
    // hold the shape of the thing it stands in for.
    expect(screen.getByTestId('layout-variant-fallback')).toHaveClass('flex-1');
  });

  it("holds the launch shell's shape: the section bar's header and flat bars, no sidebar", () => {
    const { container } = render(<LayoutVariantFallback />);
    const fallback = screen.getByTestId('layout-variant-fallback');
    const [, header, body] = Array.from(fallback.children);
    expect(header).toHaveClass('min-h-13', 'md:min-h-15', 'border-b', 'bg-card');
    expect(body).toHaveClass('p-(--room-toolbar-pad)');
    // No nav rail: the design has no sidebar.
    expect(container.querySelector('.bg-sidebar\\/40')).toBeNull();
    // The design's skeleton is flat bars, never a pulse.
    const bars = container.querySelectorAll('[data-slot="skeleton"]');
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) expect(bar).toHaveClass('animate-none', 'bg-muted-strong');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<LayoutVariantFallback />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
