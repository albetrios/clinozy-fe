import { Dialog as DialogPrimitive } from 'radix-ui';
import { type CSSProperties, type KeyboardEvent, type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { type PatientPhoto, photoName } from '@/shared/api/clinic/patient-images-api.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  PenLine,
  Trash,
  X,
} from '@/shared/icons/index.ts';

import { PhotoThumb } from '../../../../shared/components/PhotoThumb/index.ts';
import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../../shared/patient-photos.constants.ts';
import { usePhotoZoom } from '../../hooks/usePhotoZoom/index.ts';
import { PHOTO_VIEWER_TEST_IDS } from './photo-viewer.constants.ts';

const K = PATIENT_PHOTOS_KEYS.viewer;

/** Props of {@link PhotoViewer}. */
export interface PhotoViewerProps {
  photo: PatientPhoto;
  /** Its place in the album under the filter, from 0, and how many there are. */
  index: number;
  total: number;
  /** "Face · 24 Sep · General". */
  meta: string;
  /** The previous (−1) or next (1) photo, wrapping. */
  onStep: (step: 1 | -1) => void;
  onClose: () => void;
  /** Photo details — hidden without Patients edit. */
  onEdit?: () => void;
  /** Delete — hidden without Patients delete. */
  onDelete?: () => void;
}

