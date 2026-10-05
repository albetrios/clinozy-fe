import type {
  BodyPart,
  Prescription,
  PrescriptionItem,
  RxMeal,
  RxTiming,
  Tone,
} from '@/shared/api/clinic/clinic-schema.ts';
import type {
  PrescriptionInput,
  RxCatalogMedicine,
} from '@/shared/api/clinic/prescriptions-api.ts';
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
  qty: number;
  /** The dashed note line. */
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

/** A saved line as the row holds it. */
export function rxFormLineOf(item: PrescriptionItem): RxFormLine {
  const dose: RxDose | undefined = item.sos
    ? 'sos'
    : [item.doseMorning, item.doseAfternoon, item.doseNight];
  return {
    medicineId: item.medicineId,
    medicineName: item.medicineName,
    dose: rxDoseValue(dose),
    when: whenOf(item),
    where: whereOf(item),
    qty: item.qty,
    remarks: item.remarks ?? '',
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

/** A row as the contract holds it. */
export function rxItemOf(line: RxFormLine): PrescriptionItem {
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
    remarks: textOrNull(line.remarks),
  };
}

/** The lines that name a medicine — blank rows are left out (H:4808). */
export function namedRxLines(items: readonly RxFormLine[]): RxFormLine[] {
  return items.filter((item) => item.medicineName.trim() !== '');
}

// ── The form ──

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
export function rxFormOf(prescription: Prescription): RxFormValues {
  return {
    date: prescription.date,
    doctorId: prescription.doctorId,
    items: prescription.items.length
      ? prescription.items.map(rxFormLineOf)
      : [emptyRxLine()],
    advice: prescription.advice ?? '',
    labReport: prescription.labReport ?? '',
    procedureToday: prescription.procedureToday ?? '',
  };
}

/** The write a save sends: the named lines and the notes, blanks as null. */
export function rxInputOf(
  values: RxFormValues,
  context: {
    patientId: string;
    appointmentId: string | null;
    followUpDate: string | null;
  },
): PrescriptionInput {
  return {
    patientId: context.patientId,
    appointmentId: context.appointmentId,
    doctorId: values.doctorId ?? '',
    date: values.date,
    items: namedRxLines(values.items).map(rxItemOf),
    advice: textOrNull(values.advice),
    labReport: textOrNull(values.labReport),
    procedureToday: textOrNull(values.procedureToday),
    followUpDate: context.followUpDate,
  };
}

// ── Quantities ──

/** The letters a word starts with ("days," → "days"). */
const LEADING_WORD = /^[\p{L}\p{M}]+/u;

/**
 * The days a note names — "10 days", "5d", or a day word of the drawer's own
 * language ("10 Tage") — or null (H:4807).
 */
export function rxDaysIn(
  remarks: string,
  dayWords: readonly string[] = [],
): number | null {
  const units = new Set(
    ['d', 'day', 'days', ...dayWords].map((word) => word.trim().toLowerCase()),
  );
  // ["10", " days, apply…"]: each number, then what follows it.
  const parts = remarks.toLowerCase().split(/(\d+)/);
  for (let index = 1; index < parts.length; index += 2) {
    const word = LEADING_WORD.exec((parts[index + 1] ?? '').trimStart())?.[0];
    if (word && units.has(word)) return Number(parts[index]);
  }
  return null;
}

/**
 * The quantity a note and a dose call for (H:4807): days × doses a day, when
 * the note names days and the dose is taps; else null — keep the quantity.
 */
export function rxQtyFor(
  dose: string,
  remarks: string,
  dayWords: readonly string[] = [],
): number | null {
  const days = rxDaysIn(remarks, dayWords);
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
 * else the patient's last line of it; the quantity the line set, else the
 * last one's, else 1; "10 days" in the note when days were typed.
 */
export function rxLineFor(
  medicine: RxLineMedicine,
  values: RxLineValues,
  daysNote: (days: number) => string,
): RxFormLine {
  const last = medicine.last ? rxFormLineOf(medicine.last) : null;
  return {
    ...emptyRxLine(),
    medicineId: medicine.medicineId,
    medicineName: medicine.name,
    dose: last?.dose ?? '',
    when: last?.when ?? '',
    where: last?.where ?? '',
    ...shorthandFields(values),
    qty: values.qty ?? last?.qty ?? 1,
    remarks: values.days ? daysNote(values.days) : '',
  };
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
}: {
  prescription: Prescription | null;
  today: string;
  doctorId: string | null;
  medicines: readonly string[];
  catalog: readonly RxLineMedicine[];
}): RxFormValues {
  if (prescription) return rxFormOf(prescription);
  return rxFormWithMedicines(newRxForm(today, doctorId), medicines, catalog);
}

/**
 * A new prescription opened from a smart note (AMBER A-F5): a line for each
 * medicine it named — the store's, with its last dosage, when the catalogue
 * carries the name; else the name as typed (the save maps it, `S:378`).
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
      rxLineFor(known ?? { name, medicineId: null, last: null }, {}, () => ''),
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
  daysNote: (days: number) => string,
): RxFormLine[] {
  return withSteppedQuickLineRow(items, step, {
    isBlank: isBlankRxLine,
    holds: (item) => item.medicineName === medicine.name,
    newRow: () => rxLineFor(medicine, {}, daysNote),
    blank: emptyRxLine,
  });
}

// ── Kits ──

/** A kit's line (H:4810). */
interface RxKitLine {
  name: string;
  dose: string;
  when: string;
  where: string;
  qty: number;
  /** A note in the drawer's words ("Reapply every 3 h"). */
  remark?: 'reapply';
}

/** One Quick fill kit (H:4810; `patient-file.md:283`). */
export interface RxKit {
  id: 'hairFall' | 'postPeel' | 'pigmentation';
  tone: Tone;
  lines: readonly RxKitLine[];
  /** The kit's advice for the Notes ("Avoid sun and scrubs for 48 h"). */
  advice?: 'avoidSun';
}

/** The three kits, verbatim from the design (H:4810). */
export const RX_KITS: readonly RxKit[] = [
  {
    id: 'hairFall',
    tone: 'lav',
    lines: [
      { name: 'Flubolt 400', dose: '0-0-1', when: 'after', where: '', qty: 8 },
      {
        name: 'Clonix-B Lotion',
        dose: '',
        when: 'morning_night',
        where: 'scalp',
        qty: 1,
      },
      {
        name: 'Densyl-AD Shampoo',
        dose: '',
        when: 'thrice_week',
        where: 'scalp',
        qty: 1,
      },
    ],
  },
  {
    id: 'postPeel',
    tone: 'blush',
    lines: [
      {
        name: 'Sunscreen SPF 50',
        dose: '1-1-0',
        when: 'morning',
        where: 'face',
        qty: 1,
        remark: 'reapply',
      },
    ],
    advice: 'avoidSun',
  },
  {
    id: 'pigmentation',
    tone: 'butter',
    lines: [
      { name: 'Tranexa 500', dose: '1-0-1', when: 'after', where: '', qty: 20 },
      { name: 'Sunscreen SPF 50', dose: '1-1-0', when: 'morning', where: 'face', qty: 1 },
    ],
  },
];

/** A kit's lines, each matched to the store's medicine by name where it has one. */
export function rxKitLines(
  kit: RxKit,
  catalog: readonly Pick<RxCatalogMedicine, 'name' | 'medicineId'>[],
  remark: (key: 'reapply') => string,
): RxFormLine[] {
  return kit.lines.map((line) => ({
    medicineId:
      catalog.find((medicine) => medicine.name.toLowerCase() === line.name.toLowerCase())
        ?.medicineId ?? null,
    medicineName: line.name,
    dose: line.dose,
    when: line.when,
    where: line.where,
    qty: line.qty,
    remarks: line.remark ? remark(line.remark) : '',
  }));
}
