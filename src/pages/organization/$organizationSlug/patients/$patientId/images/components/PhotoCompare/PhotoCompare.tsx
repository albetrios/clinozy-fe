import { Dialog as DialogPrimitive } from 'radix-ui';
import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
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
import {
  type AppIcon,
  Columns,
  ImageIcon,
  LayoutGrid,
  LinkIcon,
  Unlink,
  X,
} from '@/shared/icons/index.ts';
import {
  type PhotoCompareLayout,
  type PhotoCompareZoom,
  useDevicePrefsStore,
} from '@/shared/store/useDevicePrefsStore/index.ts';

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
  PHOTO_COMPARE_ZOOMS,
  photoCompareKey,
} from '../../shared/photo-compare.ts';
import { PHOTO_BODY_PART_TONES, PHOTO_STAGE_TONES } from '../../shared/photo-looks.ts';
import {
  PHOTO_COMPARE_PANEL_ZOOM_TEST_IDS,
  PHOTO_COMPARE_TEST_IDS,
} from './photo-compare.constants.ts';

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

/** A radio on the comparison's bar: its icon, its name and, for a mode, what it does. */
interface CompareOption<T extends string> {
  value: T;
  icon: AppIcon;
  label: string;
  hint?: string;
}

const LAYOUT_OPTIONS: readonly CompareOption<PhotoCompareLayout>[] =
  PHOTO_COMPARE_LAYOUTS.map((value) =>
    value === 'row'
      ? { value, icon: Columns, label: K.compare.row }
      : { value, icon: LayoutGrid, label: K.compare.grid },
  );

const ZOOM_OPTIONS: readonly CompareOption<PhotoCompareZoom>[] = PHOTO_COMPARE_ZOOMS.map(
  (value) =>
    value === 'linked'
      ? { value, icon: LinkIcon, label: K.compare.linked, hint: K.compare.linkedHint }
      : { value, icon: Unlink, label: K.compare.separate, hint: K.compare.separateHint },
);

/**
 * Two radios on the dark chrome — One row ↔ Grid, Linked ↔ Separate. `iconsOnPhone`
 * keeps only the icons below `md`; each radio keeps its name for a screen reader.
 */