/** A 40px round control on the dark chrome (H:2683–2684). */
function RoundButton({
  label,
  hint,
  onClick,
  danger = false,
  testId,
  className,
  children,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  danger?: boolean;
  testId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={hint}
      data-testid={testId}
      data-slot="pill"
      className={cn(
        'bg-canvas/12 text-canvas flex size-10 flex-none items-center justify-center rounded-full transition-colors',
        danger ? 'hover:bg-destructive' : 'hover:bg-canvas/20',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** The bar's zoom group: − · the level (it resets) · + (H:2683). Hidden on a phone. */
function ZoomGroup({
  level,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  level: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const { formatNumber } = useLocaleFormat();
  return (
    <div
      role="group"
      aria-label={t(K.zoom)}
      className="border-canvas/20 flex h-9.5 flex-none items-center overflow-hidden rounded-lg border max-md:hidden"
    >
      <button
        type="button"
        onClick={onZoomOut}
        aria-label={t(K.zoomOut)}
        title={t(K.zoomOutHint)}
        data-testid={PHOTO_VIEWER_TEST_IDS.zoomOut}
        className="hover:bg-canvas/10 h-full w-9 text-base"
      >
        −
      </button>
      <button
        type="button"
        onClick={onReset}
        title={t(K.zoomReset)}
        data-testid={PHOTO_VIEWER_TEST_IDS.zoomReset}
        className="border-canvas/20 hover:bg-canvas/10 h-full min-w-14 border-x px-2 text-xs font-semibold tabular-nums"
      >
        {formatNumber(level, { style: 'percent', maximumFractionDigits: 0 })}
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        aria-label={t(K.zoomIn)}
        title={t(K.zoomInHint)}
        data-testid={PHOTO_VIEWER_TEST_IDS.zoomIn}
        className="hover:bg-canvas/10 h-full w-9 text-base"
      >
        +
      </button>
    </div>
  );
}

/**
 * The photo viewer (KICKOFF §6.6; H:2682–2686; `patient-file.md:317–331`):
 * full screen on `overlay/94`, fading in — the 56px bar (name over "Face ·
 * 24 Sep · General", "2 of 6", the zoom group, Edit details, Delete photo,
 * Close), the photo `min(92%, 1100px) × 92%`, the 64px hint row. Zoom 100–600%
 * by the buttons, the wheel, a double-click or a pinch; a drag pans once
 * zoomed; ‹ › with more than one photo, and a swipe on touch. Keys ← → + − 0;
 * Esc closes; a click outside does not. It keeps the light ramp in dark mode.
 * On a phone the position and the zoom group give way to the pinch, so the
 * name still fits beside Edit, Delete and Close (the design's bar overflows).
 */
export function PhotoViewer({
  photo,
  index,
  total,
  meta,
  onStep,
  onClose,
  onEdit,
  onDelete,
}: PhotoViewerProps) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const { direction } = useLocaleFormat();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const zoom = usePhotoZoom(photo.id, onStep);
  const multi = total > 1;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const rtl = direction === 'rtl';
    const keys: Readonly<Record<string, () => void>> = {
      ArrowLeft: () => multi && onStep(rtl ? 1 : -1),
      ArrowRight: () => multi && onStep(rtl ? -1 : 1),
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

  const transform = {
    '--photo-x': `${zoom.x}px`,
    '--photo-y': `${zoom.y}px`,
    '--photo-zoom': String(zoom.zoom),
  } as CSSProperties;
  let cursor = 'cursor-zoom-in';
  if (zoom.zoom > 1) cursor = zoom.moving ? 'cursor-grabbing' : 'cursor-grab';

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
          data-testid={PHOTO_VIEWER_TEST_IDS.root}
          data-surface="light-pinned"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current?.focus();
          }}
          // No backdrop close (H:2682): only × and Esc.
          onPointerDownOutside={(event) => event.preventDefault()}
          onKeyDown={onKeyDown}
          className="bg-overlay/94 text-canvas animate-fade fixed inset-0 z-[96] grid grid-rows-[3.5rem_minmax(0,1fr)_4rem] outline-none"
        >
          <div className="bg-overlay/60 relative z-1 flex min-w-0 items-center gap-3 px-4 max-md:pe-14">
            <span className="flex min-w-0 flex-col gap-0.5">
              <DialogPrimitive.Title className="truncate text-sm leading-[normal] font-semibold">
                {photoName(photo)}
              </DialogPrimitive.Title>
              <span className="text-disabled truncate text-xs leading-[normal]">
                {meta}
              </span>
            </span>
            <span className="flex-1" />
            <span className="text-disabled flex-none text-xs leading-[normal] tabular-nums max-md:hidden">
              {t(K.position, { index: index + 1, total })}
            </span>
            <ZoomGroup
              level={zoom.zoom}
              onZoomIn={zoom.zoomIn}
              onZoomOut={zoom.zoomOut}
              onReset={zoom.reset}
            />
            {onEdit ? (
              <RoundButton
                label={t(PATIENT_PHOTOS_KEYS.tile.edit)}
                hint={t(PATIENT_PHOTOS_KEYS.tile.editHint)}
                onClick={onEdit}
                testId={PHOTO_VIEWER_TEST_IDS.edit}
              >
                <PenLine aria-hidden="true" className="size-4" />
              </RoundButton>
            ) : null}
            {onDelete ? (
              <RoundButton
                label={t(PATIENT_PHOTOS_KEYS.tile.delete)}
                hint={t(PATIENT_PHOTOS_KEYS.tile.delete)}
                onClick={onDelete}
                danger
                testId={PHOTO_VIEWER_TEST_IDS.delete}
              >
                <Trash aria-hidden="true" className="size-4" />
              </RoundButton>
            ) : null}
            <RoundButton
              label={t(K.close)}
              hint={t(K.closeHint)}
              onClick={onClose}
              testId={PHOTO_VIEWER_TEST_IDS.close}
            >
              <X aria-hidden="true" className="size-5" />
            </RoundButton>
          </div>
          <div className="relative z-0 min-h-0 overflow-hidden">
            {multi ? (
              <RoundButton
                label={t(K.previous)}
                hint={t(K.previousHint)}
                onClick={() => onStep(-1)}
                testId={PHOTO_VIEWER_TEST_IDS.previous}
                className="absolute start-4 top-1/2 z-2 -translate-y-1/2"
              >
                <ChevronLeft aria-hidden="true" className="size-4.5 rtl:-scale-x-100" />
              </RoundButton>
            ) : null}
            <div
              {...zoom.stage}
              data-testid={PHOTO_VIEWER_TEST_IDS.stage}
              className={cn(
                'absolute inset-0 flex touch-none items-center justify-center select-none',
                cursor,
              )}
            >
              <div
                style={transform}
                className={cn(
                  'bg-canvas/8 text-disabled flex h-[92%] w-[min(92%,68.75rem)] translate-x-(--photo-x) translate-y-(--photo-y) scale-(--photo-zoom) items-center justify-center overflow-hidden rounded-lg will-change-transform',
                  zoom.moving
                    ? 'transition-none'
                    : 'transition-[translate,scale] duration-120 ease-out',
                )}
              >
                <PhotoThumb
                  fileUrl={photo.fileUrl}
                  fit="contain"
                  fallback={
                    <span className="text-body flex flex-col items-center gap-2">
                      <ImageIcon className="size-5.5" />
                      {t(K.missing)}
                    </span>
                  }
                />
              </div>
            </div>
            {multi ? (
              <RoundButton
                label={t(K.next)}
                hint={t(K.nextHint)}
                onClick={() => onStep(1)}
                testId={PHOTO_VIEWER_TEST_IDS.next}
                className="absolute end-4 top-1/2 z-2 -translate-y-1/2"
              >
                <ChevronRight aria-hidden="true" className="size-4.5 rtl:-scale-x-100" />
              </RoundButton>
            ) : null}
          </div>
          <div className="text-disabled flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 text-xs leading-[normal]">
            <span>{t(K.hints.browse)}</span>
            <span>{t(K.hints.zoom)}</span>
            <span>{t(K.hints.pan)}</span>
            <span>{t(K.hints.close)}</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
