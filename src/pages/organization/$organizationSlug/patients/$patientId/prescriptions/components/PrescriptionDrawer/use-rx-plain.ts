import { useTranslation } from 'react-i18next';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';
import type { RxFormLine } from './rx-form.ts';
import { rxPlainLine } from './rx-plain.ts';
import { useRxLabels } from './use-rx-labels.ts';

const K = RX_KEYS;

/** A line in the patient's words: its directions, and the rest of its note. */
export interface RxPlainWords {
  /** "1 in the morning + 1 at night · After meal · Scalp · 10 days · 20 in all". */
  directions: string;
  /** "Leave on 5 minutes" — the note past its days; '' when none. */
  note: string;
}

/**
 * "What the patient reads" (feat-prescription-composer §6.5): each line in
 * plain words, in the drawer's language — the doses by the time of day, the
 * timing and place in the row's own words, the note's days and the total.
 */
export function useRxPlainWords(): (line: RxFormLine) => RxPlainWords {
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  return (line) => {
    const plain = rxPlainLine(line, labels.dayWords);
    const doses =
      plain.doses === 'sos'
        ? t(K.plain.sos)
        : plain.doses
            .map((dose) => t(K.plain[dose.time], { value: dose.count }))
            .join(' + ');
    const directions = [
      doses,
      labels.when(plain.when),
      labels.where(plain.where),
      plain.days ? labels.daysNote(plain.days) : '',
      t(K.plain.total, { value: plain.qty }),
    ]
      .filter(Boolean)
      .join(' · ');
    return { directions, note: plain.note };
  };
}
