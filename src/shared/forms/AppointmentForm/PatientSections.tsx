import { useQueryClient } from '@tanstack/react-query';
import { type DragEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { attachVisitPhoto } from '@/shared/api/clinic/appointments-api.ts';
import type { ImageAlbum, PatientImage } from '@/shared/api/clinic/clinic-schema.ts';
import { IMAGE_ALBUM_VALUES } from '@/shared/api/clinic/clinic-schema.ts';
import { IMAGE_ALBUM_TONES, TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  ConfirmDialog,
  type ConfirmReasonOption,
} from '@/shared/components/ConfirmDialog/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import {
  useDeleteVisitPhoto,
  useRestoreVisitPhoto,
  useVisitPhotos,
  VISIT_PHOTO_WRITE_KEYS,
} from '@/shared/hooks/useAppointments/index.ts';
import { useUploadQueue } from '@/shared/hooks/useUploadQueue/index.ts';
import { Camera, ImageIcon, PenLine, Trash } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  APPOINTMENT_FORM_KEYS,
  APPOINTMENT_FORM_NS,
  APPOINTMENT_FORM_TEST_IDS,
} from './appointment-form.constants.ts';

const IDS = APPOINTMENT_FORM_TEST_IDS;
const P = APPOINTMENT_FORM_KEYS.photos;
const N = APPOINTMENT_FORM_KEYS.notPatient;

/** Delete photo's reasons (H:4528): Wrong patient · Blurry / retake · Duplicate · Other. */
const PHOTO_DELETE_REASONS: readonly ConfirmReasonOption[] = [
  { value: 'wrong_patient', labelKey: P.reasons.wrongPatient },
  { value: 'blurry', labelKey: P.reasons.blurry },
  { value: 'duplicate', labelKey: P.reasons.duplicate },
  { value: 'other', labelKey: P.reasons.other },
];

/** Only image files go up from the photos card (H:4531). */
const isImage = (file: File) => file.type.startsWith('image/');

/**
 * Step 3 · Not a patient yet (Edit, a lead or contact; H:2795,
 * `appointments.md:252–259`): the amber "3" card whose "Create patient record"
 * stacks the New patient form.
 */
export function NotPatientCard({ onCreate }: { onCreate?: () => void }) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  return (
    <section
      aria-label={t(N.section)}
      data-testid={IDS.notPatient}
      className="border-tone-butter-border bg-tone-butter-tint flex flex-none items-center gap-3 rounded-xl border px-4 py-3.5 @max-[480px]:flex-wrap"
    >
      <span
        aria-hidden="true"
        data-slot="pill"
        className="text-micro bg-tone-butter-foreground text-background flex size-6 flex-none items-center justify-center rounded-full font-semibold"
      >
        3
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[1.3]">
        <span className="text-field text-tone-butter-foreground font-semibold">
          {t(N.title)}
        </span>
        <span className="text-muted-foreground-strong text-xs text-pretty">
          {t(N.body)}
        </span>
      </span>
      {onCreate ? (
        <button
          type="button"
          data-testid={IDS.createPatient}
          onClick={onCreate}
          className="bg-primary text-primary-foreground hover:bg-primary/90 text-body h-9 flex-none rounded-lg px-3.5 font-medium whitespace-nowrap transition-colors"
        >
          {t(N.action)}
        </button>
      ) : null}
    </section>
  );
}

/** Props for {@link VisitPhotos}. */
export interface VisitPhotosProps {
  appointmentId: string;
  /** The patient's first name: "they show in <first>’s file". */
  firstName: string;
  /** Checked in or completed: the albums, the upload and the tiles show. */
  open: boolean;
  /** "Check in now" — offered when the visit can be checked in now. */
  onCheckIn?: () => void;
  /** The Private album (Doctor and Admin, `S:40`; Q-F5). */
  canPrivate: boolean;
  /** Edit on the visit: upload, edit details, delete. */
  canEdit: boolean;
  /** A tile — the file's photo viewer on it (`images/:imageId`, L-44). */
  onOpenPhoto: (photo: PatientImage) => void;
  /** "Edit details" — the Photo details drawer (`images/:imageId/edit`, L-44). */
  onEditPhoto: (photo: PatientImage) => void;
}

