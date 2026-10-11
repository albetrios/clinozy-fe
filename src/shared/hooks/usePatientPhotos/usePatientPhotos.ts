import {
  type InfiniteData,
  keepPreviousData,
  type QueryClient,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import type { DeleteReason } from '@/shared/api/app/app-schema.ts';
import { FILE_LINK_QUERY_OPTIONS } from '@/shared/api/app/file-links.ts';
import {
  deletePatientPhoto,
  fetchPatientPhoto,
  listPatientPhotos,
  patientImageQueryKeys,
  restorePatientPhoto,
  updatePatientPhoto,
} from '@/shared/api/app/patient-images-api.ts';
import type {
  PatientPhoto,
  PatientPhotoAlbumCounts,
  PatientPhotoChange,
  PatientPhotoListParams,
  PatientPhotoPage,
} from '@/shared/api/app/patient-images-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

/**
 * What a photo write refreshes: every photo read (the section, the viewer, the Overview's card)
 * and the person's activity (the server's `system` entry; `messageQueryKeys`, named here so the
 * hook does not load the messages module).
 */
const PHOTO_WRITE_KEYS = [patientImageQueryKeys.all, ['app', 'messages']];

/** {@link usePatientPhotos}: the pages read so far, the server's counts, and the paging. */
export interface PatientPhotoList {
  /** Every photo of the pages read so far, in the read's order (newest first by default). */
  photos: PatientPhoto[];
  /** The photos the params match, as the server counts them; null until it answers. */
  total: number | null;
  /** The live photos in each album (`meta.album_counts`, whatever the other params); null until read. */
  albumCounts: PatientPhotoAlbumCounts | null;
  /** The first page is out. */
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  /** The photos on screen are the previous params' while the new ones load. */
  isRefreshing: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** Read the next page — once at a time, however often it is pressed. */
  fetchNextPage: () => void;
  refetch: () => void;
}

/**
 * A patient's photos for the params (`GET /app/patients/:patient_id/images`), a cursor page at
 * a time — `limit` sets the page; "Load more" reads the next. Idle without a patient or an
 * organization, or with `enabled` false (the member's `patient:clinical_record:read` decides
 * whether the file shows photos at all). The server leaves the Private album out for a member
 * without `patient:private_album:read`. A failed read raises no toast: the screen says so in
 * place and offers Retry.
 */
export function usePatientPhotos(
  patientId: string,
  params: PatientPhotoListParams = {},
  { enabled = true }: { enabled?: boolean } = {},
): PatientPhotoList {
  const organizationId = useOrganizationId();
  const query = useInfiniteQuery({
    queryKey: patientImageQueryKeys.list(organizationId, patientId, params),
    queryFn: ({ pageParam }) => listPatientPhotos(patientId, params, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.next ?? undefined) : undefined),
    placeholderData: keepPreviousData,
    // Each photo's `file_url` lapses 15 minutes after the read (D86): read again before then
    ...FILE_LINK_QUERY_OPTIONS,
    // The screen renders this failure itself (see above).
    meta: { notifyOnError: false },
    enabled: enabled && organizationId !== null && patientId !== '',
  });

  const { fetchNextPage } = query;
  const inFlight = useRef(false);
  const loadMore = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    fetchNextPage()
      .catch(() => {
        // The query's own isError says so.
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [fetchNextPage]);

  const { data } = query;
  const photos = useMemo(() => data?.pages.flatMap((page) => page.rows) ?? [], [data]);
  const first = data?.pages[0];
  return {
    photos,
    total: first?.total ?? null,
    albumCounts: first?.albumCounts ?? null,
    isPending: query.isPending,
    isSuccess: query.isSuccess,
    isError: query.isError,
    isRefreshing: query.isPlaceholderData,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: loadMore,
    refetch: () => {
      query.refetch().catch(() => {
        // The query's own isError says so.
      });
    },
  };
}

/** The photo as a page already read holds it — what the viewer shows while its own read runs. */
function cachedPhoto(
  queryClient: QueryClient,
  organizationId: string | null,
  patientId: string,
  imageId: string,
): PatientPhoto | undefined {
  const lists = queryClient.getQueriesData<InfiniteData<PatientPhotoPage>>({
    queryKey: [...patientImageQueryKeys.patient(organizationId, patientId), 'list'],
  });
  for (const [, data] of lists) {
    for (const page of data?.pages ?? []) {
      const photo = page.rows.find((row) => row.id === imageId);
      if (photo) return photo;
    }
  }
  return undefined;
}

/**
 * One photo (`GET …/images/:patient_image_id`) — the viewer's and Photo details' read; idle
 * without an id. While it runs, the photo a list page already holds stands in, so the viewer
 * opens and steps at once. No toast when it fails: the screen turns a missing photo into
 * "Photo not found".
 */
export function usePatientPhoto(patientId: string, imageId: string) {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useAppQuery({
    queryKey: patientImageQueryKeys.detail(organizationId, patientId, imageId),
    queryFn: () => fetchPatientPhoto({ patientId, imageId }),
    placeholderData: () => cachedPhoto(queryClient, organizationId, patientId, imageId),
    ...FILE_LINK_QUERY_OPTIONS,
    enabled: organizationId !== null && patientId !== '' && imageId !== '',
    // The screen renders this failure itself (see above).
    notifyOnError: false,
  });
}

/** A Photo details save: the photo as read and what changed. */
export interface PatientPhotoUpdateVars {
  photo: PatientPhoto;
  change: PatientPhotoChange;
}

/**
 * Save Photo details — not optimistic (the drawer shows "Saving…"), refused when someone saved
 * the photo meanwhile (`409 record_changed`); the screen raises "Photo details saved".
 */
export function useUpdatePatientPhoto(
  options: CrudMutationOptions<PatientPhoto, PatientPhotoUpdateVars> = {},
) {
  return useAppMutation<PatientPhoto, PatientPhotoUpdateVars>({
    mutationFn: (vars, action) => updatePatientPhoto({ ...vars, ...action }),
    invalidateKeys: PHOTO_WRITE_KEYS,
    ...options,
  });
}

/** A photo delete: the photo and the confirm's reason and note. */
export interface PatientPhotoDeleteVars {
  photo: PatientPhoto;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Delete a photo — optimistic: it leaves every cached page at once and comes back if the write
 * fails; the counts follow from the refetch. No toast of its own: the reason confirm's `undo`
 * shows "Photo deleted" with Undo, which runs {@link useRestorePatientPhoto}.
 */
export function useDeletePatientPhoto(
  options: CrudMutationOptions<void, PatientPhotoDeleteVars> = {},
) {
  return useAppMutation<void, PatientPhotoDeleteVars, unknown, PatientPhoto>({
    mutationFn: ({ photo, reason, note }) =>
      deletePatientPhoto({ patientId: photo.patientId, imageId: photo.id, reason, note }),
    invalidateKeys: PHOTO_WRITE_KEYS,
    optimisticInfinite: {
      queryKey: patientImageQueryKeys.all,
      update: (rows, { photo }) => rows.filter((row) => row.id !== photo.id),
    },
    ...options,
  });
}

/** Put a deleted photo back (`POST …/restore`) — the Undo of "Photo deleted"; silent on success. */
export function useRestorePatientPhoto(
  options: CrudMutationOptions<PatientPhoto, PatientPhoto> = {},
) {
  return useAppMutation<PatientPhoto, PatientPhoto>({
    mutationFn: (photo, action) =>
      restorePatientPhoto({ patientId: photo.patientId, imageId: photo.id, ...action }),
    invalidateKeys: PHOTO_WRITE_KEYS,
    ...options,
  });
}
