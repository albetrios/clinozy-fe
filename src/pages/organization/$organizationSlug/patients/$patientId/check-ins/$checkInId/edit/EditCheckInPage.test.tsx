import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as FeedbackApiModule from '@/shared/api/clinic/feedback-api.ts';
import { fetchCheckIn } from '@/shared/api/clinic/feedback-api.ts';
import type * as OfferingsApiModule from '@/shared/api/clinic/offerings-api.ts';
import { PATIENT_FILE_SECTIONS } from '@/shared/clinic/patient-file-sections.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import { PatientFileContext } from '../../../shared/patient-file-context.ts';
import { EditCheckInPage } from './EditCheckInPage.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
// The section behind the drawer is a stand-in: this page decides which, not what it shows.
vi.mock('../../../patient-id.sections.ts', async () => {
  const { createElement } = await import('react');
  return {
    PATIENT_FILE_SECTION_PAGES: new Proxy(
      {},
      {
        get: (_pages, slug) => () =>
          createElement('p', { 'data-testid': `patient-section-${String(slug)}` }),
      },
    ),
  };
});
vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OfferingsApiModule>()),
  fetchAllOfferings: vi.fn(async () => []),
}));
vi.mock('@/shared/api/clinic/feedback-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof FeedbackApiModule>()),
  fetchCheckIn: vi.fn(),
  fetchPreviousCheckIn: vi.fn(async () => null),
}));

const FILE = `/organization/acme/patients/${TEST_PATIENT_ID}`;
const SAVED = 'chk_saved0000000000000000';

/** The page at its route under the file, for the test member. */
function renderPage(url: string) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: 'admin' });
  const root = createRootRoute({ component: () => <Outlet /> });
  const file = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/patients/$patientId',
    component: () => (
      <PatientFileContext.Provider
        value={{
          patientId: TEST_PATIENT_ID,
          file: patientFile(),
          section: null,
          viewable: PATIENT_FILE_SECTIONS,
          masked: true,
          toggleMasked: () => undefined,
          photos: { pick: () => undefined, upload: () => undefined },
        }}
      >
        <Outlet />
      </PatientFileContext.Provider>
    ),
  });
  const page = createRoute({
    getParentRoute: () => file,
    path: 'check-ins/$checkInId/edit',
    component: EditCheckInPage,
  });
  const section = createRoute({
    getParentRoute: () => file,
    path: '$',
    component: () => null,
  });
  const router = createRouter({
    routeTree: root.addChildren([file.addChildren([page, section])]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});
afterEach(() => {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
  vi.resetAllMocks();
});

describe('EditCheckInPage (S:45)', () => {
  it('reads the check-in by the patient and opens it prefilled over the section', async () => {
    vi.mocked(fetchCheckIn).mockResolvedValue({
      id: SAVED,
      patientId: TEST_PATIENT_ID,
      appointmentId: null,
      treatmentId: null,
      context: 'Visit · 24 Sep',
      feel: 'same',
      score: 6,
      scoreChange: null,
      followed: null,
      followedNote: null,
      currentState: null,
      nextPlan: null,
      nextOfferingIds: [],
      date: '2026-09-24',
      needsAction: false,
      actions: [],
      createdAt: '2026-09-24T05:00:00.000Z',
      updatedAt: '2026-09-24T05:00:00.000Z',
    });
    renderPage(`${FILE}/check-ins/${SAVED}/edit?from=visits`);
    const drawer = await screen.findByTestId('check-in-drawer');
    expect(fetchCheckIn).toHaveBeenCalledWith(TEST_PATIENT_ID, SAVED);
    expect(within(drawer).getByTestId('check-in-drawer-feel-same')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(drawer).getByTestId('check-in-drawer-save')).toHaveTextContent(
      'Save changes',
    );
    expect(screen.getByTestId('patient-section-visits')).toBeInTheDocument();
  });

  it('goes back with a toast when the check-in is gone', async () => {
    vi.mocked(fetchCheckIn).mockRejectedValue(
      new HttpError('Not found', 404, '/app/patients/x/check-ins/y', 'GET'),
    );
    const { router } = renderPage(`${FILE}/check-ins/${SAVED}/edit`);
    await waitFor(() => expect(router.state.location.pathname).toBe(`${FILE}/overview`));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Check-in not found · it may have been deleted',
    );
  });
});
