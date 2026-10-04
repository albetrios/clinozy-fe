import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { patientName, type PatientRow } from '@/shared/api/clinic/patients-contracts.ts';
import { UPLOAD_MAX_BYTES } from '@/shared/api/uploads-api.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerFilesField,
  type PickedFile,
} from '@/shared/components/DrawerField/index.ts';
import { formatFileSize } from '@/shared/components/UploadTray/format-file-size.ts';
import { UPLOAD_TRAY_NS } from '@/shared/components/UploadTray/upload-tray.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { TriangleAlert } from '@/shared/icons/index.ts';

import { PATIENT_DRAWER_KEYS, PATIENT_DRAWER_NS } from './patient-drawer.constants.ts';

/** A photo picked for filing: the file, and an id for its chip. */
export type PickedPhoto = PickedFile;

/** The one size limit a clinic upload carries (Q-P5: 10 MB everywhere). */
const PHOTO_LIMIT_BYTES = UPLOAD_MAX_BYTES['organization-file'];

/**
 * "Same mobile as Priya Shah · #3508" under the Mobile field (Q-P7), on the
 * butter tone, with its action — "Open file" in the room's drawer, "Use
 * existing" in quick-add. It warns; it never blocks the save or merges.
 */
export function PatientDuplicateNotice({
  patient,
  actionLabel,
  onAction,
  testId,
}: {
  patient: PatientRow;
  actionLabel: string;
  onAction: () => void;
  testId: string;
}) {
  const { t } = useTranslation(PATIENT_DRAWER_NS);
  return (
    <p
      role="status"
      data-testid={`${testId}-duplicate`}
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs',
        TONE_CLASSES.butter.surface,
      )}
    >
      <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0">
        {t(PATIENT_DRAWER_KEYS.duplicate, {
          name: patientName(patient),
          id: displayId.patient(patient.seq),
        })}
      </span>
      <button
        type="button"
        data-testid={`${testId}-duplicate-action`}
        onClick={onAction}
        className="font-semibold underline underline-offset-2"
      >
        {actionLabel}
      </button>
    </p>
  );
}

/**
 * The First photos field (Q-P2; `patients.md:84`): the shared upload zone —
 * "Take or drop photos", "JPG or PNG · up to 10 MB each" — taking images only,
 * by click (a phone offers its camera) or drop. The drawer files them after
 * the save, through the upload tray, which skips a file over the limit with
 * its own toast.
 */
export function PatientPhotosField({
  id,
  files,
  onChange,
  disabled,
  testId,
}: {
  id: string;
  files: readonly PickedPhoto[];
  onChange: (files: PickedPhoto[]) => void;
  disabled?: boolean;
  testId: string;
}) {
  const { t } = useTranslation(PATIENT_DRAWER_NS);
  const { t: tTray } = useTranslation(UPLOAD_TRAY_NS);
  const { formatNumber } = useLocaleFormat();
  return (
    <DrawerFilesField
      id={id}
      files={files}
      onChange={onChange}
      accept="image/*"
      takes={(file) => file.type.startsWith('image/')}
      title={t(PATIENT_DRAWER_KEYS.fields.photosDrop)}
      hint={t(PATIENT_DRAWER_KEYS.fields.photosLimit, {
        limit: formatFileSize(PHOTO_LIMIT_BYTES, { t: tTray, formatNumber }),
      })}
      removeLabel={(name) => t(PATIENT_DRAWER_KEYS.fields.photosRemove, { name })}
      disabled={disabled}
      testId={`${testId}-photos`}
    />
  );
}
