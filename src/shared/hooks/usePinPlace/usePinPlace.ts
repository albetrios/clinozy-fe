import { useCallback, useRef, useState } from 'react';

import {
  lookupPin,
  PIN_CODE_PATTERN,
  type PinPlace,
} from '@/shared/app/pin-directory/index.ts';

/** What {@link usePinPlace} hands back. */
export interface PinPlaceState {
  /** The place the last full PIN names; `null` for a PIN the directory does not know; `undefined` before six digits. */
  place: PinPlace | null | undefined;
  /**
   * Look a PIN up as it is typed: below six digits it clears the place; at six it resolves to the
   * place (or `null`) — unless a later PIN was typed meanwhile, when it resolves to `null` and
   * leaves the place to that one.
   */
  lookUp: (pin: string) => Promise<PinPlace | null>;
  /**
   * What Area should become for a place found: its one area; `''` for a PIN of several areas when
   * Area still holds the one an earlier PIN filled in; `undefined` (leave it) otherwise — an area
   * typed by hand is never touched.
   */
  areaFor: (found: PinPlace, current: string) => string | undefined;
}

/**
 * The place a typed PIN code belongs to, from the directory bundled with the app — the clinic
 * setup's location step and Users › Branches share it (feat-write-less-2026-10-14-oixr, D13). The
 * caller fills its own fields with what `lookUp` resolves to; every field stays editable.
 *
 * @remarks
 * Side effects: loads the directory part for the PIN's first two digits (a lazy chunk). A slower
 * answer for an earlier PIN never overwrites a later one.
 */
export function usePinPlace(): PinPlaceState {
  const [place, setPlace] = useState<PinPlace | null | undefined>(undefined);
  const latest = useRef('');
  const filledArea = useRef<string | null>(null);
  const lookUp = useCallback(async (pin: string) => {
    latest.current = pin;
    if (!PIN_CODE_PATTERN.test(pin)) {
      setPlace(undefined);
      return null;
    }
    const found = await lookupPin(pin);
    if (latest.current !== pin) return null;
    setPlace(found);
    return found;
  }, []);
  const areaFor = useCallback((found: PinPlace, current: string) => {
    const [only] = found.areas;
    if (found.areas.length === 1 && only !== undefined) {
      filledArea.current = only;
      return only;
    }
    const stale = filledArea.current !== null && current === filledArea.current;
    filledArea.current = null;
    return stale ? '' : undefined;
  }, []);
  return { place, lookUp, areaFor };
}
