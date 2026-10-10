import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { VisitRecord } from '@/shared/api/clinic/visits-contracts.ts';
import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  patientFileUrl,
  renderInPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';
import { PatientTimelinePage } from './PatientTimelinePage.tsx';

// The bento, the timeline and the visit flow are their own suites': here they are stand-ins.
vi.mock('./components/OverviewBento/index.ts', () => ({
  OverviewBento: () => <div data-testid="overview-bento" />,
}));
vi.mock('./components/ActivityTimeline/index.ts', () => ({
  ActivityTimeline: () => <div data-testid="overview-activity" />,
}));
vi.mock('./components/VisitFlow/index.ts', () => ({
  VisitFlow: ({ visit }: { visit: VisitRecord }) => (
    <div data-testid="visit-flow">{visit.appointmentId}</div>
  ),
}));

/** The patient's open visit as its read answers — none until a test opens one. */
const visits = vi.hoisted(() => ({
  open: null as { appointmentId: string } | null,
  leaveFlow: vi.fn(),
}));
vi.mock('@/shared/hooks/useVisits/index.ts', async (importOriginal) => {
  const { useQuery } = await import('@tanstack/react-query');
  return {
    ...(await importOriginal<object>()),
    useOpenVisit: (patientId: string) =>
      useQuery({
        queryKey: ['test', 'open-visit', patientId],
        queryFn: async () => visits.open,
        enabled: patientId !== '',
      }),
  };
});
vi.mock('../shared/hooks/useVisitFlowReturn/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useVisitFlowReturn: () => ({ leaveFlow: visits.leaveFlow }),
}));

const OVERVIEW = patientFileUrl(TEST_PATIENT_ID, '/timeline');

/** The Overview in Priya's file, then the URL `search` puts it at. */
async function openOverview(search: Record<string, string> = {}) {
  const view = renderInPatientFile(<PatientTimelinePage />, {
    file: patientFile(),
    section: 'timeline',
  });
  await act(() => view.router.navigate({ to: OVERVIEW, search }));
  return view;
}

beforeEach(() => {
  visits.open = null;
  visits.leaveFlow.mockReset();
});
afterEach(() => resetPatientFile());

describe('PatientTimelinePage', () => {
  it('shows the bento, then the activity timeline, without a section header (H:4943)', async () => {
    const { container } = await openOverview();
    const section = await screen.findByTestId('patient-section-timeline');
    const bento = screen.getByTestId('overview-bento');
    const activity = screen.getByTestId('overview-activity');
    expect(section).toContainElement(bento);
    expect(
      bento.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toHaveClass(
      'sr-only',
    );
    expect(screen.queryByTestId('patient-section-primary')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the visit flow in its place on `?visit=open` while a visit is open (L-49)', async () => {
    visits.open = { appointmentId: 'appt_open' };
    await openOverview({ visit: 'open' });
    expect(await screen.findByTestId('visit-flow')).toHaveTextContent('appt_open');
    expect(screen.queryByTestId('overview-bento')).not.toBeInTheDocument();
  });

  it('drops a `?visit=open` with no open visit and keeps the Overview — a link never starts one', async () => {
    const { router } = await openOverview({ visit: 'open', from: 'today' });
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(router.state.location.pathname).toBe(OVERVIEW);
    expect(await screen.findByTestId('overview-bento')).toBeInTheDocument();
    expect(screen.queryByTestId('visit-flow')).not.toBeInTheDocument();
    // A stale link from Today never bounces back to Today.
    expect(visits.leaveFlow).not.toHaveBeenCalled();
  });

  it('leaves the flow the way it came when the visit ends under it', async () => {
    visits.open = { appointmentId: 'appt_open' };
    const { queryClient } = await openOverview({ visit: 'open' });
    await screen.findByTestId('visit-flow');
    visits.open = null;
    await act(() => queryClient.invalidateQueries({ queryKey: ['test', 'open-visit'] }));
    await waitFor(() => expect(visits.leaveFlow).toHaveBeenCalledTimes(1));
  });
});
