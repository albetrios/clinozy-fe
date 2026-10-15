import type {
  BodyPart,
  PrescriptionItem,
  RxMeal,
  RxTiming,
  Tone,
} from '@/shared/api/app/app-schema.ts';
import type {
  PrescriptionFields,
  PrescriptionRecord,
  RxCatalogMedicine,
} from '@/shared/api/app/prescriptions-contracts.ts';
import {
  quickLineCount,
  withQuickLineRow,
  withSteppedQuickLineRow,
} from '@/shared/components/QuickLine/index.ts';

import { dosesPerDay, type RxDose, type RxLineValues } from './rx-quick-line.ts';

/*
 * The Prescription drawer's form (KICKOFF §6.6; `patient-file.md:105–121`),
 * shaped like the design's item rows (H:4807): a line's dose, timing and place
 * are one value each — what the row's controls hold — and turn into the
 * contract's fields on save.
 */

/** One medicine line as the row's controls hold it. */
export interface RxFormLine {
  medicineId: string | null;
  medicineName: string;
  /** "1-0-1" (morning-afternoon-night taps), "sos", or '' (none). */
  dose: string;
  /**
   * When it is taken: `before` / `after` a meal, one of the contract's
   * `rx_timing` values, `text:<typed>` (a timing the list lacks), or ''.
   */
  when: string;
  /** Where it is applied: one of the Where list's places, `text:<typed>`, or ''. */
  where: string;
  /**
   * For how many days; null when the line names none. The wire keeps them as the first part of
   * `remarks` ("7 days · apply thin layer", change-prescription-writing D3).
   */
  days: number | null;
  qty: number;
  /** The dashed note line — what the patient is told beyond the days. */
  remarks: string;
}

/** The drawer's form. */
export interface RxFormValues {
  /** Clinic-local `YYYY-MM-DD`. */
  date: string;
  doctorId: string | null;
  items: RxFormLine[];
  advice: string;
  labReport: string;
  procedureToday: string;
}

/** A typed value's prefix (`text:Neck area`). */
const TYPED = 'text:';

/** The text of a typed value, or null for a listed one. */
export function typedText(value: string): string | null {
  return value.startsWith(TYPED) ? value.slice(TYPED.length) : null;
}

/** A typed value. */
export const typedValue = (text: string) => `${TYPED}${text}`;

// ── Places and timings ──

/**
 * The Where list's 14 places (H:4807), with the contract's `body_part` where
 * it has one. The rest store `other` with the place's English name as the
 * text — the printed sheet's language (`body_part` lacks them: a backend request).
 */
export const RX_PLACES = [
  { key: 'face', bodyPart: 'face', text: null },
  { key: 'scalp', bodyPart: 'scalp', text: null },
  { key: 'hair', bodyPart: 'hair', text: null },
  { key: 'body', bodyPart: 'body', text: null },
  { key: 'underarm', bodyPart: 'underarm', text: null },
  { key: 'neck', bodyPart: null, text: 'Neck' },
  { key: 'back', bodyPart: 'back', text: null },
  { key: 'chest', bodyPart: 'chest', text: null },
  { key: 'hands', bodyPart: null, text: 'Hands' },
  { key: 'legs', bodyPart: 'legs', text: null },
  { key: 'feet', bodyPart: null, text: 'Feet' },
  { key: 'lips', bodyPart: null, text: 'Lips' },
  { key: 'underEyes', bodyPart: null, text: 'Under eyes' },
  { key: 'affectedArea', bodyPart: null, text: 'Affected area' },
] as const satisfies readonly {
  key: string;
  bodyPart: BodyPart | null;
  text: string | null;
}[];

/** One of the Where list's places. */
export type RxPlaceKey = (typeof RX_PLACES)[number]['key'];

/** The meal buttons (H:4807): Before (butter) and After (sky). */
export const RX_MEALS = [
  { value: 'before', tone: 'butter' },
  { value: 'after', tone: 'sky' },
] as const satisfies readonly { value: RxMeal; tone: Tone }[];

/** "More timings" (H:4807): the contract's `rx_timing`, in the design's order. */
export const RX_MORE_TIMINGS = [
  'empty_stomach',
  'with_meal',
  'morning',
  'night',
  'morning_night',
  'thrice_week',
  'once_week',
  'alternate_days',
] as const satisfies readonly RxTiming[];

const isMeal = (value: string): value is RxMeal =>
  value === 'before' || value === 'after';
const isTiming = (value: string): value is RxTiming =>
  (RX_MORE_TIMINGS as readonly string[]).includes(value);

