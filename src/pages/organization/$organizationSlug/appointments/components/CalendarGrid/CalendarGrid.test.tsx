import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { AppointmentRow } from '@/shared/api/app/appointments-contracts.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  APPOINTMENT_NOW,
  APPOINTMENT_TODAY,
  appointmentRow,
} from '@/tests/utils/appointment-doubles.ts';

import { publicId } from '../../__tests__/integration/appointments-test-data.ts';
import {
  grantAppAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { CalendarCard, DayColumn, HourRail } from './CalendarGrid.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

const TODAY = APPOINTMENT_TODAY;
/** The clinic clock at 10:00 on the test's today. */
const CLOCK = { today: TODAY, minutes: 600 };

let made = 0;
/** A booking of its own id today, as a test asks. */
const booking = (overrides: Partial<AppointmentRow>): AppointmentRow => {
  made += 1;
  return appointmentRow({ id: publicId('appt', `b${made}`), date: TODAY, ...overrides });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  signInTestMember();
  grantAppAccess('owner');
});
afterEach(() => vi.useRealTimers());

describe('HourRail (H:2060)', () => {
  it('labels 9 AM to 9 PM, one per 88px', async () => {
    const { container } = renderInAppointments(<HourRail />);
    await screen.findByText('9 AM');
    const labels = [...container.querySelectorAll('[aria-hidden="true"] > span')];
    expect(labels).toHaveLength(13);
    expect(labels.at(-1)).toHaveTextContent('9 PM');
    expect((labels[1] as HTMLElement).style.getPropertyValue('--rail-top')).toBe('88px');
  });
});

describe('DayColumn (H:2061–2064)', () => {
  it('splits overlapping bookings into lanes and names a same-doctor clash on the Day', async () => {
    const rows = [
      booking({ startTime: '11:00', durationMin: 45 }),
      booking({ startTime: '11:30', durationMin: 30 }),
    ];
    renderInAppointments(<DayColumn date={TODAY} rows={rows} clock={CLOCK} sayClash />);
    const blocks = await screen.findAllByTestId('appointments-block');
    expect(blocks.map((block) => block.style.getPropertyValue('--block-width'))).toEqual([
      'calc((100% - 6px) / 2 - 2px)',
      'calc((100% - 6px) / 2 - 2px)',
    ]);
    expect(blocks[1]?.style.getPropertyValue('--block-start')).toBe(
      'calc(3px + (100% - 6px) * 1 / 2)',
    );
    for (const block of blocks) {
      expect(block.getAttribute('title')).toMatch(/overlaps another booking$/);
    }
  });

  it('veils today down to the now line and draws the line; a past day is veiled whole', async () => {
    const { container, unmount } = renderInAppointments(
      <DayColumn date={TODAY} rows={[]} clock={CLOCK} />,
    );
    const now = await screen.findByTestId('appointments-now-line');
    expect(now.style.getPropertyValue('--now')).toBe('88px');
    const veil = container.querySelector<HTMLElement>('.bg-muted\\/75');
    expect(veil?.style.getPropertyValue('--veil')).toBe('88px');
    unmount();
    const past = renderInAppointments(
      <DayColumn date="2026-10-02" rows={[]} clock={CLOCK} />,
    );
    await within(past.container).findByTestId('appointments-day-column');
    expect(
      past.container
        .querySelector<HTMLElement>('.bg-muted\\/75')
        ?.style.getPropertyValue('--veil'),
    ).toBe('100%');
    expect(within(past.container).queryByTestId('appointments-now-line')).toBeNull();
  });

  it('books the empty slot under the pointer, rounded to 15 minutes', async () => {
    const onSlot = vi.fn();
    renderInAppointments(
      <DayColumn date="2026-10-05" rows={[]} clock={CLOCK} onSlot={onSlot} />,
    );
    const column = await screen.findByTestId('appointments-day-column');
    const slot = column.querySelector<HTMLButtonElement>(
      '[data-testid="appointments-day-slots"]',
    );
    expect(slot).toHaveAttribute('title', 'Click an empty slot to book');
    expect(slot).toHaveAttribute('aria-hidden', 'true');
    expect(slot).toHaveAttribute('tabindex', '-1');
    vi.spyOn(slot as HTMLButtonElement, 'getBoundingClientRect').mockReturnValue({
      top: 100,
    } as DOMRect);
    // 100 + 88 + 38 → 1h 26min below 9 am → 10:26 → 10:30.
    fireEvent.click(slot as HTMLButtonElement, { clientY: 226 });
    expect(onSlot).toHaveBeenCalledWith('10:30');
  });

  it('offers no slot without a booking handler (the Week, or no Create)', async () => {
    renderInAppointments(<DayColumn date="2026-10-05" rows={[]} clock={CLOCK} />);
    const column = await screen.findByTestId('appointments-day-column');
    expect(column.querySelector('[data-testid="appointments-day-slots"]')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderInAppointments(
      <CalendarCard view="day">
        <div className="grid grid-cols-[52px_1fr]">
          <HourRail />
          <DayColumn
            date={TODAY}
            rows={[booking({ startTime: '11:00', durationMin: 45 })]}
            clock={CLOCK}
            onSlot={vi.fn()}
          />
        </div>
      </CalendarCard>,
    );
    await screen.findByTestId('appointments-block');
    expect(screen.getByTestId('appointments-calendar')).toHaveAttribute(
      'data-view',
      'day',
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