/** One photo tile (H:2800): its album tag, its name, Edit details and Delete photo. */
function PhotoTile({
  photo,
  canEdit,
  onOpen,
  onEdit,
  onDelete,
}: {
  photo: PatientImage;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const tone = TONE_CLASSES[IMAGE_ALBUM_TONES[photo.album]];
  const name = photo.fileName.replace(/\.[a-z0-9]+$/i, '');
  const action =
    'flex size-6 items-center justify-center rounded-md bg-background/14 text-background transition-colors hover:bg-background/28';
  return (
    <div
      data-testid={IDS.photoTile}
      className="bg-muted relative aspect-square overflow-hidden rounded-lg border"
    >
      <button
        type="button"
        aria-label={t(P.open, { name })}
        onClick={onOpen}
        className="text-disabled absolute inset-0 flex cursor-zoom-in items-center justify-center"
      >
        <ImageIcon aria-hidden="true" className="size-5" />
      </button>
      <span
        data-slot="pill"
        className={cn(
          'text-tiny pointer-events-none absolute start-1.5 top-1.5 inline-flex h-5 items-center rounded-full px-1.75 font-semibold whitespace-nowrap',
          tone.surface,
        )}
      >
        {t(P.albums[photo.album])}
      </span>
      <div
        data-surface="light-pinned"
        className="from-overlay/78 via-overlay/35 text-background absolute inset-x-0 bottom-0 flex items-center gap-1 bg-linear-to-t to-transparent px-1.5 pt-3.5 pb-1.25"
      >
        <span className="text-tiny min-w-0 flex-1 truncate font-semibold" title={name}>
          {name}
        </span>
        {canEdit ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t(P.edit)}
                  onClick={onEdit}
                  className={action}
                >
                  <PenLine aria-hidden="true" className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t(P.edit)}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t(P.delete)}
                  data-testid={IDS.photoDelete}
                  onClick={onDelete}
                  className={cn(action, 'hover:bg-destructive')}
                >
                  <Trash aria-hidden="true" className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t(P.delete)}</TooltipContent>
            </Tooltip>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Photos from this visit (Edit, a patient; H:2796–2801, `appointments.md:261–268`):
 * before check-in a locked line with "Check in now"; after, the album switch
 * General · Private · LHR, "Upload photos", a drop zone, the visit's photos
 * and an "Add" tile. Uploads go through the shared tray (images only, its size
 * limit, Q-P5) and file under this visit (`uploadVisitPhotos`, `S:1613`).
 */
