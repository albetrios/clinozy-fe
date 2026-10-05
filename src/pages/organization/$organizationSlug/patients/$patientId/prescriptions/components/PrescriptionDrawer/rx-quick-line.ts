import type { BodyPart, RxMeal, RxTiming } from '@/shared/api/clinic/clinic-schema.ts';
import type { MedicineForm } from '@/shared/api/clinic/medicines-contracts.ts';
import type { RxCatalogMedicine } from '@/shared/api/clinic/prescriptions-api.ts';
import {
  quickLineBrowseMatches,
  quickLineMatches,
  quickLineTypedName,
} from '@/shared/components/QuickLine/index.ts';

/*
 * The Rx quick line (KICKOFF §6.6 step 2; `patient-file.md:111`): the
 * prototype's `__czRxMods` grammar (H:3864) — "flu 0-0-1 af 10d" finds
 * Flubolt 400, one at night after meals for ten days, ten in all — over the
 * quick line's one search (H:3789–3797, `quick-line-match.ts`), read with a
 * medicine's composition as its keywords. Pure: the drawer renders the
 * parsed values as pills in its own words.
 */

/** Morning · afternoon · night taps (0–2 each), or "only when needed". */
export type RxDose = readonly [morning: number, afternoon: number, night: number] | 'sos';

/** When a line is taken: around a meal, or a timing (`rx_meal` / `rx_timing`). */
type RxWhen = { kind: 'meal'; meal: RxMeal } | { kind: 'timing'; timing: RxTiming };

/** What the shorthand of a line set. */
export interface RxLineValues {
  dose?: RxDose;
  when?: RxWhen;
  where?: BodyPart;
  /** "10d", "2w". */
  days?: number;
  /** "x8", or a bare number after the name. */
  qty?: number;
}

/** A typed line: the words left for the medicine's name, and what the rest set. */
export interface ParsedRxLine {
  words: string[];
  values: RxLineValues;
}

/** od · bd · tds · hs · sos (H:3864 `DS`). */
const DOSE_WORDS: Readonly<Record<string, RxDose>> = {
  od: [1, 0, 0],
  bd: [1, 0, 1],
  tds: [1, 1, 1],
  hs: [0, 0, 1],
  sos: 'sos',
};

/** af · bf · am · pm and their words (H:3864 `WH`). */
const WHEN_WORDS: Readonly<Record<string, RxWhen>> = {
  af: { kind: 'meal', meal: 'after' },
  after: { kind: 'meal', meal: 'after' },
  bf: { kind: 'meal', meal: 'before' },
  before: { kind: 'meal', meal: 'before' },
  am: { kind: 'timing', timing: 'morning' },
  morning: { kind: 'timing', timing: 'morning' },
  night: { kind: 'timing', timing: 'night' },
  pm: { kind: 'timing', timing: 'night' },
};

/** face · scalp · body · hair · underarm (H:3864 `WR`). */
const WHERE_WORDS: Readonly<Record<string, BodyPart>> = {
  face: 'face',
  scalp: 'scalp',
  body: 'body',
  hair: 'hair',
  underarm: 'underarm',
};

const TAPS = /^[0-2]-[0-2]-[0-2]$/;
const DAYS = /^(\d+)d$/;
const WEEKS = /^(\d+)w$/;
const COUNT = /^x?\d+$/;

/** Doses a day of a tap dose; none for SOS. */
export function dosesPerDay(dose: RxDose | undefined): number {
  return Array.isArray(dose) ? dose[0] + dose[1] + dose[2] : 0;
}

/** A part's dose: taps or a dose word; `hs` also means at night unless a timing is set. */
function readDose(part: string, values: RxLineValues): boolean {
  if (TAPS.test(part)) {
    const [morning = 0, afternoon = 0, night = 0] = part.split('-').map(Number);
    values.dose = [morning, afternoon, night];
    return true;
  }
  const dose = DOSE_WORDS[part];
  if (!dose) return false;
  values.dose = dose;
  if (part === 'hs') values.when ??= { kind: 'timing', timing: 'night' };
  return true;
}

