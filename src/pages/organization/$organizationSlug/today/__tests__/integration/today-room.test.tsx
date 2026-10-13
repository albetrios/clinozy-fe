import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { Role } from '@/shared/api/app/app-schema.ts';
import { appInstant } from '@/shared/api/app/app-time.ts';
import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import type * as TasksApiModule from '@/shared/api/app/tasks-api.ts';
import { listTasks, recordTaskOutcome } from '@/shared/api/app/tasks-api.ts';
import type * as TodayApiModule from '@/shared/api/app/today-api.ts';
import type {
  TodayEnquiry,
  TodayFloorRow,
  TodayLane,
} from '@/shared/api/app/today-contracts.ts';
import { CROSS_ROOM_PARAM } from '@/shared/app/app-referrer.ts';
import { notify } from '@/shared/notify/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import type * as MyMembershipModule from '@/shared/tenancy/my-membership.ts';
import { previewPreset } from '@/tests/utils/app-preset-codes.ts';

import { TodayPage } from '../../TodayPage.tsx';
import {
  publicId,
  type QueueWorld,
  seededFloor,
  seededQueue,
  VIKRAM_VISIT_ID,
} from './today-fixtures.ts';
import {
  renderTodayRoute,
  resetTodayRoute,
  TODAY_FRONT_DESK_CODES,
  TODAY_PATH,
} from './today-test-router.tsx';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

/** The floor the mocked Today API serves and moves; `failing` fails its read. */
const floor = vi.hoisted(() => {
  const state = {
    failing: false,
    /** How many times the floor was read. */
    reads: 0,
    rows: [] as TodayFloorRow[],
    enquiries: [] as TodayEnquiry[],
    /** Apply a move to one row of the floor. */
    move: (id: string, patch: Partial<TodayFloorRow>) => {
      state.rows = state.rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
    },
  };
  return state;
});
vi.mock('@/shared/api/app/today-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof TodayApiModule>()),
  fetchTodayFloor: async () => {
    floor.reads += 1;
    if (floor.failing) throw new Error('connection dropped');
    return structuredClone(floor.rows);
  },
  fetchTodayEnquiries: async () => structuredClone(floor.enquiries),
  moveFloorStage: async ({
    appointmentId,
    stage,
  }: {
    appointmentId: string;
    stage: TodayFloorRow['visitStage'];
  }) => {
    floor.move(appointmentId, {
      visitStage: stage,
      visitStageChangedAt: new Date().toISOString(),
    });
  },
}));
/** Today checks in, and undoes it, through the booking's own move routes. */
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  moveAppointment: async ({
    appointmentId,
    route,
  }: {
    appointmentId: string;
    route: 'check-in' | 'undo-check-in';
  }) => {
    const at = route === 'check-in' ? new Date().toISOString() : null;
    floor.move(appointmentId, {
      status: route === 'check-in' ? 'checked_in' : 'confirmed',
      visitStage: route === 'check-in' ? 'waiting' : null,
      checkedInAt: at,
      visitStageChangedAt: at,
    });
  },
}));

/** The work queue's server (`tasks-api.ts`), the team and the member's membership. */
const queue = vi.hoisted(() => ({ tasks: [] }) as QueueWorld);
vi.mock('@/shared/api/app/tasks-api.ts', async (importOriginal) => {
  const { queueApiDouble } = await import('./today-fixtures.ts');
  return {
    ...(await importOriginal<typeof TasksApiModule>()),
    ...queueApiDouble(queue),
  };
});
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => {
  const { QUEUE_TEAM } = await import('./today-fixtures.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    fetchTeamDirectory: async () => structuredClone([...QUEUE_TEAM]),
  };
});
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => {
  const { RIYA } = await import('@/tests/utils/task-row-fixture.ts');
  return {
    ...(await importOriginal<typeof MyMembershipModule>()),
    findMyMembershipId: async () => RIYA.id,
  };
});