/**
 * The dose ⌄'s common doses (change-prescription-writing D5), in the order a
 * doctor reaches for them; SOS last.
 */
export const RX_DOSE_PRESETS = [
  { id: 'morning', value: '1-0-0' },
  { id: 'night', value: '0-0-1' },
  { id: 'twice', value: '1-0-1' },
  { id: 'thrice', value: '1-1-1' },
  { id: 'afternoon', value: '0-1-0' },
  { id: 'sos', value: 'sos' },
] as const;

/** The most of one tap a dose takes from the ⌄'s + (D5). */
export const RX_MAX_TAP = 4;

/**
 * A dose after a tap (D5): a time that is off turns on (1); one that is on —
 * one tablet or more — turns off. A tap on an SOS dose starts the taps over.
 */
export function rxToggledDose(value: string, index: number): string {
  const dose = rxDoseOf(value);
  const taps = Array.isArray(dose) ? [...dose] : [0, 0, 0];
  taps[index] = (taps[index] ?? 0) > 0 ? 0 : 1;
  return taps.some((tap) => tap > 0) ? taps.join('-') : '';
}

/** A dose after the ⌄'s − or + on one time, kept within 0 and {@link RX_MAX_TAP}. */
export function rxSteppedDose(value: string, index: number, step: 1 | -1): string {
  const dose = rxDoseOf(value);
  const taps = Array.isArray(dose) ? [...dose] : [0, 0, 0];
  taps[index] = Math.min(RX_MAX_TAP, Math.max(0, (taps[index] ?? 0) + step));
  return taps.some((tap) => tap > 0) ? taps.join('-') : '';
}

/** The Days list (D6): the courses a doctor writes most, in days. */
export const RX_DAY_PRESETS = [3, 5, 7, 10, 14, 21, 30, 45, 60, 90] as const;

/** Days typed into the Days list ("12", "12 days") — 1 to a year — or null. */
export function rxTypedDays(text: string): number | null {
  const days = Number(/^\s*(\d{1,3})/.exec(text)?.[1] ?? 0);
  return days >= 1 && days <= RX_MAX_DAYS ? days : null;
}

/**
 * Where a line's medicine comes from (D4): the store's with stock, out of
 * stock, or no stock read (`store`); `outside` — written as text, bought
 * elsewhere; `none` for a blank row.
 */
export type RxLineSource = 'stocked' | 'empty' | 'store' | 'outside' | 'none';

/** A line's source, with the store's medicine when it is one. */
export function rxLineSource(
  line: Pick<RxFormLine, 'medicineId' | 'medicineName'>,
  medicines: readonly Pick<RxCatalogMedicine, 'medicineId' | 'name' | 'stock'>[],
): { source: RxLineSource; stock: number | null } {
  if (line.medicineName.trim() === '') return { source: 'none', stock: null };
  if (line.medicineId === null) return { source: 'outside', stock: null };
  const stock =
    medicines.find((medicine) => medicine.medicineId === line.medicineId)?.stock ?? null;
  if (stock === null) return { source: 'store', stock };
  return { source: stock > 0 ? 'stocked' : 'empty', stock };
}

/** The store's medicine an outside line's name is, when the store carries it (D4). */
export function rxStoreMedicineFor<
  T extends Pick<RxCatalogMedicine, 'medicineId' | 'name'>,
>(
  line: Pick<RxFormLine, 'medicineId' | 'medicineName'>,
  medicines: readonly T[],
): T | undefined {
  if (line.medicineId !== null) return undefined;
  const name = line.medicineName.trim().toLowerCase();
  return name
    ? medicines.find(
        (medicine) =>
          medicine.medicineId !== null && medicine.name.toLowerCase() === name,
      )
    : undefined;
}

/** Step 3's notes, in order (H:4808): each field with its label and placeholder keys. */
export const RX_NOTES = [
  {
    field: 'advice',
    label: 'advice',
    placeholder: 'advicePlaceholder',
    testId: 'advice',
  },
  {
    field: 'labReport',
    label: 'lab',
    placeholder: 'labPlaceholder',
    testId: 'lab-report',
  },
  {
    field: 'procedureToday',
    label: 'procedure',
    placeholder: 'procedurePlaceholder',
    testId: 'procedure-today',
  },
] as const satisfies readonly {
  field: keyof RxFormValues;
  label: string;
  placeholder: string;
  /** `rx-drawer-<testId>`. */
  testId: string;
}[];

