import { useTranslation } from 'react-i18next';

import type { RxTiming } from '@/shared/api/app/app-schema.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';
import {
  RX_MORE_TIMINGS,
  RX_PLACES,
  type RxFormLine,
  type RxPlaceKey,
  typedText,
} from './rx-form.ts';

const K = RX_KEYS;

const isTiming = (value: string): value is RxTiming =>
  (RX_MORE_TIMINGS as readonly string[]).includes(value);
const isPlace = (value: string): value is RxPlaceKey =>
  RX_PLACES.some((place) => place.key === value);

/** A line's values in the drawer's words: its dose, timing, place and days, and all of them. */
export function useRxLabels() {
  const { t } = useTranslation(RX_NS);
  const dose = (value: string) => (value === 'sos' ? t(K.dose.sos) : value);
  const when = (value: string) => {
    const typed = typedText(value);
    if (typed !== null) return typed;
    if (value === 'before') return t(K.meal.beforeHint);
    if (value === 'after') return t(K.meal.afterHint);
    return isTiming(value) ? t(K.timings[value]) : '';
  };
  const where = (value: string) => {
    const typed = typedText(value);
    if (typed !== null) return typed;
    return isPlace(value) ? t(K.places[value]) : '';
  };
  /** "7 days" — the drawer's words for a line's days; the saved note starts with them (D3). */
  const daysNote = (count: number) => t(K.daysNote, { count });
  /** "days", "Tage": the words a typed or saved number of days is followed by. */
  const dayWords = t(K.dayWords)
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean);
  /** "0-0-1 · After meal · Scalp · 7 days" — empty when the line sets none of them. */
  const directions = (
    line: Pick<RxFormLine, 'dose' | 'when' | 'where'> & Partial<Pick<RxFormLine, 'days'>>,
  ) =>
    [
      dose(line.dose),
      when(line.when),
      where(line.where),
      line.days ? daysNote(line.days) : '',
    ]
      .filter(Boolean)
      .join(' · ');
  return { dose, when, where, daysNote, dayWords, directions };
}
