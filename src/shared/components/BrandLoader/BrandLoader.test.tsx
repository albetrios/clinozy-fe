import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';

import { BrandLoader } from './BrandLoader.tsx';

describe('BrandLoader', () => {
  it('renders the branded loading visual', () => {
    render(<BrandLoader />);
    expect(screen.getByTestId('brand-loader')).toBeInTheDocument();
  });

  // One loader everywhere: the wordmark's own "o" turns — no bar, no second glyph.
  it('turns the wordmark’s "o" and draws no progress bar', () => {
    render(<BrandLoader />);
    const loader = screen.getByTestId('brand-loader');
    const ring = PRODUCT_NAME.toLowerCase().includes('o') ? 1 : 0;
    expect(loader.querySelectorAll('[data-slot="spinner"]')).toHaveLength(ring);
    expect(loader.querySelector('[data-slot="pill"]')).toBeNull();
  });

  // The whole point of this component: it is safe to place next to other content.
  // A `fixed`/`absolute` root would paint over its siblings, which is exactly how
  // FullPageSpinner hid the auth screen's cancel button (LOGIN-1).
  it('stays in flow so it cannot cover sibling content', () => {
    render(<BrandLoader />);
    const position = getComputedStyle(screen.getByTestId('brand-loader')).position;
    expect(position).not.toBe('fixed');
    expect(position).not.toBe('absolute');
  });

  it('merges a caller className', () => {
    render(<BrandLoader className="py-2" />);
    expect(screen.getByTestId('brand-loader')).toHaveClass('py-2');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<BrandLoader />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
