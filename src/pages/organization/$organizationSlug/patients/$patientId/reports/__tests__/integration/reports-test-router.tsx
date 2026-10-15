/**
 * The Reports section as `routeTree.tsx` registers it — the section with its two dialog routes
 * (`create`, `$reportId`), which render nothing: the section reads the URL and opens them —
 * inside the patient file's context, for a signed-in member holding `codes` (or previewing
 * `role` with View-as). The file layout itself is not rendered: the section only reads the
 * file's context. Every other path lands on a stand-in.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type { PatientFile } from '@/shared/api/app/patient-file-contracts.ts';
import { PATIENT_FILE_SECTIONS } from '@/shared/app/patient-file-sections.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { patientFile } from '@/tests/utils/patient-doubles.ts';

import { PatientFileContext } from '../../../shared/patient-file-context.ts';
import { PatientReportsPage } from '../../PatientReportsPage.tsx';

/** Reading and writing reports, beside the file's reads. */
export const REPORT_CODES: readonly OrganizationPermission[] = [
  'organization:read',
  'patient:read',
  'patient:update',
  'patient:clinical_record:read',
];

/** The Reports URL of the shared `patientFile()` double's patient, in the `acme` clinic. */
export function reportsUrl(rest = ''): string {
  return `/organization/acme/patients/${patientFile().patient.id}/reports${rest}`;
}

/** Render the Reports routes at `url`; answers the view, the router and the query client. */
export function renderReports(
  url: string,
  {
    codes = REPORT_CODES,
    file = patientFile(),
  }: { codes?: readonly OrganizationPermission[]; file?: PatientFile } = {},
) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions([...codes]);
  useUIStore.setState({ previewRole: null });

  const root = createRootRoute({ component: () => <Outlet /> });
  const host = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/patients/$patientId',
    component: () => (
      <TooltipProvider>
        <PatientFileContext.Provider
          value={{
            patientId: file.patient.id,
            file,
            section: 'reports',
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
      </TooltipProvider>
    ),
  });
  const reports = createRoute({
    getParentRoute: () => host,
    path: 'reports',
    component: PatientReportsPage,
  });
  const dialogs = ['create', '$reportId'].map((path) =>
    createRoute({ getParentRoute: () => reports, path, component: () => null }),
  );
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      host.addChildren([reports.addChildren(dialogs)]),
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

/** Put the stores the harness touched back as they were. */
export function resetReports(): void {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
}
