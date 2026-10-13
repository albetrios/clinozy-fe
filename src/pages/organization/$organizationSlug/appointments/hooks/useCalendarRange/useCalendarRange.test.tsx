import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
import { fetchAppointmentRange } from '@/shared/api/app/appointments-api.ts';
import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import { saveMyPreferences } from '@/shared/api/app/preferences-api.ts';
import { notify } from '@/shared/notify/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  APPOINTMENT_NOW,
  DOCTOR_ARJUN,
  DOCTOR_NISHA,
  TEST_BRANCH_ID,
} from '@/tests/utils/appointment-doubles.ts';

import {
  type AppointmentsWorld,
  seededAppointmentsWorld,
} from '../../__tests__/integration/appointments-test-data.ts';
import {
  APPOINTMENTS_PAGE,
  renderAppointmentsRoutes,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { useCalendarRange } from './useCalendarRange.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { error: vi.fn(), info: vi.fn(), success: vi.fn(), undo: vi.fn() },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

const world = vi.hoisted(() => ({}) as AppointmentsWorld);
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => {
  const { appointmentsApiDouble } =
    await import('../../__tests__/integration/appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof AppointmentsApiModule>()),
    ...appointmentsApiDouble(world),
  };
});
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => {
  const { directoryApiDouble } =
    await import('../../__tests__/integration/appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    ...directoryApiDouble(),
  };
});

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

/** The params of the last range read. */
const lastRead = () => vi.mocked(fetchAppointmentRange).mock.lastCall?.[0];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  vi.resetAllMocks();
  Object.assign(world, seededAppointmentsWorld());
  signInTestMember();
});
afterEach(() => vi.useRealTimers());

describe('useCalendarRange', () => {
  it('reads the view’s days around the URL’s anchor — Sunday to Saturday for a Week — with the page’s filters', async () => {
    const read = await readOf(
      'picked',
      `${APPOINTMENTS_PAGE}?view=week&date=2026-10-07&status=all&q=riya`,
    );
    expect(read.range).toEqual({ from: '2026-10-04', to: '2026-10-10' });
    expect(lastRead()).toEqual({
      from: '2026-10-04',
      to: '2026-10-10',
      status: 'all',
      doctorId: undefined,
      q: 'riya',
      created: undefined,
      branchIds: [],
    });
    expect(read.dates).toEqual(['2026-10-04']);
  });

  it('keeps to the doctor the URL picks', async () => {
    const url = `${APPOINTMENTS_PAGE}?view=week&doctor=${DOCTOR_ARJUN.id}`;
    const read = await readOf('picked', url);
    expect(lastRead()?.doctorId).toBe(DOCTOR_ARJUN.id);
    expect(read.doctors).toEqual([DOCTOR_ARJUN.id]);
  });

  it('reads every doctor for a view that counts each one itself', async () => {
    const url = `${APPOINTMENTS_PAGE}?view=week&doctor=${DOCTOR_ARJUN.id}`;
    const read = await readOf('every', url);
    expect(lastRead()?.doctorId).toBeUndefined();
    expect(read.doctors).toEqual(
      expect.arrayContaining([DOCTOR_NISHA.id, DOCTOR_ARJUN.id]),
    );
  });

  it('reads within the header’s branches', async () => {
    await saveMyPreferences({ branchFilter: [TEST_BRANCH_ID] });
    await readOf('picked', `${APPOINTMENTS_PAGE}?view=week`);
    await waitFor(() => expect(lastRead()?.branchIds).toEqual([TEST_BRANCH_ID]));
  });

  it('toasts a failed read with Retry, once', async () => {
    vi.mocked(fetchAppointmentRange).mockRejectedValueOnce(
      new Error('connection dropped'),
    );
    renderAppointmentsRoutes(`${APPOINTMENTS_PAGE}?view=week`, () => (
      <Probe doctors="picked" />
    ));
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledExactlyOnceWith(
        'Couldn’t load this list · connection dropped. Showing the last copy.',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Retry' }) }),
      ),
    );
  });
});
