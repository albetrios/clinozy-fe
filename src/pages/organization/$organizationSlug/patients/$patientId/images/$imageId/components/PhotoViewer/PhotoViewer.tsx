import { Dialog as DialogPrimitive } from 'radix-ui';
import { type CSSProperties, type KeyboardEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  type PatientPhoto,
  photoName,
} from '@/shared/api/app/patient-images-contracts.ts';
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
import {
  PhotoRoundButton,
  PhotoZoomGroup,
} from '../../../shared/components/PhotoChrome/index.ts';
import { usePhotoZoom } from '../../../shared/hooks/usePhotoZoom/index.ts';
import { PHOTO_VIEWER_TEST_IDS } from './photo-viewer.constants.ts';

const K = PATIENT_PHOTOS_KEYS.viewer;

/** Props of {@link PhotoViewer}. */
export interface PhotoViewerProps {
  photo: PatientPhoto;
  /**
   * Its place among the album's photos under the filter, from 0, and how many the server
   * counts; no index when it is not among the photos read (no "2 of 6", no ‹ ›).
   */
  index: number | null;
  total: number;
  /** "Face · Before · 24 Sep · General". */
  meta: string;
  /** The previous (−1) or next (1) photo. */
  onStep: (step: 1 | -1) => void;
  onClose: () => void;
  /** Photo details — hidden without `patient:update`. */
  onEdit?: () => void;
  /** Delete — hidden without `patient:update`. */
  onDelete?: () => void;
}

/**
 * The photo viewer (KICKOFF §6.6; H:2682–2686; `patient-file.md:317–331`):
 * full screen on `overlay/94`, fading in — the 56px bar (name over "Face ·
 * Before · 24 Sep · General", "2 of 6", the zoom group, Edit details, Delete
 * photo, Close), the photo `min(92%, 1100px) × 92%` from its `file_url`
 * (clinozy-be D86), the 64px hint row. Zoom 100–600% by the buttons, the
 * wheel, a double-click or a pinch; a drag pans once zoomed; ‹ › with more
 * than one photo, and a swipe on touch. Keys ← → + − 0; Esc closes; a click
 * outside does not. A photo whose link is gone or fails shows the image
 * glyph, its file's name and "Preview not available". It keeps the light ramp
 * in dark mode. On a phone the position and the zoom group give way to the
 * pinch, so the name still fits beside Edit, Delete and Close.
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
  const multi = index !== null && total > 1;
  const step = (by: 1 | -1) => {
    if (multi) onStep(by);
  };
  const zoom = usePhotoZoom({ photoIds: [photo.id], onSwipe: step }).of(photo.id);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const rtl = direction === 'rtl';
    const keys: Readonly<Record<string, () => void>> = {
      ArrowLeft: () => step(rtl ? 1 : -1),
      ArrowRight: () => step(rtl ? -1 : 1),
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
            {index === null ? null : (
              <span className="text-disabled flex-none text-xs leading-[normal] tabular-nums max-md:hidden">
                {t(K.position, { index: index + 1, total })}
              </span>
            )}
            <PhotoZoomGroup
              level={zoom.zoom}
              onZoomIn={zoom.zoomIn}
              onZoomOut={zoom.zoomOut}
              onReset={zoom.reset}
              testIds={PHOTO_VIEWER_TEST_IDS}
            />
            {onEdit ? (
              <PhotoRoundButton
                label={t(PATIENT_PHOTOS_KEYS.tile.edit)}
                hint={t(PATIENT_PHOTOS_KEYS.tile.editHint)}
                onClick={onEdit}
                testId={PHOTO_VIEWER_TEST_IDS.edit}
              >
                <PenLine aria-hidden="true" className="size-4" />
              </PhotoRoundButton>
            ) : null}
            {onDelete ? (
              <PhotoRoundButton
                label={t(PATIENT_PHOTOS_KEYS.tile.delete)}
                hint={t(PATIENT_PHOTOS_KEYS.tile.delete)}
                onClick={onDelete}
                danger
                testId={PHOTO_VIEWER_TEST_IDS.delete}
              >
                <Trash aria-hidden="true" className="size-4" />
              </PhotoRoundButton>
            ) : null}
            <PhotoRoundButton
              label={t(K.close)}
              hint={t(K.closeHint)}
              onClick={onClose}
              testId={PHOTO_VIEWER_TEST_IDS.close}
            >
              <X aria-hidden="true" className="size-5" />
            </PhotoRoundButton>
          </div>
          <div className="relative z-0 min-h-0 overflow-hidden">
            {multi ? (
              <PhotoRoundButton
                label={t(K.previous)}
                hint={t(K.previousHint)}
                onClick={() => onStep(-1)}
                testId={PHOTO_VIEWER_TEST_IDS.previous}
                className="absolute start-4 top-1/2 z-2 -translate-y-1/2"
              >
                <ChevronLeft aria-hidden="true" className="size-4.5 rtl:-scale-x-100" />
              </PhotoRoundButton>
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
                  'bg-canvas/8 flex h-[92%] w-[min(92%,68.75rem)] translate-x-(--photo-x) translate-y-(--photo-y) scale-(--photo-zoom) items-center justify-center overflow-hidden rounded-lg will-change-transform',
                  zoom.moving
                    ? 'transition-none'
                    : 'transition-[translate,scale] duration-120 ease-out',
                )}
              >
                <PhotoThumb
                  src={photo.fileUrl}
                  fit="contain"
                  fallback={
                    <span className="text-body flex max-w-full flex-col items-center gap-2 px-6 text-center">
                      <ImageIcon className="size-5.5" />
                      <span className="text-canvas max-w-full truncate font-medium">
                        {photo.fileName}
                      </span>
                      {t(K.missing)}
                    </span>
                  }
                />
              </div>
            </div>
            {multi ? (
              <PhotoRoundButton
                label={t(K.next)}
                hint={t(K.nextHint)}
                onClick={() => onStep(1)}
                testId={PHOTO_VIEWER_TEST_IDS.next}
                className="absolute end-4 top-1/2 z-2 -translate-y-1/2"
              >
                <ChevronRight aria-hidden="true" className="size-4.5 rtl:-scale-x-100" />
              </PhotoRoundButton>
            ) : null}
          </div>
          <div className="text-disabled flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 text-xs leading-[normal]">
            {multi ? <span>{t(K.hints.browse)}</span> : null}
            <span>{t(K.hints.zoom)}</span>
            <span>{t(K.hints.pan)}</span>
            <span>{t(K.hints.close)}</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
