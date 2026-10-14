import type { PrescriptionRecord } from '@/shared/api/app/prescriptions-contracts.ts';

import { namedRxLines, type RxFormLine, rxFormLineOf } from './rx-form.ts';

/*
 * "Since last Rx" (feat-prescription-composer KICKOFF §6.5): the lines being
 * written against the patient's previous prescription, medicine by medicine
 * — by name, in any case. Pure: the sidekick renders the changes.
 */

/** How one medicine moved since the previous prescription. */
export type RxChange =
  | { kind: 'new'; name: string; now: RxFormLine }
  | { kind: 'changed'; name: string; before: RxFormLine; now: RxFormLine }
  | { kind: 'unchanged'; name: string; now: RxFormLine }
  | { kind: 'stopped'; name: string; before: RxFormLine };

/** The lines against the previous prescription. */
export interface RxChangesSince {
  previous: PrescriptionRecord;
  /** New, changed and unchanged in the form's order, then the stopped in the previous one's. */
  changes: RxChange[];
}

const keyOf = (name: string) => name.trim().toLowerCase();

/** The parts of a line a doctor changes: directions, quantity and the note. */
function sameDirections(before: RxFormLine, now: RxFormLine): boolean {
  return (
    before.dose === now.dose &&
    before.when === now.when &&
    before.where === now.where &&
    before.qty === now.qty &&
    before.remarks.trim() === now.remarks.trim()
  );
}

/**
 * The prescription a drawer compares with: a new one with the patient's
 * newest; an edit with the newest numbered below it. `history` is newest
 * first.
 */
export function previousRxOf(
  history: readonly PrescriptionRecord[],
  editing: PrescriptionRecord | null,
): PrescriptionRecord | undefined {
  if (!editing) return history[0];
  return history.find(
    (prescription) => prescription.id !== editing.id && prescription.seq < editing.seq,
  );
}

/**
 * Each medicine of the form against `previous` — New (not in it), Changed
 * (its dose, timing, place, quantity or note differ), Unchanged — and each
 * of its medicines the form no longer holds, Stopped. A name the form holds
 * twice is compared once; its second line reads New. Null without a previous
 * prescription.
 */
export function rxChangesSince(
  lines: readonly RxFormLine[],
  previous: PrescriptionRecord | undefined,
): RxChangesSince | null {
  if (!previous) return null;
  const before = new Map<string, RxFormLine>();
  for (const item of previous.items) {
    const key = keyOf(item.medicineName);
    if (!before.has(key)) before.set(key, rxFormLineOf(item));
  }
  const seen = new Set<string>();
  const changes: RxChange[] = [];
  for (const now of namedRxLines(lines)) {
    const key = keyOf(now.medicineName);
    const name = now.medicineName.trim();
    const was = seen.has(key) ? undefined : before.get(key);
    seen.add(key);
    if (!was) changes.push({ kind: 'new', name, now });
    else if (sameDirections(was, now)) changes.push({ kind: 'unchanged', name, now });
    else changes.push({ kind: 'changed', name, before: was, now });
  }
  for (const [key, was] of before) {
    if (!seen.has(key))
      changes.push({ kind: 'stopped', name: was.medicineName.trim(), before: was });
  }
  return { previous, changes };
}

/** How many of each kind — the sidekick's folded summary. */
export function rxChangeCounts(changes: readonly RxChange[]) {
  const count = (kind: RxChange['kind']) =>
    changes.filter((change) => change.kind === kind).length;
  return {
    new: count('new'),
    changed: count('changed'),
    unchanged: count('unchanged'),
    stopped: count('stopped'),
  };
}
