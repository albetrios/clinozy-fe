import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  listPatientPackages,
  patientPackageQueryKeys,
} from '@/shared/api/app/patient-packages-api.ts';
import type { PatientPackageRow } from '@/shared/api/app/patient-packages-contracts.ts';
import { moveFloorStage } from '@/shared/api/app/today-api.ts';
import {
  listPatientTreatments,
  treatmentQueryKeys,
} from '@/shared/api/app/treatments-api.ts';
import type { TreatmentRecord } from '@/shared/api/app/treatments-contracts.ts';
import type { VisitRecord } from '@/shared/api/app/visits-contracts.ts';
import { appointmentRow } from '@/tests/utils/appointment-doubles.ts';
import {
  patientFile,
  TEST_CONTACT_ID,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';

import {
  patientFileUrl,
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { useVisitFlowReturn, visitFlowSearch } from './useVisitFlowReturn.ts';

// The open visit as a query over an in-memory record (its own read is `useVisits`' to test).
const visits = vi.hoisted(() => ({
  open: null as VisitRecord | null,
  asked: [] as string[],
}));
vi.mock('@/shared/hooks/useVisits/index.ts', async (importOriginal) => {
  const { useQuery } = await import('@tanstack/react-query');
  return {
    ...(await importOriginal<object>()),
    useOpenVisit: (patientId: string) =>
      useQuery({
        queryKey: ['test', 'open-visit', patientId],
        queryFn: async () => {
          visits.asked.push(patientId);
          return visits.open;
        },
        enabled: patientId !== '',
      }),
  };
});
vi.mock('@/shared/api/app/today-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  moveFloorStage: vi.fn(async () => undefined),
}));
vi.mock('@/shared/api/app/patient-packages-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPatientPackages: vi.fn(async () => []),
}));
vi.mock('@/shared/api/app/treatments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPatientTreatments: vi.fn(async () => []),
}));

const APPOINTMENT_ID = 'appt_priya000000000000000';

/** Priya's visit, with the doctor, for a booking of `type`. */
const visitOf = (
  type: VisitRecord['booking']['type'] = 'consultation',
  stage: VisitRecord['stage'] = 'with_doctor',
): VisitRecord => ({
  appointmentId: APPOINTMENT_ID,
  booking: appointmentRow({
    id: APPOINTMENT_ID,
    type,
    contactId: TEST_CONTACT_ID,
    patientId: TEST_PATIENT_ID,
    status: 'checked_in',
  }),
  stage,
  stageAt: null,
  pausedAt: null,
});

