import { seedCommon } from '@/shared/api/clinic/clinic-fixture-seed.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  NO_VISIT_CHECKS,
  type VisitRecord,
  type VisitStage,
} from '@/shared/api/clinic/visits-contracts.ts';

import { appointmentSeed } from './appointments.fixtures.ts';
import { must, ref, seedAt } from './refs.fixtures.ts';
import { staffRef } from './staff.fixtures.ts';

interface VisitRow {
  /** The booking's seq (`FLOOR_VISITS`). */
  appointment: number;
  stage: VisitStage;
  /** When the stage began (prototype clock). */
  since: string;
  /** The Rx approved at the visit (`PT_RX` seq). */
  prescription?: number;
  /** The visit's bill (`PY_INV` seq). */
  invoice?: number;
}

/**
 * The visits already past Waiting on Today's floor (`CARDS` H:3447–3458) —
 * D18's Visit for the bookings `FLOOR_VISITS` checked in: Sana with the
 * doctor ("In room 9 min" at 10:42), Dhruv in his laser session, Ishita at
 * checkout (her bill of 10:30, `PY_INV` #791) and Harsh at the pharmacy (his
 * Rx #501 approved at 10:05). Rhea, Nikhil and Meera are checked in with no
 * visit record yet — Waiting. No safety check is ticked: the prototype has
 * none for them.
 */
const VISIT_ROWS: readonly VisitRow[] = [
  { appointment: 2866, stage: 'with_doctor', since: 'Today · 10:33' },
  { appointment: 2865, stage: 'treatment', since: 'Today · 10:25' },
  { appointment: 2864, stage: 'checkout', since: 'Today · 10:30', invoice: 791 },
  { appointment: 2863, stage: 'pharmacy', since: 'Today · 10:05', prescription: 501 },
];

/** Today's visits as records (D18, plan-only — REPLACE_WITH_API). */
export function visitSeed(today: string = clinicToday()): VisitRecord[] {
  const bookings = new Map(appointmentSeed(today).map((row) => [row.id, row]));
  return VISIT_ROWS.map((row) => {
    const booking = must(
      bookings.get(ref.appointment(row.appointment)),
      `appointment #${row.appointment} of a visit`,
    );
    const since = seedAt(row.since, '10:00', today);
    return {
      ...seedCommon(since, staffRef('RS')),
      id: ref.visit(row.appointment),
      appointmentId: booking.id,
      patientId: booking.patientId,
      leadId: booking.leadId,
      stage: row.stage,
      stageAt: since,
      checks: NO_VISIT_CHECKS,
      prescriptionId: row.prescription ? ref.prescription(row.prescription) : null,
      treatmentId: null,
      invoiceId: row.invoice ? ref.invoice(row.invoice) : null,
      sharedAt: null,
    };
  });
}
