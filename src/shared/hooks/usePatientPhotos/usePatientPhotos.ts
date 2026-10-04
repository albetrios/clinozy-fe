import type { DeleteReason, PatientImage } from '@/shared/api/clinic/clinic-schema.ts';
import {
  deletePatientPhoto,
  listPatientPhotos,
  patientImageQueryKeys,
  type PatientPhotoPatch,
  type PatientPhotos,
  restorePatientPhoto,
  updatePatientPhoto,
} from '@/shared/api/clinic/patient-images-api.ts';
import { patientQueryKeys } from '@/shared/api/clinic/patients-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';

/**
 * What a photo write refreshes: every patient read — the photos sit under it,
 * and the file's section counts read them ("Empty" / "Has records").
 */
const PHOTO_WRITE_KEYS = [patientQueryKeys.all];

/**
 * A patient's photos and visits (`S:1632`; KICKOFF §6.6 Photos); idle without
 * a patient. `privateAlbum` — whether the member may open the Private album
 * (Doctor, Admin, Owner; `S:40`) — decides whether its photos are read at all.
 * A failed read raises no toast: the section keeps its last copy and offers Retry.
 */
export function usePatientPhotos(
  patientId: string,
  { privateAlbum, enabled = true }: { privateAlbum: boolean; enabled?: boolean },
) {
  return useAppQuery({
    queryKey: patientImageQueryKeys.list(patientId, privateAlbum),
    queryFn: () => listPatientPhotos(patientId, { privateAlbum }),
    enabled: enabled && patientId !== '',
    // The section renders this failure itself (see above).
    notifyOnError: false,
  });
}

/** A Photo details save. */
export interface PatientPhotoUpdateVars {
  id: string;
  patch: PatientPhotoPatch;
}

/** Save Photo details (`S:1643`); the screen raises "Photo details saved". */
export function useUpdatePatientPhoto(
  options: CrudMutationOptions<PatientImage, PatientPhotoUpdateVars> = {},
) {
  return useAppMutation<PatientImage, PatientPhotoUpdateVars>({
    mutationFn: ({ id, patch }) => updatePatientPhoto(id, patch),
    invalidateKeys: PHOTO_WRITE_KEYS,
    ...options,
  });
}

/** A photo delete: the photo and the confirm's stored reason and note. */
export interface PatientPhotoDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Delete a photo — optimistic: it leaves every cached album at once and comes
 * back if the write fails. No toast of its own: the reason confirm's `undo`
 * shows "Photo deleted" with Undo, which runs {@link useRestorePatientPhoto}.
 */
export function useDeletePatientPhoto(
  options: CrudMutationOptions<PatientImage, PatientPhotoDeleteVars> = {},
) {
  return useAppMutation<PatientImage, PatientPhotoDeleteVars>({
    mutationFn: ({ id, reason, note }) => deletePatientPhoto(id, reason, note),
    invalidateKeys: PHOTO_WRITE_KEYS,
    optimisticQueries: {
      queryKey: patientImageQueryKeys.all,
      update: (data, { id }) => {
        const read = data as PatientPhotos;
        return { ...read, photos: read.photos.filter((photo) => photo.id !== id) };
      },
    },
    ...options,
  });
}

/** Put a deleted photo back — the Undo of "Photo deleted" (D32); silent on success. */
export function useRestorePatientPhoto(
  options: CrudMutationOptions<PatientImage, string> = {},
) {
  return useAppMutation<PatientImage, string>({
    mutationFn: restorePatientPhoto,
    invalidateKeys: PHOTO_WRITE_KEYS,
    ...options,
  });
}
