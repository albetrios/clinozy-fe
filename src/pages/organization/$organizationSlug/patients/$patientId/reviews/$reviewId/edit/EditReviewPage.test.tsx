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

import type * as FeedbackApiModule from '@/shared/api/app/feedback-api.ts';
import { fetchReview } from '@/shared/api/app/feedback-api.ts';
import { PATIENT_FILE_SECTIONS } from '@/shared/app/patient-file-sections.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { holdPreset } from '@/tests/utils/app-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import { PatientFileContext } from '../../../shared/patient-file-context.ts';
import { EditReviewPage } from './EditReviewPage.tsx';

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
vi.mock('@/shared/api/app/feedback-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof FeedbackApiModule>()),
  fetchReview: vi.fn(),
}));

const FILE = `/organization/acme/patients/${TEST_PATIENT_ID}`;
const SAVED = 'rev_saved0000000000000000';

/** The page at its route under the file, for the test member. */
function renderPage(url: string) {
  signInTestMember();
  holdPreset('admin');
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
          photos: {
            pick: () => undefined,
            capture: () => undefined,
            upload: () => undefined,
          },
        }}
      >
        <Outlet />
      </PatientFileContext.Provider>
    ),
  });
  const page = createRoute({
    getParentRoute: () => file,
    path: 'reviews/$reviewId/edit',
    component: EditReviewPage,
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
  vi.resetAllMocks();
});

describe('EditReviewPage (S:47)', () => {
  it('reads the review by the patient and opens it prefilled over the section', async () => {
    vi.mocked(fetchReview).mockResolvedValue({
      id: SAVED,
      patientId: TEST_PATIENT_ID,
      appointmentId: null,
      source: 'whatsapp',
      rating: 4,
      text: null,
      link: null,
      fileKeys: [],
      date: '2026-09-24',
      needsAction: false,
      actions: [],
      createdAt: '2026-09-24T05:00:00.000Z',
      updatedAt: '2026-09-24T05:00:00.000Z',
    });
    renderPage(`${FILE}/reviews/${SAVED}/edit?from=visits`);
    const drawer = await screen.findByTestId('review-drawer');
    expect(fetchReview).toHaveBeenCalledWith(TEST_PATIENT_ID, SAVED);
    expect(within(drawer).getByTestId('review-drawer-where-whatsapp')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(drawer).getByTestId('review-drawer-rating-4')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(drawer).getByTestId('review-drawer-save')).toHaveTextContent(
      'Save changes',
    );
    expect(screen.getByTestId('patient-section-visits')).toBeInTheDocument();
  });

  it('goes back with a toast when the review is gone', async () => {
    vi.mocked(fetchReview).mockRejectedValue(
      new HttpError('Not found', 404, '/app/patients/x/reviews/y', 'GET'),
    );
    const { router } = renderPage(`${FILE}/reviews/${SAVED}/edit`);
    await waitFor(() => expect(router.state.location.pathname).toBe(`${FILE}/overview`));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Review not found · it may have been deleted',
    );
  });
});
