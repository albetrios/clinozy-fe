import { act, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role } from '@/shared/api/app/app-schema.ts';
import { appInstant } from '@/shared/api/app/app-time.ts';
import { moveAppointment } from '@/shared/api/app/appointments-api.ts';
import { resetAppFixtures } from '@/shared/api/app/fixtures/world.fixtures.ts';
import { moveFloorStage } from '@/shared/api/app/today-api.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  enquiry,
  floorRow,
  publicId,
} from '../../__tests__/integration/today-fixtures.ts';
import {
  renderTodayRoute,
  resetTodayRoute,
  TODAY_PATH,
} from '../../__tests__/integration/today-test-router.tsx';
import { takeVisitCard } from '../../today.focus.ts';
import { groupTodayLanes, type TodayCard } from '../../today.lanes.ts';
import { type FloorActions, useFloorActions } from './useFloorActions.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/api/app/today-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  moveFloorStage: vi.fn(),
}));
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  moveAppointment: vi.fn(),
}));

/** A row's id for the tests. */
const rowId = (n: number) => publicId('appt', n);

/** The hook as the room holds it, read after each render. */
const probe: { actions: FloorActions | null } = { actions: null };
function Probe() {
  const actions = useFloorActions('acme');
  useEffect(() => {
    probe.actions = actions;
  });
  return null;
}

async function actionsFor(role: Role) {
  const view = renderTodayRoute(TODAY_PATH, Probe, { role });
  // The clinic access resolves first; until then every action is hidden.
  await waitFor(() =>
    expect(probe.actions?.actionOf(cardIn('enquiries'))).not.toBeUndefined(),
  );
  return view;
}

const LANES = groupTodayLanes(
  [
    floorRow({ id: rowId(1), name: 'Faizan Shaikh', status: 'confirmed' }),
    floorRow({ id: rowId(2), name: 'Rhea Shah', status: 'checked_in' }),
    floorRow({ id: rowId(3), status: 'checked_in', visitStage: 'treatment' }),
    floorRow({ id: rowId(4), status: 'checked_in', visitStage: 'with_doctor' }),
    floorRow({
      id: rowId(5),
      status: 'checked_in',
      visitStage: 'pharmacy',
      prescription: {
        id: publicId('rx', 50),
        patientId: publicId('pat', 2),
        approvedAt: '2026-10-03T04:35:00.000Z',
        items: 3,
      },
    }),
    floorRow({ id: rowId(6), status: 'checked_in', visitStage: 'checkout' }),
  ],
  [enquiry()],
);
function cardIn(lane: keyof typeof LANES): TodayCard {
  const card = LANES[lane][0];
  if (!card) throw new Error(`no card in ${lane}`);
  return card;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(appInstant('2026-10-03', '10:42')));
  vi.resetAllMocks();
  probe.actions = null;
  resetAppFixtures();
});
afterEach(() => {
  resetTodayRoute();
  resetAppFixtures();
  vi.useRealTimers();
});

