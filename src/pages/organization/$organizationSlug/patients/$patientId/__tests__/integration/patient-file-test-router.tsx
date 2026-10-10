import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import {
  PATIENT_FILE_SECTIONS,
  type PatientFileSectionSlug,
} from '@/shared/clinic/patient-file-sections.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { EditCheckInPage } from '../../check-ins/$checkInId/edit/EditCheckInPage.tsx';
import { NewCheckInPage } from '../../check-ins/create/NewCheckInPage.tsx';
import { PatientEditPage } from '../../edit/PatientEditPage.tsx';
import { PatientPhotoDetailsPage } from '../../images/$imageId/edit/PatientPhotoDetailsPage.tsx';
import { PatientPhotoViewerPage } from '../../images/$imageId/PatientPhotoViewerPage.tsx';
import { validatePatientImagesSearch } from '../../images/images.search.ts';
import { PatientImagesPage } from '../../images/PatientImagesPage.tsx';
import { PatientInvoicesPage } from '../../invoices/PatientInvoicesPage.tsx';
import { PatientNotesPage } from '../../notes/PatientNotesPage.tsx';
import { PatientOverviewPage } from '../../overview/PatientOverviewPage.tsx';
import { PatientPackagesPage } from '../../packages/PatientPackagesPage.tsx';
import {
  validatePatientFeedbackSearch,
  validatePatientFileDialogSearch,
} from '../../patient-id.dialog-search.ts';
import { validatePatientFileSearch } from '../../patient-id.search.ts';
import { PatientFileLayout } from '../../PatientFileLayout.tsx';
import { PatientPaymentsPage } from '../../payments/PatientPaymentsPage.tsx';
import { PatientPrescriptionsPage } from '../../prescriptions/PatientPrescriptionsPage.tsx';
import { PatientReportsPage } from '../../reports/PatientReportsPage.tsx';
import { EditReviewPage } from '../../reviews/$reviewId/edit/EditReviewPage.tsx';
import { NewReviewPage } from '../../reviews/create/NewReviewPage.tsx';
import type { PatientPhotoUploads } from '../../shared/hooks/usePatientPhotoUpload/index.ts';
import { PatientFileContext } from '../../shared/patient-file-context.ts';
import { PatientTimelinePage } from '../../timeline/PatientTimelinePage.tsx';
import { PatientTreatmentsPage } from '../../treatments/PatientTreatmentsPage.tsx';
import { PatientVisitsPage } from '../../visits/PatientVisitsPage.tsx';

/** Each section's URL-driven dialogs, as `routeTree.tsx` registers them under it (S:35–43). */
const DIALOG_PATHS: Readonly<Record<string, readonly string[]>> = {
  prescriptions: ['create', '$prescriptionId', '$prescriptionId/edit'],
  treatments: ['create', '$treatmentId/edit'],
  reports: ['create', '$reportId'],
};

/** The file's URL for a patient in the `acme` clinic. */
export function patientFileUrl(patientId: string, rest = ''): string {
  return `/organization/acme/patients/${patientId}${rest}`;
}

/**
 * The patient file as `routeTree.tsx` registers it — the layout with its
 * search schema, the eleven sections, Edit patient, the index and unknown
 * sections going to the Overview — opened at `url`, for the test member
 * (`signInTestMember`: organization `org_test`, slug `acme`) previewed as
 * `role` (View-as narrows the clinic access to that role's matrix). The
 * Patients list and every other path land on stand-ins, so a test can read
 * where a link went.
 */
