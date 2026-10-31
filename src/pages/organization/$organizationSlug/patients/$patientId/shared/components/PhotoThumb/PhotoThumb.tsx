import { type ReactNode, useState } from 'react';

import { cn } from '@/lib/utils.ts';
import { ImageIcon } from '@/shared/icons/index.ts';

/** Props of {@link PhotoThumb}. */
export interface PhotoThumbProps {
  /** The photo's grid link (`thumbnail_url`, else `file_url` — D86); without one — or when it fails to load — the fallback shows. */
  src?: string | null;
  /** `cover` fills a square tile; `contain` shows the whole photo (the viewer's stage). */
  fit?: 'cover' | 'contain';
  /** What shows in the photo's place; the image glyph by default. */
  fallback?: ReactNode;
  className?: string;
}

/**
 * A patient photo (H:829): its pixels from the read's `thumbnail_url` (clinozy-be D86 — the 320 px thumbnail, else the full photo), loaded lazily,
 * else — no link (the upload is gone) or one that fails to load — the muted image glyph centred
 * in the tile or the viewer's stage. A new link (the next read's) tries again. Decorative: the
 * control around it names the photo.
 */
export function PhotoThumb({ src, fit = 'cover', fallback, className }: PhotoThumbProps) {
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(src)}
        data-slot="photo-thumb-image"
        className={cn(
          'size-full',
          fit === 'cover' ? 'object-cover' : 'object-contain',
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'text-disabled flex size-full items-center justify-center',
        className,
      )}
    >
      {fallback ?? <ImageIcon className="size-5.5" />}
    </span>
  );
}
