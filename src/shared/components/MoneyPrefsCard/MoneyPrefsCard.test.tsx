import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

type MockLocaleState = {
  numberStyle: 'auto';
  currencyDisplay: 'auto';
  currencyCode: 'USD';
  setNumberStyle: (f: string) => void;
  setCurrencyDisplay: (f: string) => void;
  setCurrencyCode: (f: string) => void;
};

const { setNumberStyleMock, setCurrencyDisplayMock, setCurrencyCodeMock } = vi.hoisted(
  () => ({
    setNumberStyleMock: vi.fn(),
    setCurrencyDisplayMock: vi.fn(),
    setCurrencyCodeMock: vi.fn(),
  }),
);

vi.mock('@/shared/store/useLocaleStore/index.ts', () => ({
  useLocaleStore: (selector: (s: MockLocaleState) => unknown) =>
    selector({
      numberStyle: 'auto',
      currencyDisplay: 'auto',
      currencyCode: 'USD',
      setNumberStyle: setNumberStyleMock,
      setCurrencyDisplay: setCurrencyDisplayMock,
      setCurrencyCode: setCurrencyCodeMock,
    }),
}));

vi.mock('@/shared/hooks/useLocaleFormat/index.ts', () => ({
  useLocaleFormat: () => ({
    formatNumber: () => '1,284.5',
    formatCurrency: () => '$99.00',
    formatRelativeTime: () => '2 hours ago',
    direction: 'ltr',
    firstDayOfWeek: 'sunday',
    measurementSystem: 'imperial',
  }),
}));

import { pickerTestIds } from '@/shared/components/Picker/index.ts';
import { renderWithQueryClient } from '@/tests/utils/renderWithProviders.tsx';

import { MoneyPrefsCard } from './MoneyPrefsCard.tsx';

const CURRENCY = pickerTestIds('currency-code-select');

describe('MoneyPrefsCard', () => {
  beforeEach(() => {
    setNumberStyleMock.mockClear();
    setCurrencyDisplayMock.mockClear();
    setCurrencyCodeMock.mockClear();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithQueryClient(<MoneyPrefsCard />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('updates number style and currency display', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<MoneyPrefsCard />);
    expect(screen.getByTestId('money-prefs')).toBeInTheDocument();
    await user.click(screen.getByTestId('number-style-compact'));
    expect(setNumberStyleMock).toHaveBeenCalledWith('compact');
    await user.click(screen.getByTestId('currency-display-code'));
    expect(setCurrencyDisplayMock).toHaveBeenCalledWith('code');
  });

  it('picks the currency from the picker', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<MoneyPrefsCard />);
    await user.click(screen.getByTestId(CURRENCY.trigger));
    await user.click(await screen.findByTestId(CURRENCY.option('EUR')));
    expect(setCurrencyCodeMock).toHaveBeenCalledWith('EUR');
  });

  it('surfaces the derived locale experience (direction, week start, units)', () => {
    renderWithQueryClient(<MoneyPrefsCard />);
    expect(screen.getByTestId('locale-preview-direction')).toBeInTheDocument();
    expect(screen.getByTestId('locale-preview-first-day')).toBeInTheDocument();
    expect(screen.getByTestId('locale-preview-measurement')).toBeInTheDocument();
  });
});
