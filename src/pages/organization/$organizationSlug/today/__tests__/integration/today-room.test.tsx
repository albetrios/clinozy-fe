import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as TodayApiModule from '@/shared/api/clinic/today-api.ts';
import type { TodayLane } from '@/shared/api/clinic/today-contracts.ts';
import { CROSS_ROOM_PARAM } from '@/shared/clinic/clinic-referrer.ts';
import { notify } from '@/shared/notify/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { TodayPage } from '../../TodayPage.tsx';
import { renderTodayRoute, resetTodayRoute, TODAY_PATH } from './today-test-router.tsx';

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

/** Fails the floor read while `failing` is set — the room's list error. */
const floorGate = vi.hoisted(() => ({ failing: false }));
vi.mock('@/shared/api/clinic/today-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TodayApiModule>();
  return {
    ...actual,
    fetchTodayFloor: async (...args: Parameters<typeof actual.fetchTodayFloor>) => {
      if (floorGate.failing) throw new Error('connection dropped');
      return actual.fetchTodayFloor(...args);
    },
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
const dimmedLanes = () =>
  LANE_ORDER.filter((lane) => tileOf(lane).dataset.dimmed === 'true');
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
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  useLocaleStore.setState({ hourCycle: 'h23' });
  floorGate.failing = false;
  for (const fn of Object.values(notify)) vi.mocked(fn).mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetTodayRoute();
  resetClinicFixtures();
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
    ).toEqual([ref.lead(2364), ref.lead(2363)]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each<[Role, TodayLane[], TodayLane]>([
    ['front_desk', ['with_doctor', 'treatment', 'pharmacy'], 'enquiries'],
    ['doctor', ['enquiries', 'arriving', 'treatment', 'checkout', 'pharmacy'], 'waiting'],
    [
      'therapist',
      ['enquiries', 'arriving', 'waiting', 'with_doctor', 'checkout', 'pharmacy'],
      'treatment',
    ],
    [
      'counsellor',
      ['enquiries', 'arriving', 'waiting', 'treatment', 'pharmacy'],
      'with_doctor',
    ],
    [
      'pharmacist',
      ['enquiries', 'arriving', 'waiting', 'with_doctor', 'treatment', 'checkout'],
      'pharmacy',
    ],
    [
      'accountant',
      ['enquiries', 'arriving', 'waiting', 'with_doctor', 'treatment', 'pharmacy'],
      'checkout',
    ],
    [
      'marketing',
      ['arriving', 'waiting', 'with_doctor', 'treatment', 'checkout', 'pharmacy'],
      'enquiries',
    ],
    ['owner', [], 'enquiries'],
    ['admin', [], 'enquiries'],
  ])('focuses a %s: dims %j and opens %s', async (role, dimmed, lane) => {
    renderTodayRoute(TODAY_PATH, TodayPage, { role });
    await loaded();
    await waitFor(() => expect(dimmedLanes()).toEqual(dimmed));
    expect(panel()).toHaveAttribute('data-lane', lane);
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

  it('sends in at once, and Undo puts the visit back', async () => {
    const user = userEvent.setup();
    renderTodayRoute(`${TODAY_PATH}?lane=waiting`, TodayPage);
    await loaded();
    await user.click(within(cardNamed('Rhea Shah')).getByTestId('today-card-action'));
    await waitFor(() => expect(countOf('with_doctor')).toBe('2'));
    await waitFor(() => expect(notify.undo).toHaveBeenCalled());
    const undo = lastUndo();
    expect(undo.message).toBe('Rhea Shah sent in to the doctor');
    act(() => undo.onUndo());
    await waitFor(() => expect(countOf('waiting')).toBe('3'));
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
    const booking = await clinicFixtures.appointments.get(ref.appointment(2864));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/patients/${booking.patientId}/timeline`,
      ),
    );
    expect(router.state.location.search).toEqual({ visit: 'open', from: 'today' });

    await act(() => router.navigate({ to: `${TODAY_PATH}?lane=pharmacy` }));
    await user.click(
      within(await screen.findByTestId('today-panel')).getByTestId('today-card-action'),
    );
    // New sale opens over Today, which stays — the URL bar on the sale (A-P1).
    const sale = `medical/sales/create?prescription=${ref.prescription(501)}&from=today`;
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
        `/organization/acme/leads/${ref.lead(2364)}`,
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
        `/organization/acme/patients/${ref.patient(3511)}/timeline`,
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

  it('shows my work queue, everyone’s through the URL, and counts every open task', async () => {
    const user = userEvent.setup();
    const { router } = renderTodayRoute(TODAY_PATH, TodayPage);
    await loaded();
    const titles = () =>
      screen
        .getAllByTestId('today-queue-card')
        .map((card) => card.querySelector('p')?.textContent);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    expect(titles()).not.toContain('Call Kabir back');
    const sub = screen.getByRole('complementary', { name: 'Work queue' });
    const count = Number.parseInt(sub.querySelector('p')?.textContent ?? '', 10);
    await user.click(screen.getByTestId('today-queue-scope-everyone'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ queue: 'everyone' }),
    );
    await waitFor(() => expect(titles()).toContain('Call Kabir back'));
    expect(
      screen.getAllByTestId('today-queue-card').filter((card) => !card.dataset.closed),
    ).toHaveLength(count);
  });

  it('closes a task in place with "<name>: <result>" and Undo; a booking follow-on stacks the form', async () => {
    const user = userEvent.setup();
    renderTodayRoute(TODAY_PATH, TodayPage);
    await loaded();
    const rebook = await waitFor(() => {
      const card = screen
        .getAllByTestId('today-queue-card')
        .find((candidate) => candidate.textContent?.includes('Rebook Vikram'));
      if (!card) throw new Error('no rebook card');
      return card;
    });
    await user.click(within(rebook).getByRole('button', { name: 'Rebooked' }));
    await waitFor(() => expect(notify.undo).toHaveBeenCalled());
    expect(lastUndo().message).toBe('Vikram Bhatt: Rebooked');
    await waitFor(() =>
      expect(
        screen
          .getAllByTestId('today-queue-card')
          .find((card) => card.textContent?.includes('Rebook Vikram')),
      ).toHaveTextContent('✓ Rebooked'),
    );
    const booking = await screen.findByRole('dialog', { name: 'Booking' });
    expect(booking).toHaveAttribute('data-mode', 'create');
    expect(booking).toHaveTextContent(ref.appointment(2862));
  });

  it('toasts a failed read with Retry and keeps what it has', async () => {
    floorGate.failing = true;
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
