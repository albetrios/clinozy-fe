import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { patientName, type PatientRow } from '@/shared/api/clinic/patients-contracts.ts';
import { UPLOAD_MAX_BYTES } from '@/shared/api/uploads-api.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { formatFileSize } from '@/shared/components/UploadTray/format-file-size.ts';
import { UPLOAD_TRAY_NS } from '@/shared/components/UploadTray/upload-tray.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { TriangleAlert, X } from '@/shared/icons/index.ts';

import { PATIENT_DRAWER_KEYS, PATIENT_DRAWER_NS } from './patient-drawer.constants.ts';

/** A photo picked for filing: the file, and an id for its chip. */
export interface PickedPhoto {
  id: string;
  file: File;
}

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
 * The First photos field (Q-P2; `patients.md:84`): a 96px dashed zone — "Take
 * or drop photos", "JPG or PNG · up to 10 MB each" — that takes images by
 * click (a phone offers its camera) or drop, then the picks as 24px chips,
 * each removable. The drawer files them after the save, through the upload
 * tray, which skips a file over the limit with its own toast.
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
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    const images = Array.from(list ?? []).filter((file) =>
      file.type.startsWith('image/'),
    );
    if (images.length > 0) {
      onChange([...files, ...images.map((file) => ({ id: crypto.randomUUID(), file }))]);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        id={id}
        type="button"
        disabled={disabled}
        data-testid={`${testId}-photos`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!disabled) add(event.dataTransfer.files);
        }}
        className="border-border-strong bg-canvas text-body text-muted-foreground-strong hover:border-muted-foreground hover:bg-muted flex h-24 flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        <span className="font-medium">{t(PATIENT_DRAWER_KEYS.fields.photosDrop)}</span>
        <span className="text-caption text-muted-foreground">
          {t(PATIENT_DRAWER_KEYS.fields.photosLimit, {
            limit: formatFileSize(PHOTO_LIMIT_BYTES, { t: tTray, formatNumber }),
          })}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        tabIndex={-1}
        data-testid={`${testId}-photos-input`}
        onChange={(event) => {
          add(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {files.map(({ id: photoId, file }) => (
            <li
              key={photoId}
              data-slot="pill"
              className="bg-muted text-muted-foreground-strong inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-full ps-2.5 pe-1 text-xs font-medium tabular-nums"
            >
              <span className="min-w-0 truncate">{file.name}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={t(PATIENT_DRAWER_KEYS.fields.photosRemove, {
                  name: file.name,
                })}
                onClick={() => onChange(files.filter((photo) => photo.id !== photoId))}
                data-slot="pill"
                className="hover:bg-muted-strong flex size-4.5 shrink-0 items-center justify-center rounded-full"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
