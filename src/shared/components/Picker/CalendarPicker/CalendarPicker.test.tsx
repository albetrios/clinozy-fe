import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { CalendarPicker, type CalendarPickerProps } from './CalendarPicker.tsx';

const tier = vi.hoisted(() => ({ current: 'desktop' as 'phone' | 'tablet' | 'desktop' }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => tier.current,
}));

function Controlled({
  initial = null,
  onPick = () => {},
  ...props
}: Omit<CalendarPickerProps, 'value' | 'onChange'> & {
  initial?: string | null;
  onPick?: (date: string) => void;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <CalendarPicker
      today="2026-10-03"
      {...props}
      value={value}
      onChange={(date) => {
        setValue(date);
        onPick(date);
      }}
    />
  );
}

/** The day button for a calendar day of October 2026. */
function october(day: number): HTMLElement {
  const button = screen
    .getAllByRole('button')
    .find(
      (candidate) =>
        candidate.hasAttribute('data-day') &&
        candidate.textContent?.trim() === String(day),
    );
  if (!button) throw new Error(`no day ${day}`);
  return button;
}

beforeEach(() => {
  tier.current = 'desktop';
});

describe('CalendarPicker', () => {
  it('shows "Pick a date" until a day is picked', () => {
    render(<Controlled label="Birth date" />);
    const trigger = screen.getByTestId('calendar-picker');
    expect(trigger).toHaveTextContent('Pick a date');
    expect(trigger).toHaveAccessibleName('Birth date');
  });

  it('opens the 260px calendar (padding 10px, rounded-xl) on the picked day', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="2026-10-12" />);
    expect(screen.getByTestId('calendar-picker')).toHaveAccessibleName(/^Date · .*2026/);
    await user.click(screen.getByTestId('calendar-picker'));
    const panel = await screen.findByTestId('calendar-picker-panel');
    expect(panel).toHaveClass('w-65', 'p-2.5', 'rounded-xl');
    expect(panel.querySelector('[data-slot="calendar"]')).not.toBeNull();
    await waitFor(() => expect(october(12)).toHaveFocus());
  });

  it('picks a day as a civil date and closes', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onPick={onPick} />);
    await user.click(screen.getByTestId('calendar-picker'));
    await screen.findByTestId('calendar-picker-panel');
    await user.click(october(15));
    expect(onPick).toHaveBeenCalledWith('2026-10-15');
    await waitFor(() =>
      expect(screen.queryByTestId('calendar-picker-panel')).not.toBeInTheDocument(),
    );
  });

  it('disables days outside min / max', async () => {
    const user = userEvent.setup();
    render(<Controlled min="2026-10-05" max="2026-10-20" />);
    await user.click(screen.getByTestId('calendar-picker'));
    await screen.findByTestId('calendar-picker-panel');
    expect(october(4)).toBeDisabled();
    expect(october(5)).toBeEnabled();
    expect(october(21)).toBeDisabled();
  });

  it('opens the picker sheet on a phone', async () => {
    tier.current = 'phone';
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByTestId('calendar-picker'));
    expect(await screen.findByTestId('calendar-picker-panel')).toHaveAttribute(
      'data-picker-surface',
      'sheet',
    );
  });

  it('has no accessibility violations while open', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<Controlled initial="2026-10-12" />);
    await user.click(screen.getByTestId('calendar-picker'));
    await screen.findByTestId('calendar-picker-panel');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