/** The shared booking form, as a stub that shows how it was opened. */
vi.mock('@/shared/forms/AppointmentForm/index.ts', () => ({
  AppointmentForm: (props: {
    mode: string;
    prefill?: { whoId?: string; copyOf?: string };
    appointmentId?: string;
  }) => (
    <div role="dialog" aria-label="Booking" data-mode={props.mode}>
      {props.prefill?.copyOf ?? props.appointmentId ?? props.prefill?.whoId}
    </div>
  ),
}));

const LANE_ORDER: readonly TodayLane[] = [
  'enquiries',
  'arriving',
  'waiting',
  'with_doctor',
  'treatment',
  'checkout',
  'pharmacy',
];
const tileOf = (lane: TodayLane) =>
  screen.getByTestId(`today-lane-${lane.replace('_', '-')}`);
const countOf = (lane: TodayLane) =>
  tileOf(lane).querySelector('.text-stat')?.textContent ?? '';
/** The dimmed tiles among those the role can read — a lane it cannot read has no tile (D163). */
const dimmedLanes = () =>
  LANE_ORDER.filter(
    (lane) =>
      screen.queryByTestId(`today-lane-${lane.replace('_', '-')}`)?.dataset.dimmed ===
      'true',
  );
const panel = () => screen.getByTestId('today-panel');
const cardNamed = (name: string) => {
  const card = within(panel())
    .queryAllByTestId('today-card')
    .find((candidate) => candidate.textContent?.includes(name));
  if (!card) throw new Error(`no card for ${name}`);
  return card;
};

/** The Undo of the last undo toast — what its button runs. */
function lastUndo(): { message: string; onUndo: () => void } {
  const [message, options] = vi.mocked(notify.undo).mock.lastCall ?? [];
  if (!(message && options)) throw new Error('no undo toast');
  return { message, onUndo: options.onUndo };
}

const loaded = () =>
  waitFor(() =>
    expect(screen.getByTestId('today-page')).not.toHaveAttribute('aria-busy'),
  );

const initialHourCycle = useLocaleStore.getState().hourCycle;
beforeEach(() => {
  // The floor is the seed day's: pin the clinic clock to 10:42 on it (H:3410).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(appInstant('2026-10-03', '10:42')));
  useLocaleStore.setState({ hourCycle: 'h23' });
  Object.assign(floor, seededFloor(), { failing: false });
  Object.assign(queue, seededQueue());
  for (const fn of Object.values(notify)) vi.mocked(fn).mockReset();
  vi.mocked(listTasks).mockClear();
  vi.mocked(recordTaskOutcome).mockClear();
});
afterEach(() => {
  resetTodayRoute();
  useLocaleStore.setState({ hourCycle: initialHourCycle });
  useUIStore.setState({ commandPaletteOpen: false });
  vi.useRealTimers();
});

