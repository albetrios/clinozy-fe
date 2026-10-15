import { type DragEvent, useState } from 'react';

/** What {@link usePhotoDrop} spreads on its drop target, and whether files hover it. */
export interface PhotoDrop {
  /** Files are dragged over the target — its outline and veil show. */
  over: boolean;
  handlers: {
    onDragOver?: (event: DragEvent<HTMLElement>) => void;
    onDragLeave?: (event: DragEvent<HTMLElement>) => void;
    onDrop?: (event: DragEvent<HTMLElement>) => void;
  };
}

/** Whether a drag carries files — a dragged link or text is not an upload. */
function carriesFiles(event: DragEvent<HTMLElement>): boolean {
  const types = event.dataTransfer?.types;
  return !types || Array.from(types).includes('Files');
}

/**
 * Files dragged over a photo drop target (H:4789 `drop`) — the Photos section
 * and the Overview's Photos card (change-patient-overview-photos): `over` while
 * they hover it (a child entering does not end it), `onFiles` on the drop. Off
 * — no handlers — without `onFiles`, a member who may not upload.
 */
export function usePhotoDrop(onFiles: ((files: FileList) => void) | null): PhotoDrop {
  const [over, setOver] = useState(false);
  if (!onFiles) return { over: false, handlers: {} };
  return {
    over,
    handlers: {
      onDragOver: (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        if (!over) setOver(true);
      },
      onDragLeave: (event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setOver(false);
      },
      onDrop: (event) => {
        event.preventDefault();
        setOver(false);
        onFiles(event.dataTransfer.files);
      },
    },
  };
}
