import type { RxCatalogMedicine } from '@/shared/api/app/prescriptions-contracts.ts';

import { type RxFormLine, rxLineFor, withRxLine } from './rx-form.ts';
import {
  matchRxMedicines,
  parseRxLine,
  type RxLineValues,
  typedRxName,
} from './rx-quick-line.ts';

/*
 * The Rx Pad (feat-prescription-composer KICKOFF §6.4; D10): a whole
 * prescription typed or pasted at once, one medicine a line, each line read
 * with the quick line's own grammar and search — `flu 0-0-1 af 10d` finds
 * Flubolt 400 here exactly as it does in the line. Pure: the drawer renders
 * the read lines as its live preview and adds the readable ones.
 */

/** The most lines one Pad reads — a prescription holds at most 30 (the API's cap). */
export const RX_PAD_LINES_MAX = 30;

/** The most characters the Pad holds. */
export const RX_PAD_TEXT_MAX = 4000;

/** What one line of the Pad reads as. */
export type RxPadLine =
  | {
      /** The store's (or the patient's) medicine the words found — the best match. */
      kind: 'found';
      text: string;
      medicine: RxCatalogMedicine;
      values: RxLineValues;
    }
  | {
      /** A name the list lacks, added as typed ("Kojic Gel"). */
      kind: 'typed';
      text: string;
      name: string;
      values: RxLineValues;
    }
  | {
      /** Nothing left to name a medicine with (`0-0-1 af`): shown, then skipped. */
      kind: 'unreadable';
      text: string;
      values: RxLineValues;
    };

/** What the whole Pad reads as. */
export interface RxPad {
  lines: RxPadLine[];
  /** Non-blank lines past {@link RX_PAD_LINES_MAX}, left unread. */
  overflow: number;
}

/** A list's mark at the start of a line: "-", "*", "•", "·", "1.", "2)", "(3)". */
const LIST_MARK = /^\s*(?:[-*•·–—]+|\(?\d{1,2}[.)])\s*/u;

/**
 * The dosage forms a written prescription leads a line with — "Tab.", "Cap",
 * "Syp.", "Syr", "Inj.", "Oint." — never part of the store's name.
 */
const FORM_WORDS: ReadonlySet<string> = new Set([
  'tab',
  'tabs',
  'tablet',
  'tablets',
  'cap',
  'caps',
  'capsule',
  'capsules',
  'syp',
  'syr',
  'syrup',
  'inj',
  'oint',
]);

/** A line without its leading dosage form ("Tab. flu od" → "flu od"). */
function withoutFormWord(line: string): string {
  const space = line.search(/\s/);
  if (space === -1) return line;
  const first = line.slice(0, space).replace(/\.$/, '').toLowerCase();
  return FORM_WORDS.has(first) ? line.slice(space).trimStart() : line;
}

/** A line without its list mark and its leading dosage form. */
export function cleanRxPadLine(raw: string): string {
  return withoutFormWord(raw.replace(LIST_MARK, '').trim()).trim();
}

/** One cleaned line as the quick line would read it. */
function readLine(
  text: string,
  catalog: readonly RxCatalogMedicine[],
  numbers: ReadonlySet<string>,
): RxPadLine {
  const { words, values } = parseRxLine(text, numbers);
  if (words.length === 0) return { kind: 'unreadable', text, values };
  const [best] = matchRxMedicines(catalog, words);
  if (best) return { kind: 'found', text, medicine: best, values };
  const name = typedRxName(catalog, words);
  return name
    ? { kind: 'typed', text, name, values }
    : { kind: 'unreadable', text, values };
}

/**
 * Read the Pad: each non-blank line, cleaned (`cleanRxPadLine`), as the
 * quick line reads it — the best match, else the name as typed, else
 * unreadable. Blank lines are skipped; lines past {@link RX_PAD_LINES_MAX}
 * are counted, not read.
 *
 * @param numbers The numbers the catalogue's names carry (`nameNumbers`), so "400" stays in "flu 400".
 */
export function readRxPad(
  text: string,
  catalog: readonly RxCatalogMedicine[],
  numbers: ReadonlySet<string> = new Set(),
): RxPad {
  const written = text
    .split(/\r?\n/)
    .map(cleanRxPadLine)
    .filter((line) => line !== '');
  return {
    lines: written
      .slice(0, RX_PAD_LINES_MAX)
      .map((line) => readLine(line, catalog, numbers)),
    overflow: Math.max(0, written.length - RX_PAD_LINES_MAX),
  };
}

/** A Pad line that names a medicine — one the Pad adds. */
export type ReadableRxPadLine = Exclude<RxPadLine, { kind: 'unreadable' }>;

/** The lines the Pad adds: every one that names a medicine. */
export function readableRxPadLines(pad: RxPad): ReadableRxPadLine[] {
  return pad.lines.filter(
    (line): line is ReadableRxPadLine => line.kind !== 'unreadable',
  );
}

/** The medicine a readable line adds: the one it found, or its name as typed. */
export function rxPadMedicine(
  line: ReadableRxPadLine,
): Pick<RxCatalogMedicine, 'name' | 'medicineId' | 'composition' | 'last'> {
  return line.kind === 'found'
    ? line.medicine
    : { name: line.name, medicineId: null, composition: null, last: null };
}

/**
 * The form's lines with the Pad's added, in order — each as the quick line
 * adds one (`rxLineFor`: what the line set, else the patient's last line of
 * it), filling a blank row first (`withRxLine`).
 */
export function withRxPadLines(
  items: readonly RxFormLine[],
  lines: readonly ReadableRxPadLine[],
  daysNote: (days: number) => string,
): RxFormLine[] {
  return lines.reduce<RxFormLine[]>(
    (current, line) =>
      withRxLine(current, rxLineFor(rxPadMedicine(line), line.values, daysNote)),
    [...items],
  );
}
