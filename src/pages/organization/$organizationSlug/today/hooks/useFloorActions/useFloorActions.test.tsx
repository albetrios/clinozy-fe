import { act, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { notify } from '@/shared/notify/index.ts';

import { enquiry, floorRow, uuid } from '../../__tests__/integration/today-fixtures.ts';
import {
  renderTodayRoute,
  resetTodayRoute,
  TODAY_PATH,
} from '../../__tests__/integration/today-test-router.tsx';
import { groupTodayLanes, type TodayCard } from '../../today.lanes.ts';
import { type FloorActions, useFloorActions } from './useFloorActions.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

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
    floorRow({ id: ref.appointment(2869), status: 'confirmed' }),
    floorRow({ id: uuid(2), status: 'checked_in' }),
    floorRow({
      id: uuid(3),
      status: 'checked_in',
      visit: { id: uuid(30), stage: 'treatment', stageAt: '2026-10-03T04:55:00.000Z' },
    }),
    floorRow({
      id: uuid(4),
      status: 'checked_in',
      visit: { id: '', stage: 'with_doctor', stageAt: '2026-10-03T05:00:00.000Z' },
    }),
    floorRow({
      id: uuid(5),
      status: 'completed',
      prescription: { id: uuid(50), approvedAt: '2026-10-03T04:35:00.000Z', items: 3 },
    }),
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
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  for (const fn of Object.values(notify)) vi.mocked(fn).mockReset();
  probe.actions = null;
  resetClinicFixtures();
});
afterEach(() => {
  resetTodayRoute();
  resetClinicFixtures();
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

  it('checks in through the status machine with Today’s own words', async () => {
    await actionsFor('front_desk');
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('arriving'))).toBeTypeOf('function'),
    );
    act(() => probe.actions?.actionOf(cardIn('arriving'))?.());
    await waitFor(() => expect(notify.undo).toHaveBeenCalled());
    expect(vi.mocked(notify.undo).mock.lastCall?.[0]).toBe(
      'Faizan Shaikh checked in · Dr. queue and room notified',
    );
    expect(
      clinicFixtures.appointments.snapshot((row) => row.seq === 2869)[0]?.status,
    ).toBe('checked_in');
  });

  it('opens a therapist’s session on its visit — and waits for a visit’s id', async () => {
    const { router } = await actionsFor('therapist');
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('treatment'))).toBeTypeOf('function'),
    );
    act(() => probe.actions?.actionOf(cardIn('treatment'))?.());
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/visits/${uuid(30)}`,
      ),
    );
    expect(router.state.location.search).toEqual({ tab: 'treatment' });
  });

  it('does nothing for a visit the floor moved a moment ago (no id yet)', async () => {
    const { router } = await actionsFor('doctor');
    await waitFor(() =>
      expect(probe.actions?.actionOf(cardIn('with_doctor'))).toBeTypeOf('function'),
    );
    act(() => probe.actions?.actionOf(cardIn('with_doctor'))?.());
    expect(router.state.location.pathname).toBe(TODAY_PATH);
  });

  it('opens an enquiry’s lead, a patient’s file, or says there is no record', async () => {
    const { router } = await actionsFor('front_desk');
    act(() => probe.actions?.open(cardIn('enquiries')));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/organization/acme/leads/${uuid(50)}`),
    );
    act(() => probe.actions?.open(cardIn('waiting')));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/patients/${uuid(2)}/timeline`,
      ),
    );
    const lead = groupTodayLanes(
      [
        floorRow({
          status: 'confirmed',
          patientId: null,
          person: {
            kind: 'lead',
            name: 'Kabir',
            phone: null,
            patientId: null,
            leadId: uuid(60),
            seq: 1,
          },
        }),
      ],
      [],
    ).arriving[0];
    const contact = groupTodayLanes(
      [
        floorRow({
          status: 'confirmed',
          patientId: null,
          person: {
            kind: 'contact',
            name: 'Faizan',
            phone: null,
            patientId: null,
            leadId: uuid(61),
            seq: null,
          },
        }),
      ],
      [],
    ).arriving[0];
    if (!(lead && contact)) throw new Error('no card');
    act(() => probe.actions?.open(lead));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/organization/acme/leads/${uuid(60)}`),
    );
    act(() => probe.actions?.open(contact));
    expect(notify.info).toHaveBeenCalledWith('No patient record yet for Faizan');
  });
});
