import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { type PatientPhoto, photoName } from '@/shared/api/clinic/patient-images-api.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { PenLine, Trash } from '@/shared/icons/index.ts';
import type { PhotoSize } from '@/shared/store/useDevicePrefsStore/index.ts';

import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../shared/patient-photos.constants.ts';
import { PhotoThumb } from '../../shared/components/PhotoThumb/index.ts';
import { PHOTO_BODY_PART_TONES, PHOTO_SIZE_LOOK } from '../../shared/photo-looks.ts';
import type { PhotoDay } from '../../shared/photo-view.ts';
import { PHOTO_GRID_TEST_IDS } from './photo-grid.constants.ts';

const K = PATIENT_PHOTOS_KEYS;

/** Props of {@link PhotoGrid}. */
export interface PhotoGridProps {
  days: readonly PhotoDay[];
  size: PhotoSize;
  /** "24 Sep" / "Today" for a day. */
  dayLabel: (date: string) => string;
  onOpen: (photo: PatientPhoto) => void;
  /** Photo details — hidden without Patients edit. */
  onEdit?: (photo: PatientPhoto) => void;
  /** Delete — hidden without Patients delete. */
  onDelete?: (photo: PatientPhoto) => void;
}

/** One tile's caption: the name over the day, with Edit and Delete at M and L. */
function TileBar({
  photo,
  size,
  date,
  onEdit,
  onDelete,
}: {
  photo: PatientPhoto;
  size: PhotoSize;
  date: string;
  onEdit?: (photo: PatientPhoto) => void;
  onDelete?: (photo: PatientPhoto) => void;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const look = PHOTO_SIZE_LOOK[size];
  const name = photoName(photo);
  const actions = look.actions && (onEdit || onDelete);
  return (
    <div
      data-imgbar=""
      data-surface="light-pinned"
      className={cn(
        // Fades in on hover only where hover exists; always shown on touch (H:414).
        'from-overlay/78 via-overlay/35 text-canvas pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-linear-to-t via-70% to-transparent transition-opacity duration-150 group-focus-within/tile:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/tile:opacity-100',
        look.bar,
      )}
    >
      <span className="pointer-events-auto flex min-w-0 flex-1 flex-col">
        <span
          title={name}
          className={cn('truncate leading-[1.25] font-semibold', look.name)}
        >
          {name}
        </span>
        <span
          className={cn('text-canvas/80 leading-[1.25] whitespace-nowrap', look.date)}
        >
          {date}
        </span>
      </span>
      {actions ? (
        <span className="pointer-events-auto flex flex-none gap-0.5">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(photo)}
              aria-label={t(K.tile.edit)}
              title={t(K.tile.editHint)}
              data-testid={PHOTO_GRID_TEST_IDS.edit}
              className="bg-canvas/14 hover:bg-canvas/28 flex size-6.5 items-center justify-center rounded-md transition-colors"
            >
              <PenLine aria-hidden="true" className="size-3.25" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(photo)}
              aria-label={t(K.tile.delete)}
              title={t(K.tile.delete)}
              data-testid={PHOTO_GRID_TEST_IDS.delete}
              className="bg-canvas/14 hover:bg-destructive flex size-6.5 items-center justify-center rounded-md transition-colors"
            >
              <Trash aria-hidden="true" className="size-3.25" />
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The Photos grid (H:829; `patient-file.md:62–65`): a group per day — "24 Sep"
 * or "Today" (13/600) with "3 photos · 24 Sep · Hydrafacial" (12px) — over
 * `repeat(auto-fill, minmax(<tile>, 1fr))` at the size picked. A tile is a
 * square on a muted fill (10px corners): the photo or its glyph, the body-part
 * pill at the top start, and the caption bar on a dark scrim. A tile opens the
 * viewer.
 */
export function PhotoGrid({
  days,
  size,
  dayLabel,
  onOpen,
  onEdit,
  onDelete,
}: PhotoGridProps) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const look = PHOTO_SIZE_LOOK[size];
  return (
    <div className="flex flex-col gap-3">
      {days.map((day) => {
        const date = dayLabel(day.date);
        const photos = t(K.count, { count: day.photos.length });
        return (
          <section
            key={day.date}
            aria-label={date}
            data-testid={PHOTO_GRID_TEST_IDS.day}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-body leading-[normal] font-semibold whitespace-nowrap">
                {date}
              </h3>
              <span className="text-muted-foreground truncate text-xs leading-[normal]">
                {day.visit
                  ? t(K.groupWithVisit, {
                      photos,
                      visit: t(K.visitFilter.visit, {
                        day: dayLabel(day.visit.date),
                        service: day.visit.serviceLabel,
                      }),
                    })
                  : photos}
              </span>
            </div>
            <ul className={cn('grid', look.grid)}>
              {day.photos.map((photo) => {
                const tone = photo.bodyPart
                  ? PHOTO_BODY_PART_TONES[photo.bodyPart]
                  : null;
                return (
                  <li
                    key={photo.id}
                    data-testid={PHOTO_GRID_TEST_IDS.tile}
                    className="group/tile bg-muted relative aspect-square overflow-hidden rounded-lg border"
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(photo)}
                      aria-label={t(K.tile.open, { name: photoName(photo) })}
                      className="absolute inset-0 size-full cursor-zoom-in"
                    >
                      <PhotoThumb fileUrl={photo.fileUrl} fit="cover" />
                    </button>
                    {photo.bodyPart && tone ? (
                      <span
                        data-slot="pill"
                        className={cn(
                          'text-tiny pointer-events-none absolute start-1.5 top-1.5 inline-flex h-5 items-center rounded-full px-1.75 font-semibold whitespace-nowrap',
                          TONE_CLASSES[tone].surface,
                        )}
                      >
                        {t(K.bodyParts[photo.bodyPart])}
                      </span>
                    ) : null}
                    <TileBar
                      photo={photo}
                      size={size}
                      date={date}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
