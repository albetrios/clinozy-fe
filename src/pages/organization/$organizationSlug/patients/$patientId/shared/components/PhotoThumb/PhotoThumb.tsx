import type { ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';
import { ImageIcon } from '@/shared/icons/index.ts';

/** Props of {@link PhotoThumb}. */
export interface PhotoThumbProps {
  /** What shows in the photo's place; the image glyph by default. */
  fallback?: ReactNode;
  className?: string;
}

/**
 * A patient photo's place (H:829 `noImg`): the muted image glyph, centred in the tile or the
 * viewer's stage. B1 (Q4): clinozy-be has no URL for a stored `file_key`, so no photo's pixels
 * can show — the tile and the viewer name the photo instead. Decorative: the control around it
 * names the photo.
 */
export function PhotoThumb({ fallback, className }: PhotoThumbProps) {
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
