import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchPatientFile } from '@/shared/api/clinic/patient-file-api.ts';

import {
  patientFileUrl,
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { useVisitFlowReturn, visitFlowSearch } from './useVisitFlowReturn.ts';

/** Dhruv Patel is in today's treatment lane (visit 2865). */
const DHRUV = patientRef('Dhruv Patel');

/** Shows what the hook reads, with its two ways out. */
function Probe() {
  const flow = useVisitFlowReturn();
  return (
    <div>
      <output data-testid="state">
        {JSON.stringify({
          inFlow: flow.inFlow,
          ready: flow.ready,
          fromToday: flow.fromToday,
          visit: flow.visit?.id ?? null,
        })}
      </output>
      <button type="button" onClick={flow.backToFlow}>
        back
      </button>
      <button type="button" onClick={flow.leaveFlow}>
        leave
      </button>
    </div>
  );
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');

async function openAt(path: string) {
  const file = await fetchPatientFile(DHRUV);
  const view = renderInPatientFile(<Probe />, { file });
  await act(() => view.router.navigate({ href: patientFileUrl(DHRUV, path) }));
  return view;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
  vi.useRealTimers();
});

describe('visitFlowSearch (L-64)', () => {
  it('keeps the flow open, and Today as the way back only when it came from there', () => {
    expect(visitFlowSearch('today')).toEqual({ visit: 'open', from: 'today' });
    expect(visitFlowSearch('prescriptions')).toEqual({ visit: 'open' });
    expect(visitFlowSearch(undefined)).toEqual({ visit: 'open' });
  });
});

describe('useVisitFlowReturn (KICKOFF §6.6, D18; L-64)', () => {
  it('is out of the flow without `visit=open`', async () => {
    await openAt('/prescriptions/create');
    await waitFor(() =>
      expect(state()).toEqual({
        inFlow: false,
        ready: true,
        fromToday: false,
        visit: null,
      }),
    );
  });

  it('reads the open visit in the flow, goes back to it, and leaves for Today', async () => {
    const user = userEvent.setup();
    const { router } = await openAt('/prescriptions/create?visit=open&from=today');
    await waitFor(() =>
      expect(state()).toEqual({
        inFlow: true,
        ready: true,
        fromToday: true,
        visit: ref.visit(2865),
      }),
    );
    await user.click(screen.getByRole('button', { name: 'back' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(DHRUV, '/timeline')),
    );
    expect(router.state.location.search).toEqual({ visit: 'open', from: 'today' });
    await user.click(screen.getByRole('button', { name: 'leave' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/today'),
    );
  });

  it('leaves for the Overview when the flow did not come from Today', async () => {
    const user = userEvent.setup();
    const { router } = await openAt('/timeline?visit=open');
    await user.click(await screen.findByRole('button', { name: 'leave' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(router.state.location.pathname).toBe(patientFileUrl(DHRUV, '/timeline'));
  });
});
