import { Dialog as DialogPrimitive } from 'radix-ui';
import { type CSSProperties, type KeyboardEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import {
  type PatientPhoto,
  photoName,
} from '@/shared/api/app/patient-images-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { usePatientPhotosByIds } from '@/shared/hooks/usePatientPhotos/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { type AppIcon, Columns, ImageIcon, LayoutGrid, X } from '@/shared/icons/index.ts';

import { PhotoThumb } from '../../../shared/components/PhotoThumb/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../shared/patient-photos.constants.ts';
import {
  PhotoRoundButton,
  PhotoZoomGroup,
} from '../../shared/components/PhotoChrome/index.ts';
import { type PhotoZoom, usePhotoZoom } from '../../shared/hooks/usePhotoZoom/index.ts';
import {
  compareColumns,
  comparisonOrder,
  daysBetween,
  defaultCompareLayout,
  PHOTO_COMPARE_LAYOUTS,
  type PhotoCompareLayout,
} from '../../shared/photo-compare.ts';
import { PHOTO_BODY_PART_TONES, PHOTO_STAGE_TONES } from '../../shared/photo-looks.ts';
import { PHOTO_COMPARE_TEST_IDS } from './photo-compare.constants.ts';

const K = PATIENT_PHOTOS_KEYS;

/** Props of {@link PhotoCompare}. */
export interface PhotoCompareProps {
  /** The photos the URL names (`?compare=`), two to eight. */
  ids: readonly string[];
  /** "24 Sep" / "Today" for a photo's day. */
  dayLabel: (date: string) => string;
  /** Take a photo out (offered while more than two remain). */
  onRemove: (id: string) => void;
  onClose: () => void;
}

const LAYOUT_LOOK: Readonly<
  Record<PhotoCompareLayout, { icon: AppIcon; label: string }>
> = {
  row: { icon: Columns, label: K.compare.row },
  grid: { icon: LayoutGrid, label: K.compare.grid },
};

/** One row ↔ Grid — two radios on the dark chrome. */
function LayoutSwitch({
  layout,
  onLayoutChange,
}: {
  layout: PhotoCompareLayout;
  onLayoutChange: (layout: PhotoCompareLayout) => void;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  return (
    <div
      role="radiogroup"
      aria-label={t(K.compare.layout)}
      data-testid={PHOTO_COMPARE_TEST_IDS.layout}
      className="border-canvas/20 flex h-9.5 flex-none items-center gap-0.5 rounded-lg border p-0.75 max-md:hidden"
    >
      {PHOTO_COMPARE_LAYOUTS.map((option) => {
        const { icon: Icon, label } = LAYOUT_LOOK[option];
        const checked = option === layout;
        return (
          <button // NOSONAR(S6819): styled-button radiogroup on the dark chrome, like the viewer's zoom group
            key={option}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onLayoutChange(option)}
            data-testid={`${PHOTO_COMPARE_TEST_IDS.layout}-${option}`}
            className={cn(
              'flex h-full items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors',
              checked ? 'bg-canvas text-foreground' : 'text-canvas/80 hover:bg-canvas/10',
            )}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {t(label)}
          </button>
        );
      })}
    </div>
  );
}

/** A pill on a panel's caption, in a tone. */
function PanelPill({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span
      data-slot="pill"
      className={cn(
        // A narrow panel (a phone, eight in one row) keeps its room for the name and the days.
        'text-tiny hidden h-5 flex-none items-center rounded-full px-1.75 font-semibold whitespace-nowrap @min-[17rem]:inline-flex',
        TONE_CLASSES[tone].surface,
      )}
    >
      {children}
    </span>
  );
}

/**
 * One photo of the comparison: its stage (the shared zoom and pan), the place
 * and day at the top start, × at the top end, and the caption — the name, the
 * body part and stage, and "Start" or "+21 days" from the first photo.
 */
function ComparePanel({
  photo,
  index,
  first,
  zoom,
  dayLabel,
  onRemove,
}: {
  photo: PatientPhoto;
  index: number;
  /** The first photo's day — the panel counts from it. */
  first: string;
  zoom: PhotoZoom;
  dayLabel: (date: string) => string;
  onRemove: ((id: string) => void) | null;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const name = photoName(photo);
  const days = daysBetween(first, photo.takenOn);
  const transform = {
    '--photo-x': `${zoom.x}px`,
    '--photo-y': `${zoom.y}px`,
    '--photo-zoom': String(zoom.zoom),
  } as CSSProperties;
  let cursor = 'cursor-zoom-in';
  if (zoom.zoom > 1) cursor = zoom.moving ? 'cursor-grabbing' : 'cursor-grab';
  return (
    <figure
      data-testid={PHOTO_COMPARE_TEST_IDS.panel}
      data-photo={photo.id}
      className="bg-overlay border-canvas/12 @container relative m-0 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border"
    >
      <div
        {...zoom.stage}
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden select-none',
          cursor,
        )}
      >
        <div
          style={transform}
          className={cn(
            'size-full translate-x-(--photo-x) translate-y-(--photo-y) scale-(--photo-zoom) will-change-transform',
            zoom.moving
              ? 'transition-none'
              : 'transition-[translate,scale] duration-120 ease-out',
          )}
        >
          <PhotoThumb
            src={photo.fileUrl}
            fit="contain"
            fallback={
              <span className="text-body flex flex-col items-center gap-2 px-4 text-center">
                <ImageIcon className="size-5.5" />
                {t(K.viewer.missing)}
              </span>
            }
          />
        </div>
        <span
          data-slot="pill"
          className="bg-overlay/70 text-canvas pointer-events-none absolute start-2 top-2 flex h-6 items-center gap-1.5 rounded-full ps-1 pe-2.5 text-xs font-semibold backdrop-blur-sm"
        >
          <span
            data-slot="pill"
            className="bg-canvas text-foreground flex size-4.5 items-center justify-center rounded-full text-[0.6875rem] tabular-nums"
          >
            {index + 1}
          </span>
          {dayLabel(photo.takenOn)}
        </span>
        {onRemove ? (
          <button
            type="button"
            onClick={() => onRemove(photo.id)}
            aria-label={t(K.compare.remove, { name })}
            title={t(K.compare.remove, { name })}
            data-testid={PHOTO_COMPARE_TEST_IDS.remove}
            data-slot="pill"
            className="bg-overlay/70 text-canvas hover:bg-destructive absolute end-2 top-2 flex size-7 items-center justify-center rounded-full backdrop-blur-sm transition-colors"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </div>
      <figcaption className="border-canvas/12 flex min-w-0 items-center gap-1.5 border-t px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={name}>
          {name}
        </span>
        {photo.bodyPart ? (
          <PanelPill tone={PHOTO_BODY_PART_TONES[photo.bodyPart]}>
            {t(K.bodyParts[photo.bodyPart])}
          </PanelPill>
        ) : null}
        {photo.stage ? (
          <PanelPill tone={PHOTO_STAGE_TONES[photo.stage]}>
            {t(K.stages[photo.stage])}
          </PanelPill>
        ) : null}
        <span
          data-testid={PHOTO_COMPARE_TEST_IDS.since}
          className="text-canvas/75 flex-none text-xs font-semibold whitespace-nowrap tabular-nums"
        >
          {index === 0 ? t(K.compare.start) : t(K.compare.since, { count: days })}
        </span>
      </figcaption>
    </figure>
  );
}

/** A panel's place while its photo is read: the dark tile, breathing. */
function PendingPanel() {
  return (
    <div
      aria-hidden="true"
      data-testid={PHOTO_COMPARE_TEST_IDS.pending}
      className="bg-canvas/8 animate-pulse rounded-xl"
    />
  );
}

/**
 * The photo comparison (change-patient-overview-photos `BRIEF.md:37–46`;
 * `?compare=` on the Photos URL, D11): full screen on the viewer's dark chrome —
 * the bar ("Compare photos", "4 photos · 23 Jul – 15 Oct", One row ↔ Grid, the
 * zoom group, Close), the photos side by side oldest first (D13) and the hint
 * row (from `md`; a phone pinches). A panel narrower than 17rem drops its pills. **One zoom for every panel** (the viewer's `usePhotoZoom`, D12): the
 * wheel, the buttons, a double-click, a pinch or a drag on any panel moves them
 * all, so one spot is compared across visits. One row up to four photos, a grid
 * from five; a phone shows two columns. × takes a photo out while more than two
 * remain; Esc closes; a click outside does not. Each photo is read by its id
 * (the viewer's read — a list page stands in while it runs).
 */
export function PhotoCompare({ ids, dayLabel, onRemove, onClose }: PhotoCompareProps) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const { patientId } = usePatientFileContext();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const narrow = useViewportTier() === 'phone';
  const read = usePatientPhotosByIds(patientId, ids);
  const photos = comparisonOrder(read.photos);
  const count = photos.length + read.pending.length;
  const [layout, setLayout] = useState<PhotoCompareLayout>(() =>
    defaultCompareLayout(ids.length),
  );
  const zoom = usePhotoZoom(ids.join(','), () => undefined);
  const columns = compareColumns({ count, layout, narrow });
  const first = photos[0];
  const last = photos.at(-1);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const keys: Readonly<Record<string, () => void>> = {
      '+': zoom.zoomIn,
      '=': zoom.zoomIn,
      '-': zoom.zoomOut,
      '0': zoom.reset,
    };
    const run = keys[event.key];
    if (!run) return;
    event.preventDefault();
    run();
  };

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          ref={contentRef}
          aria-describedby={undefined}
          data-testid={PHOTO_COMPARE_TEST_IDS.root}
          data-surface="light-pinned"
          data-layout={layout}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current?.focus();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onKeyDown={onKeyDown}
          className="bg-overlay/98 text-canvas animate-fade fixed inset-0 z-[96] grid grid-rows-[3.5rem_minmax(0,1fr)] outline-none md:grid-rows-[3.5rem_minmax(0,1fr)_3rem]"
        >
          <div className="bg-overlay/60 flex min-w-0 items-center gap-3 px-4">
            <span className="flex min-w-0 flex-col gap-0.5">
              <DialogPrimitive.Title className="truncate text-sm leading-[normal] font-semibold">
                {t(K.compare.title)}
              </DialogPrimitive.Title>
              <span className="text-disabled truncate text-xs leading-[normal]">
                {t(K.count, { count })}
                {first && last && first.takenOn !== last.takenOn
                  ? ` · ${dayLabel(first.takenOn)} – ${dayLabel(last.takenOn)}`
                  : null}
              </span>
            </span>
            <span className="flex-1" />
            {count > 2 ? (
              <LayoutSwitch layout={layout} onLayoutChange={setLayout} />
            ) : null}
            <PhotoZoomGroup
              level={zoom.zoom}
              onZoomIn={zoom.zoomIn}
              onZoomOut={zoom.zoomOut}
              onReset={zoom.reset}
              testIds={PHOTO_COMPARE_TEST_IDS}
            />
            <PhotoRoundButton
              label={t(K.compare.close)}
              hint={t(K.viewer.closeHint)}
              onClick={onClose}
              testId={PHOTO_COMPARE_TEST_IDS.close}
            >
              <X aria-hidden="true" className="size-5" />
            </PhotoRoundButton>
          </div>
          <div className="min-h-0 p-2 md:p-4">
            <div
              data-testid={PHOTO_COMPARE_TEST_IDS.stage}
              data-columns={columns}
              style={{ '--compare-columns': String(columns) } as CSSProperties}
              className="grid h-full auto-rows-[minmax(0,1fr)] grid-cols-[repeat(var(--compare-columns),minmax(0,1fr))] gap-2 md:gap-3"
            >
              {photos.map((photo, index) => (
                <ComparePanel
                  key={photo.id}
                  photo={photo}
                  index={index}
                  first={photos[0]?.takenOn ?? photo.takenOn}
                  zoom={zoom}
                  dayLabel={dayLabel}
                  onRemove={count > 2 ? onRemove : null}
                />
              ))}
              {read.pending.map((id) => (
                <PendingPanel key={id} />
              ))}
            </div>
          </div>
          {/* A phone pinches and drags without being told; the row would wrap. */}
          <div className="text-disabled flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 text-xs leading-[normal] max-md:hidden">
            <span>{t(K.compare.hints.zoom)}</span>
            <span>{t(K.compare.hints.pan)}</span>
            <span>{t(K.viewer.hints.close)}</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
