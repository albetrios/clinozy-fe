import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';

import { ProductMark, ProductWordmark } from './ProductMark.tsx';

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