describe('useFloorActions (KICKOFF §6.2 lanes table; §3.7, §6.13)', () => {
  it('gives the front desk Book, Check in and Send in — not the clinical tabs', async () => {
    await actionsFor('front_desk');
    const actionOf = (lane: keyof typeof LANES) => probe.actions?.actionOf(cardIn(lane));
    await waitFor(() => expect(actionOf('arriving')).toBeTypeOf('function'));
    expect(actionOf('enquiries')).toBeTypeOf('function');
    expect(actionOf('waiting')).toBeTypeOf('function');
    expect(actionOf('treatment')).toBeNull();
    expect(actionOf('with_doctor')).toBeNull();
    expect(actionOf('pharmacy')).toBeNull();
  });

  it('gives a pharmacist Dispense and nothing at the door', async () => {
    await actionsFor('pharmacist');
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('pharmacy'))).toBeTypeOf('function'),
    );
    expect(probe.actions?.actionOf(cardIn('arriving'))).toBeNull();
    expect(probe.actions?.actionOf(cardIn('enquiries'))).toBeNull();
  });

  it('dispenses on New sale with the Rx and its patient, Today the way back', async () => {
    const { router } = await actionsFor('pharmacist');
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('pharmacy'))).toBeTypeOf('function'),
    );
    act(() => probe.actions?.actionOf(cardIn('pharmacy'))?.());
    // New sale opens over Today — the URL bar on the sale (A-P1).
    const sale = `medical/sales/create?prescription=${publicId('rx', 50)}&customer=${publicId('pat', 2)}&from=today`;
    await waitFor(() =>
      expect(router.history.location.href).toBe(`/organization/acme/${sale}`),
    );
  });

  it('checks in through the booking’s check-in route with Today’s own words, and its Undo undoes it', async () => {
    await actionsFor('front_desk');
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('arriving'))).toBeTypeOf('function'),
    );
    act(() => probe.actions?.actionOf(cardIn('arriving'))?.());
    await waitFor(() => expect(notify.undo).toHaveBeenCalled());
    expect(moveAppointment).toHaveBeenCalledWith({
      appointmentId: rowId(1),
      route: 'check-in',
      idempotencyKey: expect.any(String),
    });
    const [message, options] = vi.mocked(notify.undo).mock.lastCall ?? [];
    expect(message).toBe('Faizan Shaikh checked in · Dr. queue and room notified');
    act(() => options?.onUndo());
    await waitFor(() =>
      expect(moveAppointment).toHaveBeenLastCalledWith({
        appointmentId: rowId(1),
        route: 'undo-check-in',
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('sends in to the doctor with a plain toast — a stage move has no Undo', async () => {
    await actionsFor('front_desk');
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('waiting'))).toBeTypeOf('function'),
    );
    act(() => probe.actions?.actionOf(cardIn('waiting'))?.());
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Rhea Shah sent in to the doctor'),
    );
    expect(moveFloorStage).toHaveBeenCalledWith({
      appointmentId: rowId(2),
      stage: 'with_doctor',
      idempotencyKey: expect.any(String),
    });
    expect(notify.undo).not.toHaveBeenCalled();
  });

  it('keeps the card where it is when the server refuses the move', async () => {
    vi.mocked(moveAppointment).mockRejectedValueOnce(new Error('not due'));
    await actionsFor('front_desk');
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('arriving'))).toBeTypeOf('function'),
    );
    act(() => probe.actions?.actionOf(cardIn('arriving'))?.());
    await waitFor(() => expect(notify.error).toHaveBeenCalled());
    expect(notify.undo).not.toHaveBeenCalled();
  });

  it('opens a therapist’s session on the patient’s page, the visit flow open (L-64)', async () => {
    const { router } = await actionsFor('therapist');
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('treatment'))).toBeTypeOf('function'),
    );
    act(() => probe.actions?.actionOf(cardIn('treatment'))?.());
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/patients/${publicId('pat', 2)}/timeline`,
      ),
    );
    expect(router.state.location.search).toEqual({ visit: 'open', from: 'today' });
    // The card is remembered, so its action takes focus back on the way back to Today.
    expect(takeVisitCard()).toBe(cardIn('treatment').id);
  });

  it('opens a checkout on the patient’s page for a member who takes payments', async () => {
    const { router } = await actionsFor('front_desk');
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('checkout'))).toBeTypeOf('function'),
    );
    expect(probe.actions?.actionOf(cardIn('treatment'))).toBeNull();
    act(() => probe.actions?.actionOf(cardIn('checkout'))?.());
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/patients/${publicId('pat', 2)}/timeline`,
      ),
    );
    expect(router.state.location.search).toEqual({ visit: 'open', from: 'today' });
  });

  it('asks a signed-in member’s own payment:create for Checkout', async () => {
    const codes = ['organization:read', 'patient:read', 'appointment:update'] as const;
    const first = renderTodayRoute(TODAY_PATH, Probe, { permissions: [...codes] });
    // Send in (`appointment:update`) shows once the member's codes are known.
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('waiting'))).toBeTypeOf('function'),
    );
    expect(probe.actions?.actionOf(cardIn('checkout'))).toBeNull();
    first.unmount();

    renderTodayRoute(TODAY_PATH, Probe, { permissions: [...codes, 'payment:create'] });
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('checkout'))).toBeTypeOf('function'),
    );
  });

  it('offers no consult: With doctor has no action, even for a doctor (L-64)', async () => {
    await actionsFor('doctor');
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('treatment'))).toBeTypeOf('function'),
    );
    expect(probe.actions?.actionOf(cardIn('with_doctor'))).toBeNull();
  });

  it('has no page to open for a booking with no patient file', async () => {
    await actionsFor('admin');
    const [card] = groupTodayLanes(
      [
        floorRow({
          id: rowId(7),
          status: 'checked_in',
          visitStage: 'checkout',
          patientId: null,
          leadId: publicId('lead', 70),
        }),
      ],
      [],
    ).checkout;
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('checkout'))).toBeTypeOf('function'),
    );
    if (!card) throw new Error('no checkout card');
    expect(probe.actions?.actionOf(card)).toBeNull();
  });

  it('opens an enquiry’s lead, a patient’s file, the open lead, or says there is no record', async () => {
    const { router } = await actionsFor('front_desk');
    act(() => probe.actions?.open(cardIn('enquiries')));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/leads/${publicId('lead', 50)}`,
      ),
    );
    act(() => probe.actions?.open(cardIn('waiting')));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/patients/${publicId('pat', 2)}/timeline`,
      ),
    );
    const [lead, nobody] = groupTodayLanes(
      [
        floorRow({
          id: rowId(8),
          name: 'Kabir',
          startTime: '11:00',
          status: 'confirmed',
          patientId: null,
          leadId: publicId('lead', 60),
        }),
        floorRow({
          id: rowId(9),
          name: 'Faizan',
          startTime: '11:30',
          status: 'confirmed',
          patientId: null,
          leadId: null,
        }),
      ],
      [],
    ).arriving;
    if (!(lead && nobody)) throw new Error('no card');
    act(() => probe.actions?.open(lead));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/leads/${publicId('lead', 60)}`,
      ),
    );
    act(() => probe.actions?.open(nobody));
    expect(notify.info).toHaveBeenCalledWith('No patient record yet for Faizan');
  });
});