// ── Lines ──

/** A blank line — the table keeps one (H:4807). */
export function emptyRxLine(): RxFormLine {
  return {
    medicineId: null,
    medicineName: '',
    dose: '',
    when: '',
    where: '',
    days: null,
    qty: 1,
    remarks: '',
  };
}

/** A dose as its value. */
export function rxDoseValue(dose: RxDose | undefined): string {
  if (dose === undefined) return '';
  if (dose === 'sos') return 'sos';
  return dose.some((count) => count > 0) ? dose.join('-') : '';
}

/** A dose value as the parser's dose; undefined when none. */
export function rxDoseOf(value: string): RxDose | undefined {
  if (value === 'sos') return 'sos';
  if (!/^\d-\d-\d$/.test(value)) return undefined;
  const [morning = 0, afternoon = 0, night = 0] = value.split('-').map(Number);
  return [morning, afternoon, night];
}

/** A saved line's place as its value. */
function whereOf(item: Pick<PrescriptionItem, 'bodyPart' | 'bodyPartText'>): string {
  const listed = RX_PLACES.find((place) =>
    item.bodyPart && item.bodyPart !== 'other'
      ? place.bodyPart === item.bodyPart
      : place.text !== null && place.text === item.bodyPartText,
  );
  if (listed) return listed.key;
  return item.bodyPartText ? typedValue(item.bodyPartText) : '';
}

/** A saved line's timing as its value. */
function whenOf(item: Pick<PrescriptionItem, 'meal' | 'timing' | 'timingText'>): string {
  if (item.timing) return item.timing;
  if (item.meal) return item.meal;
  return item.timingText ? typedValue(item.timingText) : '';
}

/** What a new line reads of a medicine: its name, the store's id, this patient's last line. */
type RxLineMedicine = Pick<RxCatalogMedicine, 'name' | 'medicineId' | 'last'>;

/**
 * A saved line as the row holds it: a note that starts with days ("7 days · apply thin") gives
 * them to Days and keeps the rest (D3); `dayWords` are the drawer's own ("Tage").
 */
export function rxFormLineOf(
  item: PrescriptionItem,
  dayWords: readonly string[] = [],
): RxFormLine {
  const dose: RxDose | undefined = item.sos
    ? 'sos'
    : [item.doseMorning, item.doseAfternoon, item.doseNight];
  const { days, note } = rxSplitDays(item.remarks ?? '', dayWords);
  return {
    medicineId: item.medicineId,
    medicineName: item.medicineName,
    dose: rxDoseValue(dose),
    when: whenOf(item),
    where: whereOf(item),
    days,
    qty: item.qty,
    remarks: note,
  };
}

