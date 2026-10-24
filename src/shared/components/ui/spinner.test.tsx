import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { Spinner } from './spinner.tsx';

function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('Spinner rendered no <svg>');
  return svg;
}

describe('Spinner', () => {
  it('draws at the inline icon size by default, turned by its data-slot', () => {
    const { container } = render(<Spinner />);
    const svg = svgOf(container);
    expect(svg).toHaveAttribute('data-slot', 'spinner');
    expect(svg).toHaveClass('size-4');
    // index.css turns it: no animation class rides on the glyph.
    expect(svg.getAttribute('class')).not.toMatch(/animate-/);
  });

  // The wordmark's "o": a faint ring, the turning arc, the brand-mark dot.
  it('draws the ring, the arc and the brand-mark dot', () => {
    const { container } = render(<Spinner />);
    const [ring, arc, dot] = Array.from(svgOf(container).querySelectorAll('circle'));
    expect(ring).toHaveAttribute('stroke-opacity', '0.2');
    expect(arc).toHaveAttribute('stroke-dasharray', '16 100');
    expect(arc).toHaveAttribute('stroke-linecap', 'round');
    expect(dot).toHaveClass('fill-brand-mark');
  });

  // Every call site sits next to text or inside something that already reports it is busy.
  // A spinner that announced itself too would make screen readers say it twice.
  it('is hidden from assistive technology by default', () => {
    const { container } = render(<Spinner />);
    expect(svgOf(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('lets a caller size replace the default rather than fight it', () => {
    const { container } = render(<Spinner className="text-primary size-8" />);
    const svg = svgOf(container);
    expect(svg).toHaveClass('size-8', 'text-primary');
    expect(svg).not.toHaveClass('size-4');
  });

  it('passes other props through to the glyph', () => {
    const { getByTestId } = render(<Spinner data-testid="row-spinner" />);
    expect(getByTestId('row-spinner')).toHaveAttribute('data-slot', 'spinner');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Spinner />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