export function VisitPhotos({
  appointmentId,
  firstName,
  open,
  onCheckIn,
  canPrivate,
  canEdit,
  onOpenPhoto,
  onEditPhoto,
}: VisitPhotosProps) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const queryClient = useQueryClient();
  const { enqueue } = useUploadQueue();
  const photos = useVisitPhotos(appointmentId).data ?? [];
  const remove = useDeleteVisitPhoto();
  const restore = useRestoreVisitPhoto();
  const [album, setAlbum] = useState<ImageAlbum>('general');
  const [deleting, setDeleting] = useState<PatientImage | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const albums = IMAGE_ALBUM_VALUES.filter((value) => value !== 'private' || canPrivate);

  const upload = (files: FileList | readonly File[]) => {
    const images = Array.from(files).filter(isImage);
    if (images.length === 0) return;
    const into = album;
    let filed = 0;
    const { accepted } = enqueue(images, {
      onUploaded: async (key, file) => {
        await attachVisitPhoto({ appointmentId, album: into, key, fileName: file.name });
        filed += 1;
        for (const queryKey of VISIT_PHOTO_WRITE_KEYS) {
          void queryClient.invalidateQueries({ queryKey });
        }
        if (filed === accepted) notify.success(t(P.attached, { count: filed }));
      },
    });
  };

  const sub =
    photos.length > 0
      ? t(P.count, { count: photos.length, first: firstName })
      : t(P.empty, { first: firstName });

  return (
    <section
      aria-label={t(P.section)}
      data-testid={IDS.photos}
      onDragOver={(event: DragEvent) => {
        if (open && canEdit) event.preventDefault();
      }}
      onDrop={(event: DragEvent) => {
        if (!(open && canEdit)) return;
        event.preventDefault();
        upload(event.dataTransfer.files);
      }}
      data-slot="visit-photos"
      className="bg-card flex flex-none flex-col overflow-hidden rounded-xl border"
    >
      <div className="flex items-center gap-2.5 border-b px-3.5 py-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 flex-none items-center justify-center rounded-lg',
            TONE_CLASSES.blush.surface,
          )}
        >
          <Camera className="size-3.75" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <span className="text-field font-semibold whitespace-nowrap">{t(P.title)}</span>
          <span className="text-muted-foreground truncate text-xs">{sub}</span>
        </span>
      </div>
      {open ? (
        <>
          {canEdit ? (
            <div className="flex items-center gap-2 px-3.5 pt-2.5">
              <div
                role="radiogroup"
                aria-label={t(P.album)}
                data-slot="album-switch"
                className="bg-card flex h-8 w-max flex-1 gap-0.5 rounded-lg border p-0.75"
              >
                {albums.map((value) => {
                  const on = value === album;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setAlbum(value)}
                      className={cn(
                        'h-6 rounded-md px-2.25 text-xs font-medium whitespace-nowrap transition-colors',
                        on
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground-strong hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {t(P.albums[value])}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                data-testid={IDS.photosUpload}
                onClick={() => input.current?.click()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-detail inline-flex h-8 flex-none items-center gap-1.5 rounded-lg ps-2.5 pe-3 font-medium whitespace-nowrap transition-colors"
              >
                <Camera aria-hidden="true" className="size-3.25" />
                {t(P.upload)}
              </button>
              <input
                ref={input}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                  if (event.currentTarget.files) upload(event.currentTarget.files);
                  event.currentTarget.value = '';
                }}
              />
            </div>
          ) : null}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 px-3.5 pt-2.5 pb-3">
            {photos.map((photo) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                canEdit={canEdit}
                onOpen={() => onOpenPhoto(photo)}
                onEdit={() => onEditPhoto(photo)}
                onDelete={() => setDeleting(photo)}
              />
            ))}
            {canEdit ? (
              <button
                type="button"
                data-slot="photo-add"
                onClick={() => input.current?.click()}
                className="border-border-strong bg-card text-muted-foreground hover:bg-muted hover:text-foreground flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed text-xs font-medium transition-colors"
              >
                <Camera aria-hidden="true" className="size-3.25" />
                {t(P.add)}
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="bg-canvas flex items-center gap-2.5 px-3.5 py-3">
          <span className="text-detail text-muted-foreground-strong min-w-0 flex-1">
            {t(P.locked)}
          </span>
          {onCheckIn ? (
            <button
              type="button"
              data-testid={IDS.photosCheckIn}
              data-slot="button"
              onClick={onCheckIn}
              className="bg-card hover:bg-muted text-detail h-8 flex-none rounded-lg border px-3 font-medium whitespace-nowrap transition-colors"
            >
              {t(P.checkIn)}
            </button>
          ) : null}
        </div>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
        title={t(P.deleteTitle)}
        reason={{
          record: deleting ? deleting.fileName.replace(/\.[a-z0-9]+$/i, '') : undefined,
          options: PHOTO_DELETE_REASONS,
          undo: deleting
            ? { message: t(P.deleted), onUndo: () => restore.mutate(deleting.id) }
            : undefined,
        }}
        onConfirm={async (choice) => {
          if (!deleting) return;
          await remove.mutateAsync({
            id: deleting.id,
            reason: choice.reason,
            note: choice.note,
          });
        }}
      />
    </section>
  );
}
