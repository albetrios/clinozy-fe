import { type ReactNode, useState } from 'react';

import { cn } from '@/lib/utils.ts';
import { ImageIcon } from '@/shared/icons/index.ts';

import { isPhotoUrl } from './photo-thumb.ts';

/** Props of {@link PhotoThumb}. */
export interface PhotoThumbProps {
  /** The photo's stored file. */
  fileUrl: string;
  /** `cover` fills a tile (H:829); `contain` shows the whole photo (the viewer, H:2684). */
  fit: 'cover' | 'contain';
  /** What shows without a file, or when it fails to load; the image glyph by default. */
  fallback?: ReactNode;
  className?: string;
}

/**
 * A patient photo, or its stand-in (H:829 `noImg`): the file when there is a
 * URL to show and it loads, else the muted image glyph — a seeded sample or a
 * key the API has not signed yet (REPLACE_WITH_API). Decorative: the control
 * around it names the photo.
 */
export function PhotoThumb({ fileUrl, fit, fallback, className }: PhotoThumbProps) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!isPhotoUrl(fileUrl) || failed === fileUrl) {
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
  return (
    <img
      src={fileUrl}
      alt=""
      draggable={false}
      loading="lazy"
      onError={() => setFailed(fileUrl)}
      className={cn(
        'size-full select-none',
        fit === 'cover' ? 'object-cover' : 'object-contain',
        className,
      )}
    />
  );
}