/** Shows what the hook reads, with its ways out and its stage moves. */
function Probe() {
  const flow = useVisitFlowReturn();
  return (
    <div>
      <output data-testid="state">
        {JSON.stringify({
          inFlow: flow.inFlow,
          ready: flow.ready,
          fromToday: flow.fromToday,
          visit: flow.visit?.appointmentId ?? null,
        })}
      </output>
      <button type="button" onClick={flow.backToFlow}>
        back
      </button>
      <button type="button" onClick={flow.leaveFlow}>
        leave
      </button>
      <button type="button" onClick={() => flow.advanceAfter('prescription')}>
        rx written
      </button>
      <button type="button" onClick={() => flow.advanceAfter('treatment')}>
        session recorded
      </button>
    </div>
  );
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');

async function openAt(path: string) {
  const view = renderInPatientFile(<Probe />, { file: patientFile() });
  await act(() => view.router.navigate({ href: patientFileUrl(TEST_PATIENT_ID, path) }));
  return view;
}

beforeEach(() => {
  visits.open = visitOf();
  visits.asked = [];
  vi.mocked(listPatientPackages).mockResolvedValue([]);
  vi.mocked(listPatientTreatments).mockResolvedValue([]);
});
afterEach(() => {
  resetPatientFile();
  vi.mocked(moveFloorStage).mockClear();
});

describe('visitFlowSearch (L-64)', () => {
  it('keeps the flow open, and Today as the way back only when it came from there', () => {
    expect(visitFlowSearch('today')).toEqual({ visit: 'open', from: 'today' });
    expect(visitFlowSearch('prescriptions')).toEqual({ visit: 'open' });
    expect(visitFlowSearch(undefined)).toEqual({ visit: 'open' });
  });
});

describe('useVisitFlowReturn (KICKOFF §6.6; L-64)', () => {
  it('is out of the flow without `visit=open`, and reads no visit', async () => {
    await openAt('/prescriptions/create');
    await waitFor(() =>
      expect(state()).toEqual({
        inFlow: false,
        ready: true,
        fromToday: false,
        visit: null,
      }),
    );
    expect(visits.asked).toEqual([]);
  });

  it('reads the open visit in the flow, goes back to it, and leaves for Today', async () => {
    const user = userEvent.setup();
    const { router } = await openAt('/prescriptions/create?visit=open&from=today');
    await waitFor(() =>
      expect(state()).toEqual({
        inFlow: true,
        ready: true,
        fromToday: true,
        visit: APPOINTMENT_ID,
      }),
    );
    expect(visits.asked).toEqual([TEST_PATIENT_ID]);
    await user.click(screen.getByRole('button', { name: 'back' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(TEST_PATIENT_ID, '/timeline'),
      ),
    );
    expect(router.state.location.search).toEqual({ visit: 'open', from: 'today' });
    await user.click(screen.getByRole('button', { name: 'leave' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/today'),
    );
  });

  it('reads no visit in the flow when none is open', async () => {
    visits.open = null;
    await openAt('/treatments/create?visit=open');
    await waitFor(() =>
      expect(state()).toEqual({
        inFlow: true,
        ready: true,
        fromToday: false,
        visit: null,
      }),
    );
  });

  it('leaves for the Overview when the flow did not come from Today', async () => {
    const user = userEvent.setup();
    const { router } = await openAt('/timeline?visit=open');
    await user.click(await screen.findByRole('button', { name: 'leave' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(router.state.location.pathname).toBe(
      patientFileUrl(TEST_PATIENT_ID, '/timeline'),
    );
  });
});

describe('advanceAfter — the stage after a record (Q8, the plan’s proposal)', () => {
  /** The stage moves the server was asked for. */
  const moves = () =>
    vi
      .mocked(moveFloorStage)
      .mock.calls.map(([vars]) => [vars.appointmentId, vars.stage]);

  /** In the flow with the visit, its packages and sessions read — then a record written. */
  async function recorded(button: 'rx written' | 'session recorded') {
    const user = userEvent.setup();
    const { queryClient } = await openAt('/prescriptions/create?visit=open');
    await waitFor(() => expect(state().visit).toBe(APPOINTMENT_ID));
    await waitFor(() => {
      expect(
        queryClient.getQueryData(
          patientPackageQueryKeys.patient('org_test', TEST_PATIENT_ID),
        ),
      ).toBeDefined();
      expect(
        queryClient.getQueryData(treatmentQueryKeys.patient('org_test', TEST_PATIENT_ID)),
      ).toBeDefined();
    });
    await user.click(screen.getByRole('button', { name: button }));
  }

  it('sends a consultation’s visit to Checkout after its Rx', async () => {
    await recorded('rx written');
    await waitFor(() => expect(moves()).toEqual([[APPOINTMENT_ID, 'checkout']]));
  });

  it('sends a treatment visit to Treatment after its Rx — a session is due', async () => {
    visits.open = visitOf('treatment');
    await recorded('rx written');
    await waitFor(() => expect(moves()).toEqual([[APPOINTMENT_ID, 'treatment']]));
  });

  it('counts a package that can still spend a session, on a follow-up', async () => {
    visits.open = visitOf('follow_up');
    vi.mocked(listPatientPackages).mockResolvedValue([
      { id: 'poff_pack', status: 'active', sessionsLeft: 2 } as PatientPackageRow,
    ]);
    await recorded('rx written');
    await waitFor(() => expect(moves()).toEqual([[APPOINTMENT_ID, 'treatment']]));
  });

  it('goes to Checkout after the Rx once the session is recorded at the visit', async () => {
    visits.open = visitOf('treatment');
    vi.mocked(listPatientTreatments).mockResolvedValue([
      { appointmentId: APPOINTMENT_ID, status: 'done' } as TreatmentRecord,
    ]);
    await recorded('rx written');
    await waitFor(() => expect(moves()).toEqual([[APPOINTMENT_ID, 'checkout']]));
  });

  it('sends the visit to Checkout after a session', async () => {
    await recorded('session recorded');
    await waitFor(() => expect(moves()).toEqual([[APPOINTMENT_ID, 'checkout']]));
  });

  it('never moves a visit back — one at the pharmacy stays there', async () => {
    visits.open = visitOf('treatment', 'pharmacy');
    await recorded('rx written');
    expect(moveFloorStage).not.toHaveBeenCalled();
  });
});
