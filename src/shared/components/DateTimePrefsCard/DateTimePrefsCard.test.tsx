import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { pickerTestIds } from '@/shared/components/Picker/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { renderWithQueryClient } from '@/tests/utils/renderWithProviders.tsx';

import { DateTimePrefsCard } from './DateTimePrefsCard.tsx';

const FORMAT_LOCALE = pickerTestIds('format-locale-select');
const TIME_ZONE = pickerTestIds('time-zone-select');

describe('DateTimePrefsCard', () => {
  beforeEach(() => {
    useLocaleStore.setState({
      formatLocale: 'en-US',
      dateFormat: 'auto',
      hourCycle: 'auto',
      timeZone: 'auto',
    });
  });

  it('renders regional locale, timezone, and format controls', async () => {
    const { container } = renderWithQueryClient(<DateTimePrefsCard />);
    expect(screen.getByTestId('date-time-prefs')).toBeInTheDocument();
    expect(screen.getByTestId(FORMAT_LOCALE.trigger)).toBeInTheDocument();
    expect(screen.getByTestId(TIME_ZONE.trigger)).toBeInTheDocument();
    expect(screen.getByTestId('date-format-auto')).toBeInTheDocument();
    expect(screen.getByTestId('hour-cycle-h12')).toBeInTheDocument();
    expect(screen.getByTestId('locale-preview-timezone')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('updates date format and hour cycle from the pills', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<DateTimePrefsCard />);
    await user.click(screen.getByTestId('date-format-short'));
    expect(useLocaleStore.getState().dateFormat).toBe('short');
    await user.click(screen.getByTestId('hour-cycle-h23'));
    expect(useLocaleStore.getState().hourCycle).toBe('h23');
  });

  it('updates format locale and timezone from the pickers', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<DateTimePrefsCard />);

    await user.click(screen.getByTestId(FORMAT_LOCALE.trigger));
    await user.click(await screen.findByTestId(FORMAT_LOCALE.option('ja-JP')));
    expect(useLocaleStore.getState().formatLocale).toBe('ja-JP');

    await user.click(screen.getByTestId(TIME_ZONE.trigger));
    await user.click(await screen.findByTestId(TIME_ZONE.option('UTC')));
    expect(useLocaleStore.getState().timeZone).toBe('UTC');
  });

  it('opens a picker from the keyboard (↓) and searches its long list', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<DateTimePrefsCard />);
    screen.getByTestId(TIME_ZONE.trigger).focus();
    await user.keyboard('{ArrowDown}');
    // More than seven zones: the list carries the search row.
    expect(await screen.findByTestId(TIME_ZONE.search)).toBeInTheDocument();
  });
});
