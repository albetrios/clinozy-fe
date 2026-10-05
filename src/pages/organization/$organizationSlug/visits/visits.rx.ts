import type {
  Prescription,
  PrescriptionItem,
} from '@/shared/api/clinic/clinic-schema.ts';

import type { VisitDraftLine } from './store/useVisitDraftStore/index.ts';

/** A dose tap cycles 0 → 1 → 2 → 0 (the Rx drawer's, `patient-file.md:111`). */
const RX_DOSE_MAX = 2;

/** The dose slots of a line, in the day's order. */
export const RX_DOSE_SLOTS = ['doseMorning', 'doseAfternoon', 'doseNight'] as const;

let lineSequence = 0;

/** A stable key for a new draft line. */
function nextKey(): string {
  lineSequence += 1;
  return `line-${lineSequence}`;
}

/** A draft line, not yet reviewed. */
export function draftLine(item: PrescriptionItem): VisitDraftLine {
  return { key: nextKey(), item, reviewed: false };
}

/**
 * "Copy 12 Aug prescription" (`today.md:86`): the last Rx's lines, each one
 * unreviewed — the doctor reviews every line again.
 */
export function copiedLines(prescription: Prescription): VisitDraftLine[] {
  return prescription.items.map((item) => draftLine({ ...item }));
}

/**
 * An "Add" chip's line (`today.md:86`): the medicine with the dose and
 * quantity it was last prescribed with — this patient's, else the clinic's —
 * or "Doctor to set", quantity 1, when it never was.
 */
export function addedLine(
  name: string,
  medicineId: string | null,
  last: PrescriptionItem | null,
): VisitDraftLine {
  if (last) return draftLine({ ...last, medicineId, medicineName: name });
  return draftLine({
    medicineId,
    medicineName: name,
    doseMorning: 0,
    doseAfternoon: 0,
    doseNight: 0,
    sos: false,
    meal: null,
    timing: null,
    timingText: null,
    bodyPart: null,
    bodyPartText: null,
    qty: 1,
    remarks: null,
  });
}

/** A line says how it is taken: a dose in some slot, SOS, or a timing. */
export function hasDose(item: PrescriptionItem): boolean {
  return (
    item.doseMorning + item.doseAfternoon + item.doseNight > 0 ||
    item.sos ||
    item.timing !== null ||
    Boolean(item.timingText)
  );
}

/** "1-0-1" — morning, afternoon, night; empty when no slot has a dose. */
export function doseText(item: PrescriptionItem): string {
  const slots = RX_DOSE_SLOTS.map((slot) => item[slot]);
  return slots.some((dose) => dose > 0) ? slots.join('-') : '';
}

/** The next dose of a slot's tap: 0 → 1 → 2 → 0. */
export function nextDose(dose: number): number {
  return dose >= RX_DOSE_MAX ? 0 : dose + 1;
}

/**
 * Approve's readiness (`today.md:88`; KICKOFF §6.13): at least one line and
 * every line reviewed. `pending` is how many still need a review.
 */
export function approveReadiness(lines: readonly VisitDraftLine[]): {
  ready: boolean;
  pending: number;
} {
  const pending = lines.filter((line) => !line.reviewed).length;
  return { ready: lines.length > 0 && pending === 0, pending };
}
