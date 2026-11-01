import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import {
  type PatientPhoto,
  photoName,
} from '@/shared/api/app/patient-images-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { Check, PenLine, Trash } from '@/shared/icons/index.ts';
import type { PhotoSize } from '@/shared/store/useDevicePrefsStore/index.ts';

import { PhotoThumb } from '../../../shared/components/PhotoThumb/index.ts';
import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../shared/patient-photos.constants.ts';
import {
  PHOTO_BODY_PART_TONES,
  PHOTO_SIZE_LOOK,
  PHOTO_STAGE_TONES,
} from '../../shared/photo-looks.ts';
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
  /** Photo details — hidden without `patient:update`. */
  onEdit?: (photo: PatientPhoto) => void;
  /** Delete — hidden without `patient:update`. */
  onDelete?: (photo: PatientPhoto) => void;
  /** Picking photos to compare; none — the grid only opens them. */
  selection?: PhotoGridSelection;
}

/** The grid's part in the selection (change-patient-overview-photos `BRIEF.md:32–36`). */
export interface PhotoGridSelection {
  /** Selecting: a tap picks the photo instead of opening it. */
  active: boolean;
  ids: ReadonlySet<string>;
  /** Eight picked: the rest dim their check. */
  full: boolean;
  onToggle: (photo: PatientPhoto) => void;
}

/** A tile's pill at the top start: the body part or the stage, in its tone. */
function TilePill({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span
      data-slot="pill"
      className={cn(
        'text-tiny inline-flex h-5 items-center rounded-full px-1.75 font-semibold whitespace-nowrap',
        TONE_CLASSES[tone].surface,
      )}
    >
      {children}
    </span>
  );
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
        'from-overlay/78 via-overlay/35 text-canvas pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-linear-to-t via-70% to-transparent',
        // Over the photo it fades in on hover where hover exists, always shown on touch
        // (H:414); with no image to uncover (its upload is gone) the name and day are the tile.
        photo.thumbnailUrl &&
          'transition-opacity duration-150 group-focus-within/tile:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/tile:opacity-100',
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
 * A tile's check circle at the top end (24px): it picks the photo with one
 * tap. Where hover exists it shows on hover, and always while selecting or on
 * a touch screen — filled with the primary and a tick once picked. It is the
 * pointer's shortcut only: out of the tab order and hidden from assistive
 * tech, so a keyboard and a screen reader pick through "Select" and the tile
 * itself — never a second "Select …".
 */
function TileCheck({
  photo,
  selection,
}: {
  photo: PatientPhoto;
  selection: PhotoGridSelection;
}) {
  const picked = selection.ids.has(photo.id);
  return (
    <button
      type="button"
      onClick={() => selection.onToggle(photo)}
      aria-hidden="true"
      tabIndex={-1}
      data-picked={picked || undefined}
      data-testid={PHOTO_GRID_TEST_IDS.check}
      data-slot="pill"
      className={cn(
        'absolute end-1.5 top-1.5 z-1 flex size-6 items-center justify-center rounded-full border-2 transition-[opacity,background-color,border-color]',
        picked
          ? 'bg-primary border-primary text-primary-foreground'
          : 'border-canvas bg-overlay/35',
        !picked && selection.full && 'opacity-50',
        !selection.active &&
          '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/tile:opacity-100',
      )}
    >
      {picked ? <Check className="size-3.5" strokeWidth={3} /> : null}
    </button>
  );
}

/** A tile's body-part and stage pills at the top start, clear of the check circle. */
function TilePills({ photo }: { photo: PatientPhoto }) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  if (photo.bodyPart === null && photo.stage === null) return null;
  return (
    <span className="pointer-events-none absolute start-1.5 end-8 top-1.5 flex flex-wrap gap-1">
      {photo.bodyPart ? (
        <TilePill tone={PHOTO_BODY_PART_TONES[photo.bodyPart]}>
          {t(K.bodyParts[photo.bodyPart])}
        </TilePill>
      ) : null}
      {photo.stage ? (
        <TilePill tone={PHOTO_STAGE_TONES[photo.stage]}>
          {t(K.stages[photo.stage])}
        </TilePill>
      ) : null}
    </span>
  );
}

