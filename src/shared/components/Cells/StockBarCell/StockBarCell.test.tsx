import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { StockBarCell } from './StockBarCell.tsx';

describe('StockBarCell', () => {
  it('says the level and fills the bar to the stock in the level ink', async () => {
    const { container } = render(
      <StockBarCell label="2 in stock · Low" percent={20} tone="butter" />,
    );
    expect(screen.getByText('2 in stock · Low')).toBeVisible();
    const fill = screen.getByTestId('stock-bar-fill');
    expect(fill.style.getPropertyValue('--fill')).toBe('20%');
    expect(fill).toHaveClass('bg-tone-butter-foreground');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps the fill inside the bar', () => {
    render(<StockBarCell label="40 in stock · OK" percent={140} tone="sage" />);
    expect(screen.getByTestId('stock-bar-fill').style.getPropertyValue('--fill')).toBe(
      '100%',
    );
  });
});
