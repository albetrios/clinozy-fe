import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { DatePicker, type DatePickerProps } from './DatePicker.tsx';

vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
}));

const TODAY = '2026-10-03';

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  return {
    user,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

function Controlled({
  initial = null,
  onPick = () => {},
  ...props
}: Omit<DatePickerProps, 'value' | 'onChange'> & {
  initial?: string | null;
  onPick?: (date: string | null) => void;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <DatePicker
      today={TODAY}
      {...props}
      value={value}
      onChange={(date) => {
        setValue(date);
        onPick(date);
      }}
    />
  );
}

beforeEach(() => {});

describe('DatePicker', () => {
  it('opens on today, grouped Today / Coming up / month, at 32px with the date search', async () => {
    const { user } = renderWithClient(<Controlled initial={TODAY} />);
    const trigger = screen.getByTestId('date-picker');
    expect(trigger).toHaveClass('min-h-8');
    expect(trigger).toHaveAccessibleName(/^Date · Today · /);

    await user.click(trigger);
    const panel = await screen.findByTestId('date-picker-panel');
    expect(panel.className).toContain('min-w-62.5');
    expect(screen.getByTestId('date-picker-search')).toHaveAttribute(
      'placeholder',
      'Type a date · e.g. 12 sep',
    );
    const today = screen.getByTestId(`date-picker-option-${TODAY}`);
    expect(today).toHaveTextContent(/^Today · /);
    expect(today).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('date-picker-option-2026-10-04')).toHaveTextContent(
      /^Tomorrow · /,
    );
    expect(within(panel).getByRole('group', { name: 'Today' })).toBeInTheDocument();
    expect(within(panel).getByRole('group', { name: 'Coming up' })).toBeInTheDocument();
  });

  it('reaches the past grouped by month, and picks a civil date', async () => {
    const onPick = vi.fn();
    const { user } = renderWithClient(<Controlled onPick={onPick} past={3} future={0} />);
    await user.click(screen.getByTestId('date-picker'));
    const panel = await screen.findByTestId('date-picker-panel');
    expect(screen.getByTestId('date-picker-option-2026-10-02')).toHaveTextContent(
      /^Yesterday · /,
    );
    expect(within(panel).getAllByRole('group')).toHaveLength(3);
    await user.click(screen.getByTestId('date-picker-option-2026-09-30'));
    expect(onPick).toHaveBeenCalledWith('2026-09-30');
  });

  it('reads a typed date and offers it first — even outside the list', async () => {
    const { user } = renderWithClient(<Controlled />);
    await user.click(screen.getByTestId('date-picker'));
    const search = await screen.findByTestId('date-picker-search');

    await user.type(search, '12 sep');
    const [first] = screen.getAllByRole('option');
    expect(first).toHaveAttribute('data-testid', 'date-picker-option-2026-09-12');

    await user.clear(search);
    await user.type(search, '25 dec');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute(
      'data-testid',
      'date-picker-option-2026-12-25',
    );
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByTestId('date-picker')).toHaveAccessibleName(/^Date · .*25/),
    );
  });

  it('refuses a typed date outside min / max', async () => {
    const { user } = renderWithClient(<Controlled min="2026-10-01" />);
    await user.click(screen.getByTestId('date-picker'));
    await user.type(await screen.findByTestId('date-picker-search'), '12 sep');
    expect(screen.queryByTestId('date-picker-option-2026-09-12')).not.toBeInTheDocument();
    expect(screen.getByTestId('date-picker-empty')).toBeInTheDocument();
  });

  it('names a value outside the window on the trigger, and clears it', async () => {
    const onPick = vi.fn();
    const { user } = renderWithClient(
      <Controlled initial="2025-01-15" clearable onPick={onPick} label="Bill date" />,
    );
    expect(screen.getByTestId('date-picker')).toHaveAccessibleName(/^Bill date · .*2025/);
    await user.click(screen.getByTestId('date-picker-clear'));
    expect(onPick).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('date-picker')).toHaveTextContent('Pick a date');
  });

  it('has no accessibility violations while open', async () => {
    const { user, baseElement } = renderWithClient(<Controlled initial={TODAY} />);
    await user.click(screen.getByTestId('date-picker'));
    await screen.findByTestId('date-picker-panel');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