function CompareRadios<T extends string>({
  label,
  testId,
  value,
  options,
  onChange,
  iconsOnPhone = false,
  className,
}: {
  label: string;
  testId: string;
  value: T;
  options: readonly CompareOption<T>[];
  onChange: (value: T) => void;
  iconsOnPhone?: boolean;
  className?: string;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  return (
    <div
      role="radiogroup"
      aria-label={t(label)}
      data-testid={testId}
      className={cn(
        'border-canvas/20 flex h-9.5 flex-none items-center gap-0.5 rounded-lg border p-0.75',
        className,
      )}
    >
      {options.map((option) => {
        const { icon: Icon } = option;
        const checked = option.value === value;
        return (
          <button // NOSONAR(S6819): styled-button radiogroup on the dark chrome, like the viewer's zoom group
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            title={option.hint ? t(option.hint) : undefined}
            onClick={() => onChange(option.value)}
            data-testid={`${testId}-${option.value}`}
            className={cn(
              'flex h-full items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors',
              checked ? 'bg-canvas text-foreground' : 'text-canvas/80 hover:bg-canvas/10',
            )}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            <span className={iconsOnPhone ? 'max-md:sr-only' : undefined}>
              {t(option.label)}
            </span>
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
 * One photo of the comparison: its stage (its zoom and pan — every photo's when
 * Linked), the place and day at the top start, × at the top end, its own zoom
 * group at the bottom end when Separate, and the caption — the name, the body
 * part and stage, and "Start" or "+21 days" from the first photo.
 */
function ComparePanel({
  photo,
  index,
  first,
  zoom,
  separate,
  dayLabel,
  onRemove,
}: {
  photo: PatientPhoto;
  index: number;
  /** The first photo's day — the panel counts from it. */
  first: string;
  zoom: PhotoZoom;
  /** Separate: the panel carries its own zoom group. */
  separate: boolean;
  dayLabel: (date: string) => string;
  onRemove: ((id: string) => void) | null;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const name = photoName(photo);
  const days = daysBetween(first, photo.takenOn);
  // The pan is a share of the panel (D10): a percentage of the full-size box it moves.
  const transform = {
    '--photo-x': `${zoom.x * 100}%`,
    '--photo-y': `${zoom.y * 100}%`,
    '--photo-zoom': String(zoom.zoom),
  } as CSSProperties;
  let cursor = 'cursor-zoom-in';
  if (zoom.zoom > 1) cursor = zoom.moving ? 'cursor-grabbing' : 'cursor-grab';
  return (
    <figure
      data-testid={PHOTO_COMPARE_TEST_IDS.panel}
      data-photo={photo.id}
      className="bg-overlay/94 border-canvas/20 @container relative m-0 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border"
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
          className="bg-overlay/60 text-canvas pointer-events-none absolute start-2 top-2 flex h-6 items-center gap-1.5 rounded-full ps-1 pe-2.5 text-xs font-semibold backdrop-blur-sm"
        >
          <span
            data-slot="pill"
            className="bg-canvas text-foreground text-tiny flex size-4.5 items-center justify-center rounded-full tabular-nums"
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
            className="bg-overlay/60 text-canvas hover:bg-destructive absolute end-2 top-2 flex size-7 items-center justify-center rounded-full backdrop-blur-sm transition-colors"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
        {separate ? (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-2">
            <div className="pointer-events-auto">
              <PhotoZoomGroup
                variant="panel"
                label={t(K.compare.zoomOf, { name })}
                level={zoom.zoom}
                onZoomIn={zoom.zoomIn}
                onZoomOut={zoom.zoomOut}
                onReset={zoom.reset}
                testIds={PHOTO_COMPARE_PANEL_ZOOM_TEST_IDS}
              />
            </div>
          </div>
        ) : null}
      </div>
      <figcaption className="border-canvas/20 flex min-w-0 items-center gap-1.5 border-t px-3 py-2">
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
          className="text-canvas/80 flex-none text-xs font-semibold whitespace-nowrap tabular-nums"
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

/** Separate's "Reset all": every photo back to 100%, idle while none has moved. */
function ResetAllButton({
  disabled,
  onReset,
}: {
  disabled: boolean;
  onReset: () => void;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  return (
    <button
      type="button"
      onClick={onReset}
      disabled={disabled}
      title={t(K.compare.resetAllHint)}
      data-testid={PHOTO_COMPARE_TEST_IDS.resetAll}
      className="border-canvas/20 hover:bg-canvas/10 flex h-9.5 flex-none items-center rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40"
    >
      {t(K.compare.resetAll)}
    </button>
  );
}

/**
 * The photo comparison (change-patient-overview-photos `BRIEF.md:37–46`;
 * `?compare=` on the Photos URL, D11): full screen on the viewer's dark chrome —
 * the bar ("Compare photos", "4 photos · 23 Jul – 15 Oct", Linked ↔ Separate,
 * One row ↔ Grid, the zoom group or Reset all, Close), the photos side by side
 * oldest first (D13) and the hint row (from `md`; a phone pinches). A panel
 * narrower than 17rem drops its pills. One row up to four photos, a grid from
 * five; a phone shows two columns. × takes a photo out while more than two
 * remain; Esc closes; a click outside does not. Each photo is read by its id
 * (the viewer's read — a list page stands in while it runs).
 *
 * The zoom (change-photo-compare-zoom): **Linked** — a wheel, a pinch, a drag or
 * the bar's buttons move every photo by the same step from where it stands
 * (D6); **Separate** — a gesture moves the photo under it, each panel has its
 * own zoom group and the bar offers Reset all (D7); + − 0 act on every photo in
 * both. The mode, the layout the user picked and where each photo of this
 * comparison stands are remembered on the device (`useDevicePrefsStore`, D8–D9);
 * the pan is a share of the panel, so it holds across layouts (D10).
 */
export function PhotoCompare({ ids, dayLabel, onRemove, onClose }: PhotoCompareProps) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const { patientId } = usePatientFileContext();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const narrow = useViewportTier() === 'phone';
  const read = usePatientPhotosByIds(patientId, ids);
  const photos = comparisonOrder(read.photos);
  const count = photos.length + read.pending.length;
  const mode = useDevicePrefsStore((state) => state.photoCompareZoom);
  const setMode = useDevicePrefsStore((state) => state.setPhotoCompareZoom);
  const pickedLayout = useDevicePrefsStore((state) => state.photoCompareLayout);
  const setLayout = useDevicePrefsStore((state) => state.setPhotoCompareLayout);
  const remember = useDevicePrefsStore((state) => state.rememberPhotoCompare);
  const key = photoCompareKey(ids);
  const [remembered] = useState(
    () => useDevicePrefsStore.getState().photoCompareFramings[key],
  );
  const zoom = usePhotoZoom({
    photoIds: ids,
    linked: mode === 'linked',
    initial: remembered,
    pan: 'fraction',
  });
  const { framings, moving } = zoom;
  // Remember where the photos stand once they come to rest — never mid-drag.
  useEffect(() => {
    if (!moving) remember(key, framings);
  }, [key, framings, moving, remember]);
  const layout = pickedLayout ?? defaultCompareLayout(count);
  const columns = compareColumns({ count, layout, narrow });
  const separate = mode === 'separate';
  const first = photos[0];
  const last = photos.at(-1);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const keys: Readonly<Record<string, () => void>> = {
      '+': zoom.all.zoomIn,
      '=': zoom.all.zoomIn,
      '-': zoom.all.zoomOut,
      '0': zoom.all.reset,
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
          data-zoom={mode}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current?.focus();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onKeyDown={onKeyDown}
          className="bg-overlay/94 text-canvas animate-fade fixed inset-0 z-[96] grid grid-rows-[3.5rem_minmax(0,1fr)] outline-none md:grid-rows-[3.5rem_minmax(0,1fr)_3rem]"
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
            <CompareRadios
              label={K.compare.zoomMode}
              testId={PHOTO_COMPARE_TEST_IDS.zoomMode}
              value={mode}
              options={ZOOM_OPTIONS}
              onChange={setMode}
              iconsOnPhone
            />
            {count > 2 ? (
              <CompareRadios
                label={K.compare.layout}
                testId={PHOTO_COMPARE_TEST_IDS.layout}
                value={layout}
                options={LAYOUT_OPTIONS}
                onChange={setLayout}
                className="max-md:hidden"
              />
            ) : null}
            {separate ? (
              <ResetAllButton
                disabled={Object.keys(framings).length === 0}
                onReset={zoom.all.reset}
              />
            ) : (
              <PhotoZoomGroup
                level={zoom.of(first?.id ?? '').zoom}
                onZoomIn={zoom.all.zoomIn}
                onZoomOut={zoom.all.zoomOut}
                onReset={zoom.all.reset}
                testIds={PHOTO_COMPARE_TEST_IDS}
              />
            )}
            <PhotoRoundButton
              label={t(K.compare.close)}
              hint={t(K.viewer.closeHint)}
              onClick={onClose}
              testId={PHOTO_COMPARE_TEST_IDS.close}
            >
              <X aria-hidden="true" className="size-5" />
            </PhotoRoundButton>
          </div>
          <div className="min-h-0 p-3">
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
                  zoom={zoom.of(photo.id)}
                  separate={separate}
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
            <span>{t(separate ? K.compare.hints.zoomEach : K.compare.hints.zoom)}</span>
            <span>{t(separate ? K.compare.hints.panEach : K.compare.hints.pan)}</span>
            <span>{t(K.viewer.hints.close)}</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
