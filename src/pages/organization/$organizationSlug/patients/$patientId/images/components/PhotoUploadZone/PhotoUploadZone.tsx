import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { EmptyStateArt } from '@/shared/components/EmptyState/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Camera, ImagePlus } from '@/shared/icons/index.ts';

import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../shared/patient-photos.constants.ts';
import { PHOTO_UPLOAD_ZONE_TEST_IDS } from './photo-upload-zone.constants.ts';

const K = PATIENT_PHOTOS_KEYS;

/** Props of {@link PhotoUploadZone}. */
export interface PhotoUploadZoneProps {
  /** `strip` above the grid; `empty` — the empty album, the zone the whole section. */
  variant: 'strip' | 'empty';
  /** The album on screen, named: "General". */
  album: string;
  /** "Choose photos" — the file picker. */
  onChoose: () => void;
  /** "Take photo" — the camera, offered on a touch device only. */
  onCamera: () => void;
}

/** "Take photo" (below `md` — a phone, a tablet held upright) and "Choose photos". */
function ZoneButtons({
  onChoose,
  onCamera,
  primary,
}: {
  onChoose: () => void;
  onCamera: () => void;
  primary: boolean;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  return (
    <span className="flex flex-none flex-wrap items-center justify-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={onCamera}
        data-testid={PHOTO_UPLOAD_ZONE_TEST_IDS.camera}
        className="bg-card gap-1.5 shadow-none md:hidden"
      >
        <Camera aria-hidden="true" className="size-4" />
        {t(K.dropzone.camera)}
      </Button>
      <Button
        type="button"
        variant={primary ? 'default' : 'outline'}
        onClick={onChoose}
        data-testid={PHOTO_UPLOAD_ZONE_TEST_IDS.choose}
        className={cn('gap-1.5', !primary && 'bg-card shadow-none')}
      >
        <ImagePlus aria-hidden="true" className="size-4" />
        {t(K.dropzone.choose)}
      </Button>
    </span>
  );
}

/**
 * The Photos section's upload, always in view for a member who uploads
 * (change-patient-overview-photos `BRIEF.md:23–29`): the **strip** above the
 * grid — the blush tile, "Drop photos here", "or paste a copied image · JPG or
 * PNG up to 10 MB · Adds to General", "Take photo" below `md` and
 * "Choose photos" — and, for an empty album, the **empty** zone: the Photos art,
 * "No photos in General yet", the same line and the buttons, centred in a dashed
 * frame. The section itself takes the drop and the paste; this says so.
 */
export function PhotoUploadZone({
  variant,
  album,
  onChoose,
  onCamera,
}: PhotoUploadZoneProps) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const line = `${t(K.dropzone.body)} · ${t(K.dropzone.target, { album })}`;
  if (variant === 'empty') {
    return (
      <section
        aria-label={t(K.empty.title, { album })}
        data-testid={PHOTO_UPLOAD_ZONE_TEST_IDS.empty}
        className="border-border-strong flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center"
      >
        <EmptyStateArt tone="blush" icon={<Camera />} size="room" />
        <h3 className="text-foreground text-base font-semibold text-balance">
          {t(K.empty.title, { album })}
        </h3>
        <p className="text-muted-foreground max-w-90 text-sm text-pretty">
          {t(K.dropzone.title)} · {line}
        </p>
        <ZoneButtons onChoose={onChoose} onCamera={onCamera} primary />
      </section>
    );
  }
  return (
    <section
      aria-label={t(K.dropzone.title)}
      data-testid={PHOTO_UPLOAD_ZONE_TEST_IDS.strip}
      data-slot="card"
      className="border-border-strong bg-card flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-3.5 py-3"
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-9 flex-none items-center justify-center rounded-lg',
          TONE_CLASSES.blush.surface,
        )}
      >
        <ImagePlus className="size-4.5" />
      </span>
      <span className="flex min-w-40 flex-1 flex-col gap-0.5">
        <span className="text-body font-semibold">{t(K.dropzone.title)}</span>
        <span className="text-muted-foreground text-xs text-pretty">{line}</span>
      </span>
      <ZoneButtons onChoose={onChoose} onCamera={onCamera} primary={false} />
    </section>
  );
}
