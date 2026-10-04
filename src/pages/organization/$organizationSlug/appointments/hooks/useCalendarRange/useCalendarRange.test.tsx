import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { staffRef } from '@/shared/api/clinic/fixtures/staff.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  APPOINTMENTS_PAGE,
  renderAppointmentsRoutes,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { useCalendarRange } from './useCalendarRange.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { error: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

/** The read's range and the dates and doctors it returned. */
function Probe({ doctors }: { doctors: 'picked' | 'every' }) {
  const read = useCalendarRange('week', doctors);
  return (
    <output data-testid="read" data-pending={read.pending}>
      {JSON.stringify({
        range: read.range,
        dates: [...new Set(read.rows.map((row) => row.date))],
        doctors: [...new Set(read.rows.map((row) => row.doctorId))],
      })}
    </output>
  );
}

async function readOf(doctors: 'picked' | 'every', url: string) {
  renderAppointmentsRoutes(url, () => <Probe doctors={doctors} />);
  const output = await screen.findByTestId('read');
  await waitFor(() => expect(output).toHaveAttribute('data-pending', 'false'));
  return JSON.parse(output.textContent ?? '{}') as {
    range: { from: string; to: string };
    dates: string[];
    doctors: string[];
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  resetClinicFixtures();
  notifyMock.error.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('useCalendarRange', () => {
  it('reads the view’s days around the URL’s anchor, Sunday to Saturday for a Week', async () => {
    const read = await readOf('picked', `${APPOINTMENTS_PAGE}?view=week&date=2026-10-07`);
    expect(read.range).toEqual({ from: '2026-10-04', to: '2026-10-10' });
    expect(read.dates.length).toBeGreaterThan(0);
    expect(read.dates.every((date) => date >= '2026-10-04' && date <= '2026-10-10')).toBe(
      true,
    );
  });

  it('keeps to the doctors the URL picks', async () => {
    const doctor = staffRef('DR');
    const url = `${APPOINTMENTS_PAGE}?view=week&date=2026-10-07&doctor=${doctor}`;
    expect((await readOf('picked', url)).doctors).toEqual([doctor]);
  });

  it('reads every doctor for a view that counts each one itself', async () => {
    const doctor = staffRef('DR');
    const url = `${APPOINTMENTS_PAGE}?view=week&date=2026-10-07&doctor=${doctor}`;
    expect((await readOf('every', url)).doctors.length).toBeGreaterThan(1);
  });
});
