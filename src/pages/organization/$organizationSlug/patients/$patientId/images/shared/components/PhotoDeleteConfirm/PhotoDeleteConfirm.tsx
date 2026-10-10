import { useTranslation } from 'react-i18next';

import {
  type PatientPhoto,
  photoName,
} from '@/shared/api/clinic/patient-images-contracts.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import {
  useDeletePatientPhoto,
  useRestorePatientPhoto,
} from '@/shared/hooks/usePatientPhotos/index.ts';

import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../../shared/patient-photos.constants.ts';

const K = PATIENT_PHOTOS_KEYS.delete;

/** A reason's label key, with the namespace the confirm needs to find it. */
const reasonLabel = (key: string) => `${PATIENT_PHOTOS_NS}:${key}`;

/**
 * The photo delete's reasons (`patient-file.md:66`), each stored as the API's `reason`:
 * "Wrong patient" was filed by `mistake`, "Blurry / retake" is `not_needed` (Q24's value for a
 * removed photo), "Duplicate" is `duplicate`, "Other" is `other` with its note.
 */
const PHOTO_DELETE_REASONS = [
  { value: 'mistake', labelKey: reasonLabel(K.reasons.wrongPatient) },
  { value: 'not_needed', labelKey: reasonLabel(K.reasons.blurry) },
  { value: 'duplicate', labelKey: reasonLabel(K.reasons.duplicate) },
  { value: 'other', labelKey: reasonLabel(K.reasons.other) },
] as const;

/** Props of {@link PhotoDeleteConfirm}. */
export interface PhotoDeleteConfirmProps {
  /** The photo to delete — the confirm is open while there is one. */
  photo: PatientPhoto | null;
  onClose: () => void;
  /** Once the photo is gone — the viewer closes. */
  onDeleted?: () => void;
}

/**
 * "Delete this photo?" (KICKOFF §6.6 Photos; §3.5 reason confirm): the photo's
 * name as the record, the four reasons; `DELETE …/images/:patient_image_id`
 * with the reason picked — the photo leaves at once, and "Photo deleted"
 * offers Undo, which restores it (`POST …/restore`, D32).
 */
export function PhotoDeleteConfirm({
  photo,
  onClose,
  onDeleted,
}: PhotoDeleteConfirmProps) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const remove = useDeletePatientPhoto();
  const restore = useRestorePatientPhoto();
  return (
    <ConfirmDialog
      open={photo !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(K.title)}
      reason={{
        record: photo ? photoName(photo) : undefined,
        options: PHOTO_DELETE_REASONS,
        undo: photo
          ? { message: t(K.deleted), onUndo: () => restore.mutate(photo) }
          : undefined,
      }}
      onConfirm={async ({ reason, note }) => {
        if (!photo) return;
        await remove.mutateAsync({ photo, reason, note });
        // The confirm closes itself once this lands, then offers Undo.
        onDeleted?.();
      }}
    />
  );
}
