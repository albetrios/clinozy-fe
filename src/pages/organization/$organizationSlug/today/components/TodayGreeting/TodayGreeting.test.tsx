import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { appInstant } from '@/shared/api/app/app-time.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { TodayGreeting, type TodayGreetingProps } from './TodayGreeting.tsx';

const COUNTS = { inClinic: 6, waiting: 2, arriving: 3 };

function renderGreeting(props: Partial<TodayGreetingProps> = {}) {
  return renderWithProviders(
    <TodayGreeting
      firstName="Riya"
      now={new Date(appInstant('2026-10-03', '10:42'))}
      counts={COUNTS}
      onNewBooking={vi.fn()}
      onWalkIn={vi.fn()}
      {...props}
    />,
  );
}

const initialHourCycle = useLocaleStore.getState().hourCycle;
beforeEach(() => useLocaleStore.setState({ hourCycle: 'h23' }));
afterEach(() => useLocaleStore.setState({ hourCycle: initialHourCycle }));

describe('TodayGreeting (KICKOFF §6.2 Greeting row)', () => {
  it.each([
    ['08:00', 'Good morning, Riya'],
    ['11:59', 'Good morning, Riya'],
    ['12:00', 'Good afternoon, Riya'],
    ['16:59', 'Good afternoon, Riya'],
    ['17:00', 'Good evening, Riya'],
    ['22:30', 'Good evening, Riya'],
  ])(
    'greets on the clinic-local clock at %s — no 09:00–19:59 clamp',
    async (time, text) => {
      renderGreeting({ now: new Date(appInstant('2026-10-03', time)) });
      expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(text);
    },
  );

  it('greets "there" without a first name, and keeps "Dr."', async () => {
    const { unmount } = renderGreeting({ firstName: null });
    expect(await screen.findByTestId('today-greeting')).toHaveTextContent(
      'Good morning, there',
    );
    unmount();
    renderGreeting({ firstName: 'Dr. Nisha' });
    expect(await screen.findByTestId('today-greeting')).toHaveTextContent(
      'Good morning, Dr. Nisha',
    );
  });

  it('reads the pulse: in clinic, waiting, arriving, the clinic day and time', async () => {
    renderGreeting();
    const pulse = await screen.findByTestId('today-pulse');
    expect(pulse.textContent).toMatch(
      /^6 in clinic · 2 waiting · 3 arriving · Sat,? (3 Oct|Oct 3), 10:42$/,
    );
  });

  it('offers "New booking" with Leads Create and "Walk-in" with Appointments Create', async () => {
    const user = userEvent.setup();
    const onNewBooking = vi.fn();
    const onWalkIn = vi.fn();
    const { container } = renderGreeting({ onNewBooking, onWalkIn });
    await user.click(await screen.findByRole('button', { name: 'New booking' }));
    await user.click(screen.getByRole('button', { name: 'Walk-in' }));
    expect(onNewBooking).toHaveBeenCalledTimes(1);
    expect(onWalkIn).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('hides "New booking" without Leads Create', async () => {
    renderGreeting({ onNewBooking: undefined });
    await screen.findByTestId('today-greeting');
    expect(screen.queryByTestId('today-new-booking')).not.toBeInTheDocument();
    expect(screen.getByTestId('today-walk-in')).toBeInTheDocument();
  });

  it('hides "Walk-in" without Appointments Create (F4, D163)', async () => {
    renderGreeting({ onWalkIn: undefined });
    await screen.findByTestId('today-greeting');
    expect(screen.queryByTestId('today-walk-in')).not.toBeInTheDocument();
  });

  it('leads the pulse with a live dot, and makes "New booking" the primary button', async () => {
    renderGreeting({ onNewBooking: vi.fn(), onWalkIn: vi.fn() });
    const pulse = await screen.findByTestId('today-pulse');
    const dot = pulse.querySelector('span[aria-hidden="true"]');
    expect(dot).toHaveAttribute('title', 'Live · refreshes every minute');
    expect(dot?.className).toContain('motion-reduce:animate-none');
    const newBooking = screen.getByTestId('today-new-booking');
    expect(newBooking).toHaveAttribute('data-variant', 'default');
    expect(newBooking).toHaveAttribute('aria-keyshortcuts', 'N');
    expect(screen.getByTestId('today-walk-in')).toHaveAttribute(
      'data-variant',
      'outline',
    );
    expect(screen.getByTestId('today-walk-in')).toHaveAttribute('aria-keyshortcuts', 'W');
  });

  it('holds the floor finder and the keyboard button, which opens the shortcuts list', async () => {
    const user = userEvent.setup();
    const onShortcuts = vi.fn();
    renderGreeting({
      onShortcuts,
      finder: <input aria-label="Find someone on today’s floor" />,
    });
    expect(
      await screen.findByRole('textbox', { name: 'Find someone on today’s floor' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(onShortcuts).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('today-shortcuts')).toHaveClass('max-md:hidden');
  });
});