/** A part's timing, place or days. */
function readWhenWhereDays(part: string, values: RxLineValues): boolean {
  const when = WHEN_WORDS[part];
  const where = WHERE_WORDS[part];
  if (when) values.when = when;
  else if (where) values.where = where;
  else if (DAYS.test(part)) values.days = Number(part.slice(0, -1));
  else if (WEEKS.test(part)) values.days = 7 * Number(part.slice(0, -1));
  else return false;
  return true;
}

/**
 * A part's quantity: `x8` anywhere after a name word, or a bare number there
 * that the catalogue's names do not carry.
 */
function readQty(
  part: string,
  values: RxLineValues,
  numbers: ReadonlySet<string>,
  named: boolean,
): boolean {
  const explicit = part.startsWith('x');
  const repeatsTheName = numbers.has(part) && !explicit;
  if (!(named && COUNT.test(part)) || repeatsTheName) return false;
  values.qty = Number(part.replace('x', ''));
  return true;
}

/** Read one part into `values`; false when it is part of the name. */
function readPart(
  part: string,
  values: RxLineValues,
  numbers: ReadonlySet<string>,
  named: boolean,
): boolean {
  return (
    readDose(part, values) ||
    readWhenWhereDays(part, values) ||
    readQty(part, values, numbers, named)
  );
}

/**
 * Read a quick line (H:3864): `0-0-1` taps; od / bd / tds / hs / sos; af / bf
 * / am / pm (and after / before / morning / night); face / scalp / body /
 * hair / underarm; `5d` / `2w`; `x8`, or a bare number once the name has a
 * word (a number the catalogue's names carry stays in the name). Everything
 * else is the name. Days with a tap dose and no quantity set the quantity:
 * days × doses a day.
 */
export function parseRxLine(
  text: string,
  numbers: ReadonlySet<string> = new Set(),
): ParsedRxLine {
  const words: string[] = [];
  const values: RxLineValues = {};
  for (const part of text.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    if (!readPart(part, values, numbers, words.length > 0)) words.push(part);
  }
  if (values.days && !values.qty && dosesPerDay(values.dose) > 0) {
    values.qty = values.days * dosesPerDay(values.dose);
  }
  return { words, values };
}

/** A medicine as the shared search reads it: its name, its composition as keywords. */
function searchable(medicine: RxCatalogMedicine) {
  return { label: medicine.name, keywords: medicine.composition ?? '', medicine };
}

/**
 * The quick line's matches (H:3790–3792) on the shared search: with words,
 * the medicines every word matches, best first; with none, the "Often
 * prescribed" first and then the catalogue. At most eight.
 */
export function matchRxMedicines(
  catalog: readonly RxCatalogMedicine[],
  words: readonly string[],
  often: readonly string[] = [],
): RxCatalogMedicine[] {
  const entries = catalog.map(searchable);
  const first = often
    .map((name) => entries.find((entry) => entry.medicine.name === name))
    .filter((entry): entry is ReturnType<typeof searchable> => Boolean(entry));
  return quickLineMatches(entries, words, first).map((entry) => entry.medicine);
}

/**
 * The name a line adds "as typed" when the catalogue has no medicine of that
 * name (H:3793): each word capitalised — `null` when there are no words or
 * the name is already listed.
 */
export function typedRxName(
  catalog: readonly RxCatalogMedicine[],
  words: readonly string[],
): string | null {
  return quickLineTypedName(catalog.map(searchable), words);
}

/** Browse's groups (H:3797): everything, the patient's often prescribed, Oral, Topical. */
export type RxBrowseGroup = 'all' | 'often' | MedicineForm;

/**
 * Browse's tiles (H:3797–3798): the group's medicines whose name or
 * composition holds every word of the line, in the catalogue's order.
 */
export function browseRxMedicines(
  catalog: readonly RxCatalogMedicine[],
  group: RxBrowseGroup,
  words: readonly string[],
  often: readonly string[] = [],
): RxCatalogMedicine[] {
  return catalog.filter((medicine) => {
    const inGroup =
      group === 'all' ||
      (group === 'often' ? often.includes(medicine.name) : medicine.form === group);
    return inGroup && quickLineBrowseMatches(searchable(medicine), words);
  });
}
