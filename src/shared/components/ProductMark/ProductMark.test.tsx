import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';

import { BrandLogo, ProductMark, ProductWordmark } from './ProductMark.tsx';

describe('ProductMark', () => {
  it('draws the tile, the C stroke and the dot from tokens', async () => {
    const { container } = render(
      <span role="img" aria-label={PRODUCT_NAME}>
        <ProductMark className="size-7" />
      </span>,
    );
    const mark = screen.getByTestId('product-mark');
    expect(mark).toHaveAttribute('aria-hidden');
    expect(mark.querySelector('rect')).toHaveClass('fill-primary');
    expect(mark.querySelector('path')).toHaveClass('stroke-primary-foreground');
    expect(mark.querySelector('circle')).toHaveClass('fill-brand-mark');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ProductWordmark', () => {
  it('writes the name in lower case with its first "o" as a ring', () => {
    render(<ProductWordmark />);
    const word = screen.getByTestId('product-wordmark');
    expect(word).toHaveAttribute('aria-hidden');
    const name = PRODUCT_NAME.toLowerCase();
    expect(word.textContent).toBe(name.replace('o', ''));
    expect(word.querySelectorAll('circle')).toHaveLength(name.includes('o') ? 2 : 0);
  });

  it('stays still by default: no loader rides on the logo', () => {
    render(<ProductWordmark />);
    expect(
      screen.getByTestId('product-wordmark').querySelector('[data-slot="spinner"]'),
    ).toBeNull();
  });

  // The one loader, drawn in the brand: the ring keeps its ink, an arc turns round it.
  it.runIf(PRODUCT_NAME.toLowerCase().includes('o'))(
    'turns its "o" as the loader when asked',
    () => {
      render(<ProductWordmark turning />);
      const ring = screen.getByTestId('product-wordmark').querySelector('svg');
      expect(ring).toHaveAttribute('data-slot', 'spinner');
      const arc = ring?.querySelectorAll('circle')[1];
      expect(arc).toHaveClass('stroke-brand-mark-strong');
      expect(arc).toHaveAttribute('stroke-dasharray', '16 100');
    },
  );

  it('reads left to right under an RTL page, its parts in order', () => {
    document.documentElement.dir = 'rtl';
    try {
      render(<ProductWordmark />);
      expect(screen.getByTestId('product-wordmark')).toHaveAttribute('dir', 'ltr');
    } finally {
      document.documentElement.dir = '';
    }
  });
});

describe('BrandLogo', () => {
  it('is the 28px mark alone by default, named once', () => {
    render(<BrandLogo />);
    const logo = screen.getByRole('img', { name: PRODUCT_NAME });
    expect(logo).toHaveAttribute('data-testid', 'brand-logo');
    expect(screen.getByTestId('product-mark')).toHaveClass('size-7');
    expect(screen.queryByTestId('product-wordmark')).toBeNull();
  });

  it('shows the 19px wordmark from md up in the section bar ("md")', () => {
    render(<BrandLogo wordmark="md" />);
    const word = screen.getByTestId('product-wordmark');
    expect(word).toHaveClass('text-[1.1875rem]');
    expect(word.parentElement).toHaveClass('hidden', 'md:inline-flex');
  });

  it('shows the wordmark at every width on the signed-out frame ("always")', () => {
    render(<BrandLogo wordmark="always" />);
    const wrapper = screen.getByTestId('product-wordmark').parentElement;
    expect(wrapper).toHaveClass('inline-flex');
    expect(wrapper).not.toHaveClass('hidden');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<BrandLogo wordmark="always" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
