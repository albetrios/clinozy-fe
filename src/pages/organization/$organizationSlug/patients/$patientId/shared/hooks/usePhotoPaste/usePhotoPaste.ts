import { useEffect, useRef } from 'react';

import { isEditableTarget } from '@/lib/editable-focus.ts';

/** An open dialog, drawer, sheet or popover — a paste there is not meant for the photos. */
const OPEN_LAYER = '[role="dialog"],[role="alertdialog"]';

/** The image files a paste carries; none when it carries text or nothing. */
export function pastedImages(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter((file) => file.type.startsWith('image/'));
}

/**
 * Images pasted while the screen is on — the Photos section and the Overview
 * (change-patient-overview-photos D14): a copied photo or screenshot pasted
 * anywhere on the page goes to `onFiles`, unless focus is in a field (it is
 * typing), a dialog or drawer is open (the paste is for it), or the paste holds
 * no image. `null` turns it off — a member who may not upload.
 */
export function usePhotoPaste(onFiles: ((files: readonly File[]) => void) | null): void {
  const latest = useRef(onFiles);
  useEffect(() => {
    latest.current = onFiles;
  });
  const enabled = onFiles !== null;
  useEffect(() => {
    if (!enabled) return;
    const onPaste = (event: ClipboardEvent) => {
      const handler = latest.current;
      if (!handler || event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;
      if (document.querySelector(OPEN_LAYER)) return;
      const images = pastedImages(event.clipboardData);
      if (images.length === 0) return;
      event.preventDefault();
      handler(images);
    };
    globalThis.addEventListener('paste', onPaste);
    return () => globalThis.removeEventListener('paste', onPaste);
  }, [enabled]);
}