export function renderPatientFile(url: string, { role = 'admin' }: { role?: Role } = {}) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });

  const root = createRootRoute({ component: () => <Outlet /> });
  const file = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/patients/$patientId',
    validateSearch: validatePatientFileSearch,
    component: PatientFileLayout,
  });
  const toDefault = ({
    params,
    search,
  }: {
    params: { organizationSlug: string; patientId: string };
    search: Record<string, unknown>;
  }) => {
    throw redirect({
      to: '/organization/$organizationSlug/patients/$patientId/timeline',
      params,
      search,
    });
  };
  const index = createRoute({
    getParentRoute: () => file,
    path: '/',
    beforeLoad: toDefault,
  });
  const unknown = createRoute({
    getParentRoute: () => file,
    path: '$',
    beforeLoad: toDefault,
  });
  // Each section's page, as `routeTree.tsx` registers them (through the sections module).
  const sections = Object.entries({
    timeline: PatientTimelinePage,
    overview: PatientOverviewPage,
    visits: PatientVisitsPage,
    prescriptions: PatientPrescriptionsPage,
    treatments: PatientTreatmentsPage,
    reports: PatientReportsPage,
    invoices: PatientInvoicesPage,
    payments: PatientPaymentsPage,
    packages: PatientPackagesPage,
    notes: PatientNotesPage,
  }).map(([path, component]) => {
    const section = createRoute({ getParentRoute: () => file, path, component });
    // The record dialogs (S:35–43) render nothing: the section opens them.
    const dialogs = (DIALOG_PATHS[path] ?? []).map((dialog) =>
      createRoute({ getParentRoute: () => section, path: dialog, component: () => null }),
    );
    return dialogs.length ? section.addChildren(dialogs) : section;
  });
  // Photos, with its album and filter, its viewer and Photo details (S:40–41).
  const images = createRoute({
    getParentRoute: () => file,
    path: 'images',
    validateSearch: validatePatientImagesSearch,
    component: PatientImagesPage,
  });
  const photo = createRoute({
    getParentRoute: () => images,
    path: '$imageId',
    component: PatientPhotoViewerPage,
  });
  const photoEdit = createRoute({
    getParentRoute: () => images,
    path: '$imageId/edit',
    component: PatientPhotoDetailsPage,
  });
  const edit = createRoute({
    getParentRoute: () => file,
    path: 'edit',
    validateSearch: validatePatientFileDialogSearch,
    component: PatientEditPage,
  });
  // The check-in and review drawers over the section they opened from (S:44–47).
  const feedbackDrawers = Object.entries({
    'check-ins/create': NewCheckInPage,
    'check-ins/$checkInId/edit': EditCheckInPage,
    'reviews/create': NewReviewPage,
    'reviews/$reviewId/edit': EditReviewPage,
  }).map(([path, component]) =>
    createRoute({
      getParentRoute: () => file,
      path,
      validateSearch: validatePatientFeedbackSearch,
      component,
    }),
  );
  const list = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/patients',
    component: () => <p>patients list</p>,
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      file.addChildren([
        index,
        unknown,
        ...sections,
        images.addChildren([photo, photoEdit]),
        edit,
        ...feedbackDrawers,
      ]),
      list,
      elsewhere,
    ]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

/** What {@link renderInPatientFile} puts in the file's context. */
export interface InPatientFileOptions {
  role?: Role;
  /** The file's read (`fetchPatientFile`); undefined while "loading". */
  file?: PatientFile;
  section?: PatientFileSectionSlug | null;
  viewable?: readonly PatientFileSectionSlug[];
  masked?: boolean;
  toggleMasked?: () => void;
  photos?: PatientPhotoUploads;
}

/**
 * One part of the file — a section, a hook's probe — rendered inside the
 * file's context at `…/patients/<file's patient>/<section>`, for the test
 * member previewed as `role`. Any other URL lands on a stand-in, so a test can read
 * where a link went from `router.state.location`.
 */
export function renderInPatientFile(
  ui: ReactNode,
  {
    role = 'admin',
    file,
    section = 'visits',
    viewable = PATIENT_FILE_SECTIONS,
    masked = true,
    toggleMasked = () => undefined,
    photos = { pick: () => undefined, upload: () => undefined },
  }: InPatientFileOptions = {},
) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });
  const patientId = file?.patient.id ?? 'patient';

  const root = createRootRoute({ component: () => <Outlet /> });
  const host = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/patients/$patientId/$',
    component: () => (
      <TooltipProvider>
        <PatientFileContext.Provider
          value={{ patientId, file, section, viewable, masked, toggleMasked, photos }}
        >
          {ui}
        </PatientFileContext.Provider>
      </TooltipProvider>
    ),
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([host, elsewhere]),
    history: createMemoryHistory({
      initialEntries: [patientFileUrl(patientId, `/${section ?? 'visits'}`)],
    }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

/** Put the stores the harness touched back as they were. */
export function resetPatientFile() {
  useUIStore.setState({ previewRole: null, fileActivityOpen: null });
  useOrganizationStore.getState().clearPermissions();
}