/** One tile: the photo (it opens, or picks while selecting), its pills, its check, its caption. */
function PhotoTile({
  photo,
  size,
  date,
  onOpen,
  onEdit,
  onDelete,
  selection,
}: {
  photo: PatientPhoto;
  size: PhotoSize;
  date: string;
  onOpen: (photo: PatientPhoto) => void;
  onEdit?: (photo: PatientPhoto) => void;
  onDelete?: (photo: PatientPhoto) => void;
  selection?: PhotoGridSelection;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const look = PHOTO_SIZE_LOOK[size];
  const selecting = selection?.active ?? false;
  const picked = selection?.ids.has(photo.id) ?? false;
  const name = photoName(photo);
  return (
    <li
      data-testid={PHOTO_GRID_TEST_IDS.tile}
      data-picked={picked || undefined}
      className={cn(
        'group/tile bg-muted relative aspect-square flex-none overflow-hidden rounded-lg border transition-shadow',
        look.tile,
        picked && 'ring-primary ring-offset-card ring-2 ring-offset-2',
      )}
    >
      <button
        type="button"
        onClick={() =>
          selecting && selection ? selection.onToggle(photo) : onOpen(photo)
        }
        aria-label={selecting ? t(K.select.toggle, { name }) : t(K.tile.open, { name })}
        aria-pressed={selecting ? picked : undefined}
        className="absolute inset-0 size-full"
      >
        <PhotoThumb src={photo.thumbnailUrl} />
      </button>
      <TilePills photo={photo} />
      {selection ? <TileCheck photo={photo} selection={selection} /> : null}
      <TileBar
        photo={photo}
        size={size}
        date={date}
        onEdit={selecting ? undefined : onEdit}
        onDelete={selecting ? undefined : onDelete}
      />
    </li>
  );
}

/**
 * The Photos grid (H:829; `patient-file.md:62–65`): a group per day — "24 Sep"
 * or "Today" (13/600) with its visit's service (12px) — over its tiles at the
 * size picked. The groups flow side by side and wrap, each only as wide as its
 * photos (change-patient-overview-photos `BRIEF.md:30–31`), so a run of
 * single-photo visits sits in one row; the day's heading never widens its
 * group. A tile is a square on a muted fill (10px corners): the photo from its
 * `thumbnail_url` (its 320 px thumbnail, else the full photo — clinozy-be D86; the image glyph when its upload is gone), the
 * body-part and stage pills at the top start, the check circle at the top end,
 * and the caption bar — the name over the day — on a dark scrim, fading in on
 * hover over a photo. A tile opens the viewer; while selecting it is picked
 * instead, with a ring and a filled check, and Edit and Delete step aside. The
 * design's "3 photos · …" per day goes: a day can run across pages, and the API
 * counts by album only.
 */
export function PhotoGrid({
  days,
  size,
  dayLabel,
  onOpen,
  onEdit,
  onDelete,
  selection,
}: PhotoGridProps) {
  const look = PHOTO_SIZE_LOOK[size];
  return (
    <div
      data-selecting={selection?.active || undefined}
      className="flex flex-wrap items-start gap-x-4 gap-y-3"
    >
      {days.map((day) => {
        const date = dayLabel(day.date);
        return (
          <section
            key={day.date}
            aria-label={date}
            data-testid={PHOTO_GRID_TEST_IDS.day}
            className="flex max-w-full min-w-0 flex-col gap-2"
          >
            {/* No intrinsic width: the tiles set the group's, the heading truncates in it. */}
            <div className="flex w-0 min-w-full items-center gap-2">
              <h3 className="text-body leading-[normal] font-semibold whitespace-nowrap">
                {date}
              </h3>
              {day.serviceLabel ? (
                <span className="text-muted-foreground min-w-0 truncate text-xs leading-[normal]">
                  {day.serviceLabel}
                </span>
              ) : null}
            </div>
            <ul className={cn('flex flex-wrap', look.row)}>
              {day.photos.map((photo) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  size={size}
                  date={date}
                  onOpen={onOpen}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  selection={selection}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