const textOrNull = (text: string | null | undefined) => {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

/** A row's place as the contract's `bodyPart` and `bodyPartText`. */
function placeFields(where: string) {
  const typed = typedText(where);
  if (typed !== null)
    return { bodyPart: 'other' as const, bodyPartText: textOrNull(typed) };
  const place = RX_PLACES.find((candidate) => candidate.key === where);
  if (!place) return { bodyPart: null, bodyPartText: null };
  return place.bodyPart
    ? { bodyPart: place.bodyPart, bodyPartText: null }
    : { bodyPart: 'other' as const, bodyPartText: place.text };
}

/** A row's timing as the contract's `meal`, `timing` and `timingText`. */
function timingFields(when: string) {
  const typed = typedText(when);
  if (typed !== null) return { meal: null, timing: null, timingText: textOrNull(typed) };
  if (isMeal(when)) return { meal: when, timing: null, timingText: null };
  if (isTiming(when)) return { meal: null, timing: when, timingText: null };
  return { meal: null, timing: null, timingText: null };
}

/** "7 days · apply thin layer": the days in the drawer's words, then the note (D3). */
export function rxRemarksOf(
  line: Pick<RxFormLine, 'days' | 'remarks'>,
  daysNote: (days: number) => string,
): string {
  return [line.days ? daysNote(line.days) : '', line.remarks.trim()]
    .filter(Boolean)
    .join(' · ');
}

/** A row as the contract holds it — the days written first into its remarks. */
export function rxItemOf(
  line: RxFormLine,
  daysNote: (days: number) => string,
): PrescriptionItem {
  const dose = rxDoseOf(line.dose);
  const taps = Array.isArray(dose) ? dose : [0, 0, 0];
  return {
    medicineId: line.medicineId,
    medicineName: line.medicineName.trim(),
    doseMorning: taps[0] ?? 0,
    doseAfternoon: taps[1] ?? 0,
    doseNight: taps[2] ?? 0,
    sos: dose === 'sos',
    ...timingFields(line.when),
    ...placeFields(line.where),
    qty: Math.max(1, line.qty),
    remarks: textOrNull(rxRemarksOf(line, daysNote)),
  };
}

/** The lines that name a medicine — blank rows are left out (H:4808). */
export function namedRxLines(items: readonly RxFormLine[]): RxFormLine[] {
  return items.filter((item) => item.medicineName.trim() !== '');
}

// ── The form ──

/**
 * The step the drawer opens on (feat-prescription-composer D9): Medicines — Date and Doctor are
 * already right — unless no doctor could be chosen, which step 1 asks for.
 */
export function firstRxStep(doctorId: string | null): 'medicines' | 'prescription' {
  return doctorId ? 'medicines' : 'prescription';
}

/** A new prescription's form: today, the doctor, one blank line, no notes. */
export function newRxForm(date: string, doctorId: string | null): RxFormValues {
  return {
    date,
    doctorId,
    items: [emptyRxLine()],
    advice: '',
    labReport: '',
    procedureToday: '',
  };
}

/** A saved prescription as the edit drawer opens it. */
export function rxFormOf(
  prescription: PrescriptionRecord,
  dayWords: readonly string[] = [],
): RxFormValues {
  return {
    date: prescription.date,
    doctorId: prescription.doctorId,
    items: prescription.items.length
      ? prescription.items.map((item) => rxFormLineOf(item, dayWords))
      : [emptyRxLine()],
    advice: prescription.advice ?? '',
    labReport: prescription.labReport ?? '',
    procedureToday: prescription.procedureToday ?? '',
  };
}

/** The write a save sends: the named lines and the notes, blanks as null. */
export function rxFieldsOf(
  values: RxFormValues,
  daysNote: (days: number) => string,
): PrescriptionFields {
  return {
    doctorId: values.doctorId ?? '',
    date: values.date,
    items: namedRxLines(values.items).map((line) => rxItemOf(line, daysNote)),
    advice: textOrNull(values.advice),
    labReport: textOrNull(values.labReport),
    procedureToday: textOrNull(values.procedureToday),
  };
}

// ── Quantities ──

/** The letters a word starts with ("days," → "days"). */
export const LEADING_WORD = /^[\p{L}\p{M}]+/u;

/** The words a number of days is followed by: "d", "day", "days" and the drawer's own. */
export function rxDayUnits(dayWords: readonly string[] = []): ReadonlySet<string> {
  return new Set(
    ['d', 'day', 'days', ...dayWords].map((word) => word.trim().toLowerCase()),
  );
}

/** What separates a note's parts: spaces and punctuation. */
export const isNoteSeparator = (character: string) => /[\s,;:.·–—-]/u.test(character);

/** The longest a line runs: a year. */
const RX_MAX_DAYS = 365;

/**
 * A note's leading days and the rest (D3): "10 days, apply thin" → 10 and
 * "apply thin"; "5d" → 5 and "". A note that does not start with days is kept
 * whole, with no days.
 */
export function rxSplitDays(
  remarks: string,
  dayWords: readonly string[] = [],
): { days: number | null; note: string } {
  const number = /^\s*(\d{1,3})/.exec(remarks);
  const after = remarks.slice(number?.[0].length ?? 0).trimStart();
  const word = LEADING_WORD.exec(after)?.[0];
  const days = Number(number?.[1] ?? 0);
  if (!(
    word &&
    days >= 1 &&
    days <= RX_MAX_DAYS &&
    rxDayUnits(dayWords).has(word.toLowerCase())
  ))
    return { days: null, note: remarks };
  let rest = after.slice(word.length);
  while (rest !== '' && isNoteSeparator(rest.charAt(0))) rest = rest.slice(1);
  return { days, note: rest.trimEnd() };
}

/**
 * The days a note names anywhere — "10 days", "5d", or a day word of the
 * drawer's own language ("10 Tage") — or null (H:4807).
 */
export function rxDaysIn(
  remarks: string,
  dayWords: readonly string[] = [],
): number | null {
  const units = rxDayUnits(dayWords);
  // ["10", " days, apply…"]: each number, then what follows it.
  const parts = remarks.toLowerCase().split(/(\d+)/);
  for (let index = 1; index < parts.length; index += 2) {
    const word = LEADING_WORD.exec((parts[index + 1] ?? '').trimStart())?.[0];
    if (word && units.has(word)) return Number(parts[index]);
  }
  return null;
}

/**
 * The quantity days and a dose call for (H:4807): days × doses a day, when
 * both are known and the dose is taps; else null — keep the quantity.
 */
export function rxQtyFor(dose: string, days: number | null): number | null {
  const perDay = dosesPerDay(rxDoseOf(dose));
  return days && perDay ? Math.min(days * perDay, 999) : null;
}

// ── Adding a medicine ──

/** What a line is added with: the parsed shorthand's place and timing as values. */
function shorthandFields(values: RxLineValues): Partial<RxFormLine> {
  const fields: Partial<RxFormLine> = {};
  if (values.dose) fields.dose = rxDoseValue(values.dose);
  if (values.when) {
    fields.when = values.when.kind === 'meal' ? values.when.meal : values.when.timing;
  }
  if (values.where) {
    const place = RX_PLACES.find((candidate) => candidate.bodyPart === values.where);
    if (place) fields.where = place.key;
  }
  return fields;
}

/**
 * The line a picked medicine adds (H:4806 `addM`): what the quick line set,
 * else the patient's last line of it — its days too (D3); the quantity the
 * line set, else days × doses a day, else the last one's, else 1.
 */
export function rxLineFor(medicine: RxLineMedicine, values: RxLineValues): RxFormLine {
  const last = medicine.last ? rxFormLineOf(medicine.last) : null;
  const line: RxFormLine = {
    ...emptyRxLine(),
    medicineId: medicine.medicineId,
    medicineName: medicine.name,
    dose: last?.dose ?? '',
    when: last?.when ?? '',
    where: last?.where ?? '',
    ...shorthandFields(values),
    days: values.days ?? last?.days ?? null,
  };
  return { ...line, qty: values.qty ?? rxQtyFor(line.dose, line.days) ?? last?.qty ?? 1 };
}

/** A line with no medicine yet: the next add fills it. */
const isBlankRxLine = (item: RxFormLine) => item.medicineName.trim() === '';

/** The lines after adding one (H:4806): it fills the first blank row, or comes last. */
export function withRxLine(items: readonly RxFormLine[], line: RxFormLine): RxFormLine[] {
  return withQuickLineRow(items, line, isBlankRxLine);
}

/**
 * The drawer's starting form: an edit's prescription, else a new one — with
 * a line for each medicine a smart note named (AMBER A-F5).
 */
export function initialRxForm({
  prescription,
  today,
  doctorId,
  medicines,
  catalog,
  dayWords = [],
}: {
  prescription: PrescriptionRecord | null;
  today: string;
  doctorId: string | null;
  medicines: readonly string[];
  catalog: readonly RxLineMedicine[];
  /** The drawer's own day words: a saved note's leading days split by them too (D3). */
  dayWords?: readonly string[];
}): RxFormValues {
  if (prescription) return rxFormOf(prescription, dayWords);
  return rxFormWithMedicines(newRxForm(today, doctorId), medicines, catalog);
}

/**
 * A new prescription opened from a smart note (AMBER A-F5): a line for each
 * medicine it named — the store's, with its last dosage, when the catalogue
 * carries the name; else the name as typed — free text, as the API keeps it (§5.4).
 */
export function rxFormWithMedicines(
  form: RxFormValues,
  names: readonly string[],
  catalog: readonly RxLineMedicine[],
): RxFormValues {
  const items = names.reduce((lines, name) => {
    const known = catalog.find(
      (medicine) => medicine.name.toLowerCase() === name.toLowerCase(),
    );
    return withRxLine(
      lines,
      rxLineFor(known ?? { name, medicineId: null, last: null }, {}),
    );
  }, form.items);
  return { ...form, items };
}

/** How many of a medicine the lines hold — Browse's tile count. */
export function rxCountOf(items: readonly RxFormLine[], name: string): number {
  return quickLineCount(items, (item) => item.medicineName === name);
}

/**
 * Browse's tap and − / + (H:4806 `step`): + adds the medicine when no line has
 * it, else one more; − takes one away and drops the line at none (the table
 * keeps one blank row).
 */
export function steppedRxLines(
  items: readonly RxFormLine[],
  medicine: RxLineMedicine,
  step: 1 | -1,
): RxFormLine[] {
  return withSteppedQuickLineRow(items, step, {
    isBlank: isBlankRxLine,
    holds: (item) => item.medicineName === medicine.name,
    newRow: () => rxLineFor(medicine, {}),
    blank: emptyRxLine,
  });
}
