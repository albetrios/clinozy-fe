import { rxDaysIn, rxDoseOf, type RxFormLine } from './rx-form.ts';

/*
 * "What the patient reads" (feat-prescription-composer KICKOFF §6.5): a line
 * in plain words — "1 in the morning + 1 at night · After meal · Scalp ·
 * 10 days · 20 in all" — read from the row's values. Pure: the sidekick puts
 * it in the drawer's words (`use-rx-plain.ts`).
 */

/** A time of day a tap dose names. */
type RxPlainTime = 'morning' | 'afternoon' | 'night';

/** One line, read for the patient. */
export interface RxPlainLine {
  /** Each time of day with its count, in the day's order; `sos` when only as needed. */
  doses: readonly { time: RxPlainTime; count: number }[] | 'sos';
  /** The row's timing value (`after`, `night`, `text:…`), or ''. */
  when: string;
  /** The row's place value (`scalp`, `text:…`), or ''. */
  where: string;
  /** The days the note names, or null. */
  days: number | null;
  qty: number;
  /** The note past its days ("10 days, apply thin layer" → "apply thin layer"), or ''. */
  note: string;
}

const TIMES: readonly RxPlainTime[] = ['morning', 'afternoon', 'night'];

/** The letters a word starts with ("days," → "days"). */
const LEADING_WORD = /^[\p{L}\p{M}]+/u;

/** What separates a note's parts: spaces and punctuation. */
const isSeparator = (character: string) => /[\s,;:.·–—-]/u.test(character);

/** Text without the separators at its ends, its inner spaces single. */
function trimSeparators(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && isSeparator(text.charAt(start))) start += 1;
  while (end > start && isSeparator(text.charAt(end - 1))) end -= 1;
  return text.slice(start, end).replace(/\s+/g, ' ');
}

/**
 * What a note says beyond the days it names — "10 days, apply thin layer" →
 * "apply thin layer": each number followed by a day word ("10 days", "5d", or
 * one of the drawer's own) is left out, with the separators it leaves at the
 * ends.
 */
export function rxNoteBeyondDays(
  remarks: string,
  dayWords: readonly string[] = [],
): string {
  const units = new Set(
    ['d', 'day', 'days', ...dayWords].map((word) => word.trim().toLowerCase()),
  );
  // ["Apply for ", "10", " days, gently"]: each number, then what follows it.
  const parts = remarks.split(/(\d+)/);
  let kept = parts[0] ?? '';
  for (let index = 1; index < parts.length; index += 2) {
    const after = parts[index + 1] ?? '';
    const lead = after.trimStart();
    const word = LEADING_WORD.exec(lead)?.[0];
    kept +=
      word && units.has(word.toLowerCase())
        ? lead.slice(word.length)
        : `${parts[index]}${after}`;
  }
  return trimSeparators(kept);
}

/**
 * A timing that only repeats the doses — "1 at night" with "Night", "1 in
 * the morning" with "Morning" — says nothing more, so it is left out.
 */
function echoesDoses(when: string, doses: RxPlainLine['doses']): boolean {
  if (doses === 'sos' || doses.length !== 1) return false;
  return doses[0]?.time === when;
}

/** A row read for the patient: its doses, timing, place, days, quantity and the rest of its note. */
export function rxPlainLine(
  line: Pick<RxFormLine, 'dose' | 'when' | 'where' | 'qty' | 'remarks'>,
  dayWords: readonly string[] = [],
): RxPlainLine {
  const dose = rxDoseOf(line.dose);
  let doses: RxPlainLine['doses'] = [];
  if (dose === 'sos') doses = 'sos';
  else if (dose) {
    doses = TIMES.map((time, index) => ({ time, count: dose[index] ?? 0 })).filter(
      (entry) => entry.count > 0,
    );
  }
  return {
    doses,
    when: echoesDoses(line.when, doses) ? '' : line.when,
    where: line.where,
    days: rxDaysIn(line.remarks, dayWords),
    qty: line.qty,
    note: rxNoteBeyondDays(line.remarks, dayWords),
  };
}
