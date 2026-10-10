import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { PATIENT_PHOTO_CONTENT_TYPES } from '@/shared/api/clinic/patient-images-contracts.ts';
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

/** The photos the API files: JPG and PNG. */
const PHOTO_TYPES: ReadonlySet<string> = new Set(PATIENT_PHOTO_CONTENT_TYPES);

/** The one size limit a clinic upload carries (Q-P5: 10 MB everywhere). */
const PHOTO_LIMIT_BYTES = UPLOAD_MAX_BYTES['organization-file'];

/** The butter notice under the Mobile field: its words and an optional action. */
function MobileNotice({
  text,
  action,
  testId,
}: {
  text: string;
  action?: { label: string; onClick: () => void };
  testId: string;
}) {
  return (
    <output
      data-testid={`${testId}-duplicate`}
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs',
        TONE_CLASSES.butter.surface,
      )}
    >
      <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0">{text}</span>
      {action ? (
        <button
          type="button"
          data-testid={`${testId}-duplicate-action`}
          onClick={action.onClick}
          className="font-semibold underline underline-offset-2"
        >
          {action.label}
        </button>
      ) : null}
    </output>
  );
}

/**
 * "Same mobile as Priya Shah · #3508" under the Mobile field (Q-P7), on the
 * butter tone, with its action — "Open file" in the room's drawer, "Use
 * existing" in quick-add — once the patient is read. It warns; it never blocks
 * the save or merges.
 */
export function PatientDuplicateNotice({
  person,
  actionLabel,
  onAction,
  testId,
}: {
  /** The patient on the mobile: their name and file number. */
  person: { name: string; seq: number | null };
  actionLabel: string;
  onAction?: () => void;
  testId: string;
}) {
  const { t } = useTranslation(PATIENT_DRAWER_NS);
  return (
    <MobileNotice
      text={t(PATIENT_DRAWER_KEYS.duplicate, {
        name: person.name,
        id: person.seq === null ? '' : displayId.patient(person.seq),
      })}
      action={onAction ? { label: actionLabel, onClick: onAction } : undefined}
      testId={testId}
    />
  );
}

/**
 * "Riya Mehta is already in your contacts · the file opens on them" — the mobile is someone
 * the clinic knows without a patient file (a lead's person): the new file is theirs, with
 * their name and numbers as the contact keeps them.
 */
export function PatientKnownPersonNotice({
  name,
  testId,
}: {
  name: string;
  testId: string;
}) {
  const { t } = useTranslation(PATIENT_DRAWER_NS);
  return (
    <MobileNotice text={t(PATIENT_DRAWER_KEYS.knownPerson, { name })} testId={testId} />
  );
}

/**
 * The First photos field (Q-P2; `patients.md:84`): the shared upload zone —
 * "Take or drop photos", "JPG or PNG · up to 10 MB each" — taking JPG and PNG only,
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
  files: readonly PickedFile[];
  onChange: (files: PickedFile[]) => void;
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
      accept={PATIENT_PHOTO_CONTENT_TYPES.join(',')}
      takes={(file) => PHOTO_TYPES.has(file.type)}
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
