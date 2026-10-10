import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import type * as FeedbackApiModule from '@/shared/api/clinic/feedback-api.ts';
import type * as OfferingsApiModule from '@/shared/api/clinic/offerings-api.ts';
import type * as TreatmentsApiModule from '@/shared/api/clinic/treatments-api.ts';
import { PATIENT_FILE_SECTIONS } from '@/shared/clinic/patient-file-sections.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { holdPreset } from '@/tests/utils/clinic-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import { PatientFileContext } from '../../shared/patient-file-context.ts';
import { NewCheckInPage } from './NewCheckInPage.tsx';

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
vi.mock('../../patient-id.sections.ts', async () => {
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
  fetchPreviousCheckIn: vi.fn(async () => null),
}));
vi.mock('@/shared/api/clinic/treatments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof TreatmentsApiModule>()),
  fetchTreatment: vi.fn(async () => ({ id: 'trt_lhr', name: 'LHR Full Face' })),
}));

const FILE = `/organization/acme/patients/${TEST_PATIENT_ID}`;

/** The page at its route under the file, for the test member holding the `role` preset's codes. */
function renderPage(url: string, role: Role = 'admin') {
  signInTestMember();
  holdPreset(role);
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
    path: 'check-ins/create',
    component: NewCheckInPage,
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
  useOrganizationStore.getState().clearPermissions();
});

describe('NewCheckInPage (S:44)', () => {
  it('shows the section it came from with a new check-in over it', async () => {
    renderPage(`${FILE}/check-ins/create?from=images`);
    expect(await screen.findByTestId('check-in-drawer-title')).toHaveTextContent(
      'Visit check-in',
    );
    expect(screen.getByTestId('patient-section-images')).toBeInTheDocument();
  });

  it('is an aftercare check-in when `?treatment=` names the session, over Clinical notes', async () => {
    renderPage(`${FILE}/check-ins/create?treatment=trt_lhr`);
    expect(await screen.findByTestId('check-in-drawer-title')).toHaveTextContent(
      'Aftercare check-in',
    );
    expect(screen.getByTestId('patient-section-overview')).toBeInTheDocument();
  });

  it('turns a member who cannot edit patients back — a Pharmacist (S:44)', async () => {
    const { router } = renderPage(`${FILE}/check-ins/create?from=visits`, 'pharmacist');
    await waitFor(() => expect(router.state.location.pathname).toBe(`${FILE}/visits`));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
    expect(screen.queryByTestId('check-in-drawer')).not.toBeInTheDocument();
  });
});
