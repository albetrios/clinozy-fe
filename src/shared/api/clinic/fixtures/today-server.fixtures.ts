import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { validateClinicInput } from '@/shared/api/clinic/clinic-fixture-store.ts';
import { invoiceBalance } from '@/shared/api/clinic/clinic-money.ts';
import type {
  Invoice,
  LeadMessage,
  PatientPackage,
  Payment,
} from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { LEAD_CLOSED_STATUSES } from '@/shared/api/clinic/leads-contracts.ts';
import {
  type TodayEnquiry,
  type TodayFloorParams,
  todayFloorParamsSchema,
  type TodayFloorRow,
  todayLaneOf,
  type TodayPrescription,
} from '@/shared/api/clinic/today-contracts.ts';

import { listAppointmentsRange } from './appointments-server.fixtures.ts';
import { visitOfAppointment } from './visits-server.fixtures.ts';
import { clinicFixtures } from './world.fixtures.ts';

/**
 * Today's fixture server (REPLACE_WITH_API: `listTodayFloor`, S:1577, and the
 * Enquiries lane Appendix F asks for). The floor is today's bookings joined
 * with what each card shows; the lane rule is the one the room derives with
 * (`todayLaneOf`), so a booking off the floor never arrives. `today-api.ts`
 * loads this module on demand; when the API lands, it goes.
 */

const CLOSED_LEAD = new Set<string>(LEAD_CLOSED_STATUSES);

/** The invoice types a visit's own bill carries — the pharmacy bills apart (`today.md:264`). */
const VISIT_BILL_TYPES = new Set<Invoice['type']>(['clinic', 'consultation']);

/** What a patient owes across their invoices, and what is left on today's visit bill. */
function moneyOf(
  patientId: string | null,
  invoices: readonly Invoice[],
  payments: readonly Payment[],
  today: string,
): { dueTotal: number; toPay: number } {
  let dueTotal = 0;
  let toPay = 0;
  if (!patientId) return { dueTotal, toPay };
  for (const invoice of invoices) {
    if (invoice.patientId !== patientId) continue;
    const { due } = invoiceBalance(invoice, payments);
    dueTotal += due;
    if (invoice.date === today && VISIT_BILL_TYPES.has(invoice.type)) toPay += due;
  }
  return { dueTotal, toPay };
}

/** The package a booking uses a session of — else the patient's first open one. */
function packOf(
  row: AppointmentRow,
  packages: readonly PatientPackage[],
  today: string,
): TodayFloorRow['pack'] {
  const { patientId } = row.person;
  if (!patientId) return null;
  const open = packages.filter(
    (pack) =>
      pack.patientId === patientId &&
      pack.sessionsUsed < pack.sessionsTotal &&
      pack.validUntil >= today,
  );
  const pack =
    open.find((candidate) => candidate.id === row.patientPackageId) ??
    [...open].sort((a, b) => a.validUntil.localeCompare(b.validUntil))[0];
  return pack ? { used: pack.sessionsUsed, total: pack.sessionsTotal } : null;
}

/** The prescription written at this visit that no sale has filled yet. */
function unfilledRxOf(appointmentId: string): TodayPrescription | null {
  const filled = new Set(
    clinicFixtures.medicalSales
      .snapshot((sale) => sale.voidedAt === null && sale.prescriptionId !== null)
      .map((sale) => sale.prescriptionId),
  );
  const rx = clinicFixtures.prescriptions.snapshot(
    (candidate) => candidate.appointmentId === appointmentId && !filled.has(candidate.id),
  )[0];
  return rx ? { id: rx.id, approvedAt: rx.createdAt, items: rx.items.length } : null;
}

/** No booking of the same person was completed before this one. */
function isFirstVisit(row: AppointmentRow): boolean {
  const { patientId, leadId } = row.person;
  return !clinicFixtures.appointments
    .snapshot((other) =>
      patientId ? other.patientId === patientId : other.leadId === leadId,
    )
    .some(
      (other) =>
        other.id !== row.id &&
        other.status === 'completed' &&
        `${other.date} ${other.startTime}` < `${row.date} ${row.startTime}`,
    );
}

/**
 * Today's floor (`listTodayFloor`, S:1577): the day's bookings in the header's
 * branches, by start time, each with its visit, first-visit mark, money, pack
 * and unfilled Rx — the ones on the floor only (D20: no Done lane).
 */
export async function listTodayFloor(raw: unknown): Promise<TodayFloorRow[]> {
  const params: TodayFloorParams = validateClinicInput(todayFloorParamsSchema, raw);
  const today = params.date ?? clinicToday(new Date());
  const bookings = await listAppointmentsRange({
    from: today,
    to: today,
    status: 'all',
    branchIds: params.branchIds,
  });
  const invoices = clinicFixtures.invoices.snapshot();
  const payments = clinicFixtures.payments.snapshot();
  const packages = clinicFixtures.patientPackages.snapshot();
  return bookings.flatMap((row): TodayFloorRow[] => {
    const record = visitOfAppointment(row.id);
    const floor: TodayFloorRow = {
      ...row,
      visit: record
        ? { id: record.id, stage: record.stage, stageAt: record.stageAt }
        : null,
      firstVisit: isFirstVisit(row),
      ...moneyOf(row.person.patientId, invoices, payments, today),
      pack: packOf(row, packages, today),
      prescription: unfilledRxOf(row.id),
      // The schema keeps no allergies yet (Appendix F).
      allergies: [],
    };
    return todayLaneOf(floor) ? [floor] : [];
  });
}

/** A lead's latest message they sent (not the clinic's, not a system line). */
function latestInbound(
  messages: readonly LeadMessage[],
  leadId: string,
): LeadMessage | undefined {
  let latest: LeadMessage | undefined;
  for (const message of messages) {
    if (message.leadId !== leadId || message.isSystem) continue;
    if (message.direction !== 'received') continue;
    if (!latest || message.sentAt > latest.sentAt) latest = message;
  }
  return latest;
}

/**
 * The open enquiries that wrote in today (the Enquiries lane, Appendix F): a
 * lead — never a contact thread — still open and not yet a patient, whose
 * latest message arrived on the clinic day; by when they wrote.
 */
export async function listTodayEnquiries(raw: unknown): Promise<TodayEnquiry[]> {
  const params: TodayFloorParams = validateClinicInput(todayFloorParamsSchema, raw);
  const today = params.date ?? clinicToday(new Date());
  const messages = clinicFixtures.leadMessages.snapshot();
  return clinicFixtures.leads
    .snapshot(
      (lead) =>
        !lead.isContactThread &&
        lead.status !== null &&
        !CLOSED_LEAD.has(lead.status) &&
        lead.patientId === null &&
        (params.branchIds.length === 0 ||
          lead.branchId === null ||
          params.branchIds.includes(lead.branchId)),
    )
    .flatMap((lead): TodayEnquiry[] => {
      const asked = latestInbound(messages, lead.id);
      if (!asked || lead.status === null) return [];
      if (clinicToday(new Date(asked.sentAt)) !== today) return [];
      return [
        {
          id: lead.id,
          seq: lead.seq,
          name: lead.name,
          status: lead.status,
          source: lead.source,
          interests: lead.interests,
          askedAt: asked.sentAt,
          message: asked.body,
        },
      ];
    })
    .sort((a, b) => a.askedAt.localeCompare(b.askedAt));
}
