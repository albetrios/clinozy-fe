import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { MoneyCell } from './MoneyCell.tsx';

describe('MoneyCell', () => {
  beforeEach(() => {
    useLocaleStore.setState({ formatLocale: 'en-IN', currencyDisplay: 'auto' });
  });

  afterEach(() => {
    useLocaleStore.setState({ formatLocale: 'en-US', currencyDisplay: 'auto' });
  });

  it('formats integer paise as rupees with the Indian grouping', () => {
    render(<MoneyCell paise={12345600} />);
    const cell = screen.getByText('₹1,23,456');
    expect(cell).toHaveClass('tabular-nums', 'whitespace-nowrap');
    expect(cell).toHaveAttribute('data-slot', 'money');
  });

  it('shows clinozy-be’s rupees as the same amount in paise would show', () => {
    render(<MoneyCell rupees={2399.5} signed />);
    expect(screen.getByText('+₹2,399.50')).toBeInTheDocument();
  });

  it('keeps paise when there are some', () => {
    render(<MoneyCell paise={239950} />);
    expect(screen.getByText('₹2,399.50')).toBeInTheDocument();
  });

  it('marks a negative with U+2212', () => {
    render(<MoneyCell paise={-23900} />);
    expect(screen.getByText('−₹239')).toBeInTheDocument();
  });

  it('signs a positive amount only when asked', () => {
    const { rerender } = render(<MoneyCell paise={50000} signed />);
    expect(screen.getByText('+₹500')).toBeInTheDocument();
    rerender(<MoneyCell paise={-50000} signed />);
    expect(screen.getByText('−₹500')).toBeInTheDocument();
    rerender(<MoneyCell paise={0} signed />);
    expect(screen.getByText('₹0')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<MoneyCell paise={120000} className="font-semibold" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
