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

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import { PATIENT_FILE_SECTIONS } from '@/shared/clinic/patient-file-sections.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { PRESET_CODES } from '@/tests/utils/clinic-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { patientFile } from '@/tests/utils/patient-doubles.ts';

import { PatientFileContext } from '../../../shared/patient-file-context.ts';
import { PatientTreatmentsPage } from '../../PatientTreatmentsPage.tsx';

/** The Treatments section's URL for Priya in the `acme` clinic. */
export function treatmentsUrl(file: PatientFile, rest = ''): string {
  return `/organization/acme/patients/${file.patient.id}/treatments${rest}`;
}

/** Who the test member is: a member holding a preset's codes, or these permission codes. */
export type TreatmentsMember =
  { role: Role } | { permissions: readonly OrganizationPermission[] };

/** Sign the test member in: a preset's codes, or their own. */
function signIn(member: TreatmentsMember) {
  signInTestMember();
  const codes = 'permissions' in member ? member.permissions : PRESET_CODES[member.role];
  useOrganizationStore.getState().setPermissions(['organization:read', ...codes]);
}

/**
 * `ui` inside the file's context for `file`, on the Treatments section's route with its dialog
 * routes (`create`, `$treatmentId/edit`), opened at `url`. Any other path lands on a stand-in,
 * so a test can read where a link went.
 */
function renderAt(url: string, file: PatientFile, ui: ReactNode) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const section = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/patients/$patientId/treatments',
    component: () => (
      <TooltipProvider>
        <PatientFileContext.Provider
          value={{
            patientId: file.patient.id,
            file,
            section: 'treatments',
            viewable: PATIENT_FILE_SECTIONS,
            masked: true,
            toggleMasked: () => undefined,
            photos: { pick: () => undefined, upload: () => undefined },
          }}
        >
          {ui}
        </PatientFileContext.Provider>
      </TooltipProvider>
    ),
  });
  const dialogs = ['create', '$treatmentId/edit'].map((path) =>
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

/**
 * The Treatments section as `routeTree.tsx` registers it, opened at `url` for the test member
 * (`signInTestMember`: organization `org_test`, slug `acme`) — holding a preset's codes,
 * or signed in with the codes given.
 */
export function renderTreatments(
  url: string,
  {
    member = { role: 'doctor' },
    file = patientFile(),
  }: { member?: TreatmentsMember; file?: PatientFile } = {},
) {
  signIn(member);
  return renderAt(url, file, <PatientTreatmentsPage />);
}

/** One part of the section — a hook's probe — on the section's URL, for the test member. */
export function renderInTreatments(
  ui: ReactNode,
  {
    member = { role: 'doctor' },
    file = patientFile(),
  }: { member?: TreatmentsMember; file?: PatientFile } = {},
) {
  signIn(member);
  return renderAt(treatmentsUrl(file), file, ui);
}

/** Put the stores the harness touched back as they were. */
export function resetTreatments() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
}
