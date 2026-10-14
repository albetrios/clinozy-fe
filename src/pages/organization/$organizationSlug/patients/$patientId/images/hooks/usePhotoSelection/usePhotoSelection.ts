import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PatientPhoto } from '@/shared/api/app/patient-images-contracts.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../shared/patient-photos.constants.ts';
import { PHOTO_COMPARE } from '../../images.search.ts';

/** What {@link usePhotoSelection} gives the Photos section. */
export interface PhotoSelection {
  /** Selecting: a tap on a tile selects it instead of opening it. */
  active: boolean;
  /** The photos picked, in the order they were picked. */
  picked: readonly PatientPhoto[];
  /** Their ids, for the tiles. */
  ids: ReadonlySet<string>;
  /** Eight picked — the most a comparison takes. */
  full: boolean;
  /** Two to eight picked — Compare is on. */
  comparable: boolean;
  /** Pick or drop a photo (turning selection on); a ninth is refused with a toast. */
  toggle: (photo: PatientPhoto) => void;
  /** Turn selection on, nothing picked yet. */
  start: () => void;
  /** "Select" (true) or "Done" (false) — the toolbar's toggle. */
  setActive: (active: boolean) => void;
  /** Drop every pick, still selecting. */
  clear: () => void;
  /** Leave selection — the picks go. */
  stop: () => void;
}

/**
 * The Photos section's selection (change-patient-overview-photos
 * `BRIEF.md:32–36`): "Select" or a tile's check circle turns it on, a tap then
 * picks; at most eight — the ninth says "You can compare up to 8 photos at a
 * time" and is not picked; two to eight make Compare. Esc leaves selection
 * before it reaches the file's Esc-goes-back (a `document` listener marks the
 * key handled), and so does "Done". Page state: nothing is stored.
 */
export function usePhotoSelection(): PhotoSelection {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const [active, setActive] = useState(false);
  const [picked, setPicked] = useState<readonly PatientPhoto[]>([]);

  const toggle = useCallback(
    (photo: PatientPhoto) => {
      setActive(true);
      if (picked.some((entry) => entry.id === photo.id)) {
        setPicked(picked.filter((entry) => entry.id !== photo.id));
        return;
      }
      if (picked.length >= PHOTO_COMPARE.max) {
        notify.info(t(PATIENT_PHOTOS_KEYS.select.limit, { max: PHOTO_COMPARE.max }));
        return;
      }
      setPicked([...picked, photo]);
    },
    [picked, t],
  );
  const stop = useCallback(() => {
    setActive(false);
    setPicked([]);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // A dialog over the section (the comparison, a confirm) takes its own Esc.
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
      event.preventDefault();
      stop();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, stop]);

  return useMemo(
    () => ({
      active,
      picked,
      ids: new Set(picked.map((photo) => photo.id)),
      full: picked.length >= PHOTO_COMPARE.max,
      comparable: picked.length >= PHOTO_COMPARE.min,
      toggle,
      start: () => setActive(true),
      setActive: (next: boolean) => (next ? setActive(true) : stop()),
      clear: () => setPicked([]),
      stop,
    }),
    [active, picked, toggle, stop],
  );
}