describe('the Today room (KICKOFF §6.2)', () => {
  it('greets, counts the floor and opens the front desk on Enquiries', async () => {
    const { container } = renderTodayRoute(TODAY_PATH, TodayPage);
    await loaded();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Good morning, Riya',
    );
    expect(screen.getByTestId('today-pulse').textContent).toMatch(
      /^7 in clinic · 3 waiting · 2 arriving · Sat,? (3 Oct|Oct 3), 10:42$/,
    );
    expect(LANE_ORDER.map(countOf)).toEqual(['2', '2', '3', '1', '1', '1', '1']);
    expect(panel()).toHaveAttribute('data-lane', 'enquiries');
    expect(
      within(panel())
        .getAllByTestId('today-card')
        .map((card) => card.dataset.cardId),
    ).toEqual([publicId('lead', 2364), publicId('lead', 2363)]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each<[Role, TodayLane[], TodayLane]>([
    ['front_desk', ['with_doctor', 'treatment', 'pharmacy'], 'enquiries'],
    ['doctor', ['enquiries', 'arriving', 'treatment', 'checkout', 'pharmacy'], 'waiting'],
    // No lead:read — Enquiries has no tile to dim.
    [
      'therapist',
      ['arriving', 'waiting', 'with_doctor', 'checkout', 'pharmacy'],
      'treatment',
    ],
    [
      'counsellor',
      ['enquiries', 'arriving', 'waiting', 'treatment', 'pharmacy'],
      'with_doctor',
    ],
    [
      'pharmacist',
      ['arriving', 'waiting', 'with_doctor', 'treatment', 'checkout'],
      'pharmacy',
    ],
    // Enquiries alone: no appointment:read, so no floor tiles at all.
    ['marketing', [], 'enquiries'],
    ['owner', [], 'enquiries'],
    ['admin', [], 'enquiries'],
  ])('focuses a %s: dims %j and opens %s', async (role, dimmed, lane) => {
    renderTodayRoute(TODAY_PATH, TodayPage, { role });
    await loaded();
    await waitFor(() => expect(dimmedLanes()).toEqual(dimmed));
    expect(panel()).toHaveAttribute('data-lane', lane);
  });

  it('shows an Accountant no lanes — no appointment:read nor lead:read — and reads no floor (F3, D163)', async () => {
    floor.reads = 0;
    renderTodayRoute(TODAY_PATH, TodayPage, { role: 'accountant' });
    await loaded();
    expect(await screen.findByTestId('today-no-lanes')).toHaveTextContent(
      'The clinic floor and enquiries are not part of your role.',
    );
    expect(screen.queryByTestId('today-lanes')).not.toBeInTheDocument();
    expect(screen.queryByTestId('today-panel')).not.toBeInTheDocument();
    // Walk-in books a visit: not for a role that cannot (F4).
    expect(screen.queryByTestId('today-walk-in')).not.toBeInTheDocument();
    expect(floor.reads).toBe(0);
  });

  it('shows Marketing the Enquiries lane alone — leads, but no floor (F3, D163)', async () => {
    floor.reads = 0;
    renderTodayRoute(TODAY_PATH, TodayPage, { role: 'marketing' });
    await loaded();
    const lanes = await screen.findByTestId('today-lanes');
    await waitFor(() =>
      expect(
        within(lanes)
          .getAllByRole('button')
          .map((tile) => tile.dataset.testid),
      ).toEqual(['today-lane-enquiries']),
    );
    expect(screen.getByTestId('today-panel')).toHaveAttribute('data-lane', 'enquiries');
    expect(screen.queryByTestId('today-walk-in')).not.toBeInTheDocument();
    expect(floor.reads).toBe(0);
  });

  it('keeps the picked lane in the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderTodayRoute(TODAY_PATH, TodayPage);
    await loaded();
    await user.click(tileOf('pharmacy'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ lane: 'pharmacy' }),
    );
    expect(tileOf('pharmacy')).toHaveAttribute('aria-pressed', 'true');
    expect(cardNamed('Harsh Trivedi')).toHaveTextContent('3 medicines prescribed');
  });

  it('checks in at once with its own toast, and Undo brings the card back', async () => {
    const user = userEvent.setup();
    renderTodayRoute(`${TODAY_PATH}?lane=arriving`, TodayPage);
    await loaded();
    await user.click(within(cardNamed('Faizan Shaikh')).getByTestId('today-card-action'));
    await waitFor(() => expect(countOf('waiting')).toBe('4'));
    expect(countOf('arriving')).toBe('1');
    await waitFor(() => expect(notify.undo).toHaveBeenCalled());
    const undo = lastUndo();
    expect(undo.message).toBe('Faizan Shaikh checked in · Dr. queue and room notified');
    act(() => undo.onUndo());
    await waitFor(() => expect(countOf('arriving')).toBe('2'));
  });

  it('sends in at once with its own toast — a stage move has no Undo', async () => {
    const user = userEvent.setup();
    renderTodayRoute(`${TODAY_PATH}?lane=waiting`, TodayPage);
    await loaded();
    await user.click(within(cardNamed('Rhea Shah')).getByTestId('today-card-action'));
    await waitFor(() => expect(countOf('with_doctor')).toBe('2'));
    expect(countOf('waiting')).toBe('2');
    expect(notify.success).toHaveBeenCalledWith('Rhea Shah sent in to the doctor');
    expect(notify.undo).not.toHaveBeenCalled();
  });

  it('hides the lane actions a role can’t take (§3.7, §6.13)', async () => {
    const { unmount } = renderTodayRoute(`${TODAY_PATH}?lane=arriving`, TodayPage, {
      role: 'pharmacist',
    });
    await loaded();
    expect(within(panel()).queryByTestId('today-card-action')).not.toBeInTheDocument();
    unmount();
    renderTodayRoute(`${TODAY_PATH}?lane=treatment`, TodayPage, { role: 'therapist' });
    await loaded();
    expect(
      within(cardNamed('Dhruv Patel')).getByTestId('today-card-action'),
    ).toHaveTextContent('Open session');
  });

  it('opens a checkout on the patient’s page, a sale from the Rx and a lead from their lanes', async () => {
    const user = userEvent.setup();
    const { router } = renderTodayRoute(`${TODAY_PATH}?lane=with_doctor`, TodayPage, {
      role: 'admin',
    });
    await loaded();
    // With doctor has no action (L-64): the consult is the patient page's.
    expect(
      within(cardNamed('Sana Kapoor')).queryByTestId('today-card-action'),
    ).not.toBeInTheDocument();

    await act(() => router.navigate({ to: `${TODAY_PATH}?lane=checkout` }));
    const checkout = within(await screen.findByTestId('today-panel')).getByTestId(
      'today-card-action',
    );
    expect(checkout).toHaveTextContent('Checkout');
    await user.click(checkout);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/patients/${publicId('pat', 2864)}/timeline`,
      ),
    );
    expect(router.state.location.search).toEqual({ visit: 'open', from: 'today' });

    await act(() => router.navigate({ to: `${TODAY_PATH}?lane=pharmacy` }));
    await user.click(
      within(await screen.findByTestId('today-panel')).getByTestId('today-card-action'),
    );
    // New sale opens over Today, which stays — the URL bar on the sale (A-P1).
    const sale = `medical/sales/create?prescription=${publicId('rx', 501)}&from=today`;
    await waitFor(() =>
      expect(router.history.location.href).toBe(`/organization/acme/${sale}`),
    );
    expect(router.state.location.pathname).toBe(TODAY_PATH);
    expect(router.state.location.search).toEqual({
      lane: 'pharmacy',
      [CROSS_ROOM_PARAM]: sale,
    });

    await act(() => router.navigate({ to: `${TODAY_PATH}?lane=enquiries` }));
    await user.click(
      within(await screen.findByTestId('today-panel')).getAllByTestId(
        'today-card-action',
      )[0] as HTMLElement,
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/leads/${publicId('lead', 2364)}`,
      ),
    );
  });

  it('opens the person: a patient’s file, or says there is no record yet', async () => {
    const user = userEvent.setup();
    const { router } = renderTodayRoute(`${TODAY_PATH}?lane=arriving`, TodayPage);
    await loaded();
    await user.click(within(cardNamed('Faizan Shaikh')).getByTestId('today-card-open'));
    expect(notify.info).toHaveBeenCalledWith('No patient record yet for Faizan Shaikh');
    await user.click(within(cardNamed('Priti Soni')).getByTestId('today-card-open'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/patients/${publicId('pat', 3511)}/timeline`,
      ),
    );
  });

  it('opens New lead from "New booking" and the command menu from "Walk-in"', async () => {
    const user = userEvent.setup();
    const { router } = renderTodayRoute(TODAY_PATH, TodayPage);
    await loaded();
    await user.click(screen.getByTestId('today-walk-in'));
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    await user.click(await screen.findByTestId('today-new-booking'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/leads/create'),
    );
  });

  it('shows my work queue and my queue’s, everyone’s through the URL, and counts every open task', async () => {
    const user = userEvent.setup();
    const { router, container } = renderTodayRoute(TODAY_PATH, TodayPage, {
      permissions: TODAY_FRONT_DESK_CODES,
    });
    await loaded();
    const titles = () =>
      screen
        .queryAllByTestId('today-queue-card')
        .map((card) => card.querySelector('p')?.textContent);
    // Mine (the server's `scope=mine`): Riya's, the front desk queue's, and the one closed today.
    await waitFor(() =>
      expect(titles()).toEqual([
        'Ask Meera how it went',
        'Rebook Vikram',
        'Confirm Priti’s visit',
      ]),
    );
    expect(listTasks).toHaveBeenCalledWith(
      { tab: 'open', scope: 'mine', branchIds: [] },
      undefined,
    );
    const aside = screen.getByRole('complementary', { name: 'Work queue' });
    // "<n> open" counts every open task, Asha's too.
    expect(aside).toHaveTextContent('3 open · each has an owner and a due time');
    const rebook = screen.getAllByTestId('today-queue-card')[1] as HTMLElement;
    expect(rebook).toHaveTextContent('Owner: Front desk');
    expect(screen.getAllByTestId('today-queue-card')[0]).toHaveTextContent('✓ Happy');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByTestId('today-queue-scope-everyone'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ queue: 'everyone' }),
    );
    await waitFor(() => expect(titles()).toContain('Call Kabir back'));
    const kabir = screen
      .getAllByTestId('today-queue-card')
      .find((card) => card.textContent?.includes('Call Kabir back'));
    expect(kabir).toHaveTextContent('Owner: Asha M.');
  });

  it('closes a task in place with "<name>: <result>" — no Undo; a booking follow-on stacks the form', async () => {
    const user = userEvent.setup();
    renderTodayRoute(TODAY_PATH, TodayPage, { permissions: TODAY_FRONT_DESK_CODES });
    await loaded();
    const rebookCard = () =>
      screen
        .getAllByTestId('today-queue-card')
        .find((candidate) => candidate.textContent?.includes('Rebook Vikram'));
    const rebook = await waitFor(() => {
      const card = rebookCard();
      if (!card) throw new Error('no rebook card');
      return card;
    });
    await user.click(within(rebook).getByRole('button', { name: 'Rebooked' }));
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Vikram Bhatt: Rebooked'),
    );
    expect(notify.undo).not.toHaveBeenCalled();
    expect(recordTaskOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcomeId: 'rebooked', words: 'Rebooked' }),
    );
    await waitFor(() => expect(rebookCard()).toHaveTextContent('✓ Rebooked'));
    const booking = await screen.findByRole('dialog', { name: 'Booking' });
    expect(booking).toHaveAttribute('data-mode', 'create');
    expect(booking).toHaveTextContent(VIKRAM_VISIT_ID);
  });

  it('reads the queue only without task:update, and hides it without task:read', async () => {
    const reader = TODAY_FRONT_DESK_CODES.filter((code) => code !== 'task:update');
    const { unmount } = renderTodayRoute(TODAY_PATH, TodayPage, { permissions: reader });
    await loaded();
    await waitFor(() =>
      expect(screen.getAllByTestId('today-queue-card')).toHaveLength(3),
    );
    expect(screen.queryByTestId('today-queue-outcome')).not.toBeInTheDocument();
    unmount();
    resetTodayRoute();
    vi.mocked(listTasks).mockClear();

    // The Accountant holds no task code: Today is the floor alone.
    renderTodayRoute(TODAY_PATH, TodayPage, {
      permissions: ['organization:read', 'appointment:read'],
    });
    await loaded();
    expect(screen.queryByTestId('today-queue')).not.toBeInTheDocument();
    expect(listTasks).not.toHaveBeenCalled();
  });

  it("answers a View-as preview from the previewed role's codes — an Accountant has no queue", async () => {
    const { queryClient } = renderTodayRoute(TODAY_PATH, TodayPage, { role: 'owner' });
    await loaded();
    await waitFor(() =>
      expect(screen.getAllByTestId('today-queue-card')).toHaveLength(3),
    );
    act(() => previewPreset(queryClient, 'accountant'));
    await waitFor(() =>
      expect(screen.queryByTestId('today-queue-card')).not.toBeInTheDocument(),
    );
  });

  it('toasts a failed read with Retry and keeps what it has', async () => {
    floor.failing = true;
    renderTodayRoute(TODAY_PATH, TodayPage);
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(
        'Couldn’t load this list · connection dropped. Showing the last copy.',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Retry' }) }),
      ),
    );
    expect(LANE_ORDER.map(countOf)).toEqual(['2', '0', '0', '0', '0', '0', '0']);
  });
});
