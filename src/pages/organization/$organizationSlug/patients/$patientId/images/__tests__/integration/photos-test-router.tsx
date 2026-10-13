/**
 * The Photos section as `routeTree.tsx` registers it — the section with its album and filter,
 * the viewer (`$imageId`) and Photo details (`$imageId/edit`) — inside the patient file's
 * context, for a signed-in member holding `codes` (or a preset `role`'s codes). The file
 * layout itself is not rendered: its reads are other sections' business, and the section only
 * reads the file's context. Every other path lands on a stand-in, so a test can read where a
 * link went.
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
import type { Role } from '@/shared/api/app/app-schema.ts';
import type { PatientFile } from '@/shared/api/app/patient-file-contracts.ts';
import { PATIENT_FILE_SECTIONS } from '@/shared/app/patient-file-sections.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { PRESET_CODES } from '@/tests/utils/app-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { patientFile } from '@/tests/utils/patient-doubles.ts';

import type { PatientPhotoUploads } from '../../../shared/hooks/usePatientPhotoUpload/index.ts';
import { PatientFileContext } from '../../../shared/patient-file-context.ts';
import { PatientPhotoDetailsPage } from '../../$imageId/edit/PatientPhotoDetailsPage.tsx';
import { PatientPhotoViewerPage } from '../../$imageId/PatientPhotoViewerPage.tsx';
import { validatePatientImagesSearch } from '../../images.search.ts';
import { PatientImagesPage } from '../../PatientImagesPage.tsx';

/** What every photo write needs and the Private album's code, beside the file's reads. */
export const PHOTO_CODES: readonly OrganizationPermission[] = [
  'organization:read',
  'patient:read',
  'patient:update',
  'patient:clinical_record:read',
  'patient:private_album:read',
];

/** The Photos URL of the shared `patientFile()` double's patient, in the `acme` clinic. */
export function photosUrl(rest = ''): string {
  return `/organization/acme/patients/${patientFile().patient.id}/images${rest}`;
}

/** Options of {@link renderPhotos}. */
interface RenderPhotosOptions {
  /** The member's own codes (no View-as). */
  codes?: readonly OrganizationPermission[];
  /** A member holding this preset's codes instead of `codes`. */
  role?: Role;
  file?: PatientFile;
  photos?: PatientPhotoUploads;
}

/** Render the Photos routes at `url`; answers the view, the router and the query client. */
export function renderPhotos(
  url: string,
  {
    codes = PHOTO_CODES,
    role,
    file = patientFile(),
    photos = { pick: () => undefined, upload: () => undefined },
  }: RenderPhotosOptions = {},
) {
  signInTestMember();
  useOrganizationStore
    .getState()
    .setPermissions([...(role ? PRESET_CODES[role] : codes)]);

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
            section: 'images',
            viewable: PATIENT_FILE_SECTIONS,
            masked: true,
            toggleMasked: () => undefined,
            photos,
          }}
        >
          <Outlet />
        </PatientFileContext.Provider>
      </TooltipProvider>
    ),
  });
  const images = createRoute({
    getParentRoute: () => host,
    path: 'images',
    validateSearch: validatePatientImagesSearch,
    component: PatientImagesPage,
  });
  const viewer = createRoute({
    getParentRoute: () => images,
    path: '$imageId',
    component: PatientPhotoViewerPage,
  });
  const details = createRoute({
    getParentRoute: () => images,
    path: '$imageId/edit',
    component: PatientPhotoDetailsPage,
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      host.addChildren([images.addChildren([viewer, details])]),
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
export function resetPhotos(): void {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
}
