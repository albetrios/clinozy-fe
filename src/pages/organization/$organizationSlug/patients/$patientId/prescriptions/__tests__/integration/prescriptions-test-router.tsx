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
import type { ReactNode } from 'react';

import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import { PATIENT_FILE_SECTIONS } from '@/shared/clinic/patient-file-sections.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import { PatientFileContext } from '../../../shared/patient-file-context.ts';
import { PatientPrescriptionsPage } from '../../PatientPrescriptionsPage.tsx';

/** A path under the test patient's Prescriptions: `''`, `/create`, `/<id>`, `/<id>/edit`. */
export function prescriptionsUrl(rest = '', patientId = TEST_PATIENT_ID): string {
  return `/organization/acme/patients/${patientId}/prescriptions${rest}`;
}

/** Who the test member is: a View-as `role` (the role gates), or their own permission `codes`. */
export type PrescriptionsMember =
  { role: Role } | { codes: readonly OrganizationPermission[] };

/** Sign the test member in as `member`. */
function signInPrescriptionsMember(member: PrescriptionsMember): void {
  signInTestMember();
  if ('role' in member) {
    useOrganizationStore.getState().setPermissions(['organization:read']);
    useUIStore.setState({ previewRole: member.role });
    return;
  }
  useOrganizationStore.getState().setPermissions(['organization:read', ...member.codes]);
  useUIStore.setState({ previewRole: null });
}

/**
 * The Prescriptions section as `routeTree.tsx` registers it under the file — the section with
 * its dialog routes (`create`, `$prescriptionId`, `$prescriptionId/edit`, which render nothing:
 * the section opens them) — inside the file's context for `file`, opened at `url`. Any other
 * path (the visit flow's Overview, a medical sale) lands on a stand-in, so a test can read
 * where a link went.
 */
export function renderPrescriptions(
  url: string,
  {
    member = { role: 'admin' },
    file = patientFile(),
    ui,
  }: { member?: PrescriptionsMember; file?: PatientFile; ui?: ReactNode } = {},
) {
  signInPrescriptionsMember(member);
  const context = {
    patientId: file.patient.id,
    file,
    section: 'prescriptions' as const,
    viewable: PATIENT_FILE_SECTIONS,
    masked: true,
    toggleMasked: () => undefined,
    photos: { pick: () => undefined, upload: () => undefined },
  };
  const root = createRootRoute({ component: () => <Outlet /> });
  const section = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/patients/$patientId/prescriptions',
    component: () => (
      <TooltipProvider>
        <PatientFileContext.Provider value={context}>
          {ui ?? <PatientPrescriptionsPage />}
        </PatientFileContext.Provider>
      </TooltipProvider>
    ),
  });
  const dialogs = ['create', '$prescriptionId', '$prescriptionId/edit'].map((path) =>
    createRoute({ getParentRoute: () => section, path, component: () => null }),
  );
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([section.addChildren(dialogs), elsewhere]),
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
export function resetPrescriptionsMember(): void {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
}
