import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import {
  clinicHttpError,
  compareText,
  type FixtureChange,
  recordFixtureChange,
  validateClinicInput,
} from '@/shared/api/clinic/clinic-fixture-store.ts';
import { invoiceBalance, invoiceTotals } from '@/shared/api/clinic/clinic-money.ts';
import type { Prescription, Treatment } from '@/shared/api/clinic/clinic-schema.ts';
import {
  clinicClockTime,
  clinicInstant,
  clinicToday,
} from '@/shared/api/clinic/clinic-time.ts';
import type {
  InvoiceLineInput,
  InvoiceRecord,
} from '@/shared/api/clinic/invoices-contracts.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import {
  effectivePrice,
  invoiceLineRate,
} from '@/shared/api/clinic/offerings-pricing.ts';
import { receivePayment } from '@/shared/api/clinic/payments-api.ts';
import {
  createPrescription,
  type PrescriptionInput,
} from '@/shared/api/clinic/prescriptions-api.ts';
import {
  createTreatment,
  deleteTreatment,
  restoreTreatment,
  type TreatmentInput,
} from '@/shared/api/clinic/treatments-api.ts';
import {
  type ApproveVisitRxInput,
  approveVisitRxInputSchema,
  canMoveVisit,
  type CompleteVisitInput,
  completeVisitInputSchema,
  type CreateVisitBillInput,
  createVisitBillInputSchema,
  NO_VISIT_CHECKS,
  type ReceiveVisitPaymentInput,
  receiveVisitPaymentInputSchema,
  type RecordVisitSessionInput,
  recordVisitSessionInputSchema,
  type ReverseVisitSessionInput,
  reverseVisitSessionInputSchema,
  type SetVisitChecksInput,
  setVisitChecksInputSchema,
  type SetVisitStageInput,
  setVisitStageInputSchema,
  type ShareVisitInput,
  shareVisitInputSchema,
  stageAfter,
  type StartVisitInput,
  startVisitInputSchema,
  type VisitBillLine,
  type VisitCatalog,
  type VisitChange,
  type VisitCompletion,
  type VisitDetail,
  type VisitPack,
  type VisitReceipt,
  type VisitRecord,
  type VisitStage,
} from '@/shared/api/clinic/visits-contracts.ts';

import { getAppointment, setAppointmentStatus } from './appointments-server.fixtures.ts';
import { createInvoice } from './invoices-server.fixtures.ts';
import { clinicFixtures, onClinicFixturesReset } from './world.fixtures.ts';

/**
 * The Visit fixture server (D18; Appendix F "a Visit entity … `getVisit`,
 * `setVisitStage`, `completeVisit` … Undo of a check-in" — REPLACE_WITH_API).
 * A checked-in booking's visit moves through the stage machine
 * (`VISIT_STAGE_FLOW`); the first move starts its record, and so does "Start
 * visit" in the file. Each tab's write is one operation that writes its record
 * through the domain's own write (the Rx, the session, the invoice, the
 * receipt) and leaves the visit in the stage those records make it (`S:352`).
 * `visits-api.ts` loads this module on demand; when the API lands, it goes.
 */

const undoLog = new Map<string, FixtureChange>();
onClinicFixturesReset(() => undoLog.clear());

/** The stages as the server's refusals name them. */
const STAGE_TEXT: Readonly<Record<VisitStage, string>> = {
  waiting: 'Waiting',
  with_doctor: 'With doctor',
  treatment: 'Treatment',
  checkout: 'Checkout',
  pharmacy: 'Pharmacy',
  done: 'Done',
};

/** A write that needs a patient record (`appointments.guards.needsPatient`). */
const NEEDS_PATIENT = 'Create the patient record first';

/** A booking's visit record, or undefined before its first move. */
export function visitOfAppointment(appointmentId: string): VisitRecord | undefined {
  return clinicFixtures.visits.snapshot(
    (visit) => visit.appointmentId === appointmentId,
  )[0];
}

/** A visit record, a 404 "Visit not found" when it is unknown or gone. */
const visitOf = (id: string) => clinicFixtures.visits.get(id);

/** The visit's patient, or the 409 every record write answers without one. */
function patientIdOf(visit: VisitRecord): string {
  if (!visit.patientId) throw clinicHttpError(409, 'needs_patient', NEEDS_PATIENT);
  return visit.patientId;
}

/** Refuse a write to a visit already completed. */
function refuseDone(visit: VisitRecord): void {
  if (visit.stage === 'done') {
    throw clinicHttpError(409, 'visit_done', 'This visit is already completed');
  }
}

/** A clinic day of an instant. */
const dayOf = (instant: string) => clinicToday(new Date(instant));

/**
 * The records written at a visit: its booking's, or — for a visit with no
 * booking — the patient's written that day since it began (a drawer opened
 * from the file's flow keeps no visit link).
 */
function atVisit<
  T extends { patientId: string; appointmentId: string | null; createdAt: string },
>(visit: VisitRecord, row: T): boolean {
  if (row.patientId !== visit.patientId) return false;
  if (visit.appointmentId !== null && row.appointmentId === visit.appointmentId)
    return true;
  return (
    row.createdAt >= visit.createdAt && dayOf(row.createdAt) === dayOf(visit.createdAt)
  );
}

/** Newest first by when it was written. */
const newest = <T extends { createdAt: string }>(a: T, b: T) =>
  compareText(b.createdAt, a.createdAt);

/** The visit's live record of a kind: the one it links, else the newest written at it. */
function linkedOrAt<
  T extends {
    id: string;
    patientId: string;
    appointmentId: string | null;
    createdAt: string;
  },
>(visit: VisitRecord, rows: readonly T[], linkedId: string | null): T | null {
  const linked = linkedId ? rows.find((row) => row.id === linkedId) : undefined;
  if (linked) return linked;
  return [...rows].filter((row) => atVisit(visit, row)).sort(newest)[0] ?? null;
}

/** The package a visit uses: its booking's, else the patient's open one ending first. */
function packOf(
  visit: VisitRecord,
  booking: AppointmentRow | null,
  treatment: Treatment | null,
): VisitPack | null {
  if (!visit.patientId) return null;
  const today = clinicToday();
  const packages = clinicFixtures.patientPackages.snapshot(
    (pack) => pack.patientId === visit.patientId,
  );
  const wanted = treatment?.packageId ?? booking?.patientPackageId ?? null;
  const open = packages.filter(
    (pack) => pack.sessionsUsed < pack.sessionsTotal && pack.validUntil >= today,
  );
  const pack =
    packages.find((candidate) => candidate.id === wanted) ??
    [...open].sort((a, b) => compareText(a.validUntil, b.validUntil))[0];
  if (!pack) return null;
  const offering = clinicFixtures.offerings.snapshot(
    (row) => row.id === pack.offeringId,
  )[0];
  return {
    id: pack.id,
    name: offering?.name ?? '',
    sessionsTotal: pack.sessionsTotal,
    sessionsUsed: pack.sessionsUsed,
    soldOn: dayOf(pack.createdAt),
    validUntil: pack.validUntil,
  };
}

/** A booking's offering: its own, else the one its service names. */
function offeringOfBooking(booking: AppointmentRow | null): OfferingRecord | null {
  if (!booking) return null;
  const offerings = clinicFixtures.offerings.snapshot((row) => row.active);
  const byId = offerings.find((row) => row.id === booking.offeringId);
  if (byId) return byId;
  const label = booking.serviceLabel.toLowerCase();
  const byName = offerings.find((row) => row.name.toLowerCase() === label);
  if (byName) return byName;
  // A consult the desk booked by its type bills the clinic's consultation fee.
  return booking.type === 'consultation' || booking.type === 'follow_up'
    ? (offerings.find((row) => row.category === 'consultation') ?? null)
    : null;
}

/** One offering as the bill carries it: its effective price (offers applied), GST as the offering's. */
function offeringLine(offering: OfferingRecord, branchId: string | null): VisitBillLine {
  const price = effectivePrice(
    offering,
    branchId,
    clinicFixtures.offers.snapshot(),
  ).final;
  return {
    name: offering.name,
    offeringId: offering.id,
    qty: 1,
    rate: invoiceLineRate(price, offering.gstPct, offering.gstInclusive),
    discountPct: 0,
    gstPct: offering.gstPct,
    fromPack: false,
  };
}

/**
 * The bill's lines, pulled from the visit (`today.md:263`): the booking's
 * service, and the session — ₹0 "From pack" when a package carries it. Never
 * the medicines: Medical bills the Rx apart (`today.md:264`).
 */
function billLinesOf(
  booking: AppointmentRow | null,
  treatment: Treatment | null,
  pack: VisitPack | null,
): VisitBillLine[] {
  const service = offeringOfBooking(booking);
  const sessionVisit = treatment !== null || isSessionBooking(booking);
  const session = sessionVisit ? sessionLine(booking, treatment, pack, service) : null;
  const lines: VisitBillLine[] = [];
  // A session the package carries stands in for the booking's own charge.
  if (service && !(isSessionBooking(booking) && session?.fromPack)) {
    lines.push(offeringLine(service, booking?.branchId ?? null));
  }
  if (session) lines.push(session);
  return lines;
}

/** A booking for a session — a treatment, or a package's session. */
function isSessionBooking(booking: AppointmentRow | null): boolean {
  return booking?.type === 'treatment' || booking?.type === 'package_session';
}

/** The ₹0 line of a session a package carries: "<name> · session <k> of <m>". */
function packSessionLine(
  booking: AppointmentRow | null,
  treatment: Treatment | null,
  pack: VisitPack,
): VisitBillLine {
  const sessionNo = treatment?.sessionNo ?? pack.sessionsUsed + 1;
  const name = treatment?.name ?? booking?.serviceLabel ?? pack.name;
  return {
    name: `${name} · session ${sessionNo} of ${pack.sessionsTotal}`,
    offeringId: null,
    qty: 1,
    rate: 0,
    discountPct: 0,
    gstPct: 0,
    fromPack: true,
  };
}

/**
 * The session's line: ₹0 "From pack · no charge" when a package carries it,
 * else the session's own offering when it is not the booking's.
 */
function sessionLine(
  booking: AppointmentRow | null,
  treatment: Treatment | null,
  pack: VisitPack | null,
  service: OfferingRecord | null,
): VisitBillLine | null {
  const fromPack = treatment ? treatment.packageId !== null : pack !== null;
  if (fromPack && pack) return packSessionLine(booking, treatment, pack);
  if (!treatment?.offeringId || treatment.offeringId === service?.id) return null;
  const offeringId = treatment.offeringId;
  const offering = clinicFixtures.offerings.snapshot((row) => row.id === offeringId)[0];
  return offering ? offeringLine(offering, booking?.branchId ?? null) : null;
}

/** An invoice's lines as the bill shows them. */
function linesOfInvoice(invoice: InvoiceRecord): VisitBillLine[] {
  return invoice.items.map((item) => ({
    name: item.name,
    offeringId: item.offeringId,
    qty: item.qty,
    rate: item.rate,
    discountPct: item.discountPct,
    gstPct: item.gstPct,
    fromPack: item.rate === 0,
  }));
}

/** A sale has filled the Rx (Medical's "Prescriptions to fill" drops it). */
const isFilled = (prescriptionId: string) =>
  clinicFixtures.medicalSales.snapshot(
    (sale) => sale.voidedAt === null && sale.prescriptionId === prescriptionId,
  ).length > 0;

/** What the patient still owes on invoices other than this visit's, and the oldest of them. */
function previousDueOf(visit: VisitRecord): VisitDetail['previousDue'] {
  if (!visit.patientId) return { amount: 0, invoice: null };
  const payments = clinicFixtures.payments.snapshot();
  const open = clinicFixtures.invoices
    .snapshot(
      (invoice) =>
        invoice.patientId === visit.patientId && invoice.id !== visit.invoiceId,
    )
    .map((invoice) => ({ invoice, due: invoiceBalance(invoice, payments).due }))
    .filter((row) => row.due > 0)
    .sort(
      (a, b) =>
        compareText(a.invoice.date, b.invoice.date) || a.invoice.seq - b.invoice.seq,
    );
  const oldest = open[0]?.invoice;
  return {
    amount: open.reduce((sum, row) => sum + row.due, 0),
    invoice: oldest ? { id: oldest.id, seq: oldest.seq, type: oldest.type } : null,
  };
}

/** The stages a session can still be due in — from Checkout on, the session question is closed. */
const SESSION_STAGES: ReadonlySet<VisitStage> = new Set([
  'waiting',
  'with_doctor',
  'treatment',
]);

/**
 * A session is due at the visit (`today.md:160`: "a visit with a pending
 * session"): none recorded yet, before Checkout, and the booking is a
 * treatment — or not a first consultation for a patient holding a package.
 */
function sessionDueAt(
  visit: VisitRecord,
  booking: AppointmentRow | null,
  treatment: Treatment | null,
  pack: VisitPack | null,
): boolean {
  if (treatment !== null || !SESSION_STAGES.has(visit.stage)) return false;
  return (
    isSessionBooking(booking) ||
    (pack !== null && booking !== null && booking.type !== 'consultation')
  );
}

/** The patient's own records a visit reads — none for an enquiry's visit. */
function recordsOf({ patientId }: VisitRecord) {
  if (!patientId) return { patient: undefined, prescriptions: [], treatments: [] };
  return {
    patient: clinicFixtures.patients.snapshot((row) => row.id === patientId)[0],
    prescriptions: clinicFixtures.prescriptions.snapshot(
      (row) => row.patientId === patientId,
    ),
    treatments: clinicFixtures.treatments.snapshot((row) => row.patientId === patientId),
  };
}

/** The patient as the sheet's header and History read them. */
function visitPatientOf(
  patient: ReturnType<typeof recordsOf>['patient'],
): VisitDetail['patient'] {
  if (!patient) return null;
  const { id, seq, firstName, lastName, gender, dateOfBirth, phone, consents } = patient;
  return {
    id,
    seq,
    firstName,
    lastName,
    gender,
    dateOfBirth,
    phone,
    consents,
    leadId: patient.leadId,
    createdAt: patient.createdAt,
  };
}

/** The session before today's — "Last session" and the settings it remembers. */
function lastTreatmentOf(
  visit: VisitRecord,
  treatments: readonly Treatment[],
  treatment: Treatment | null,
): Treatment | null {
  const before = treatment?.performedAt ?? visit.createdAt;
  const earlier = treatments.filter(
    (row) => row.id !== treatment?.id && row.performedAt < before,
  );
  return earlier.sort((a, b) => compareText(b.performedAt, a.performedAt))[0] ?? null;
}

/** The last Rx before this visit's — "Copy <date> prescription". */
function lastPrescriptionOf(
  visit: VisitRecord,
  prescriptions: readonly Prescription[],
  prescription: Prescription | null,
): Prescription | null {
  const earlier = prescriptions.filter(
    (row) => row.id !== prescription?.id && !atVisit(visit, row),
  );
  return earlier.sort((a, b) => compareText(b.date, a.date) || b.seq - a.seq)[0] ?? null;
}

/** The visit's bill: its invoice's lines and due once billed, else the lines it pulls and their total. */
function billOf(
  visit: VisitRecord,
  booking: AppointmentRow | null,
  treatment: Treatment | null,
  pack: VisitPack | null,
): Pick<VisitDetail, 'invoice' | 'billLines' | 'billDue'> {
  const invoice = visit.invoiceId
    ? clinicFixtures.invoices.snapshot((row) => row.id === visit.invoiceId)[0]
    : undefined;
  if (invoice) {
    const { due } = invoiceBalance(invoice, clinicFixtures.payments.snapshot());
    return { invoice, billLines: linesOfInvoice(invoice), billDue: due };
  }
  const billLines = billLinesOf(booking, treatment, pack);
  const { bill } = invoiceTotals({ items: billLines, overallDiscount: 0 });
  return { invoice: null, billLines, billDue: bill };
}

/** The visit as the Visit sheet and the file's flow read it (`getVisit`). */
async function detailOf(visit: VisitRecord): Promise<VisitDetail> {
  const booking = visit.appointmentId ? await getAppointment(visit.appointmentId) : null;
  const { patient, prescriptions, treatments } = recordsOf(visit);
  const prescription = linkedOrAt(visit, prescriptions, visit.prescriptionId);
  const treatment = linkedOrAt(visit, treatments, visit.treatmentId);
  const pack = packOf(visit, booking, treatment);
  const patientName = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ');
  return {
    visit,
    booking,
    person: {
      name: booking?.person.name ?? patientName,
      patientId: visit.patientId,
      leadId: visit.leadId,
    },
    patient: visitPatientOf(patient),
    pack,
    sessionDue: sessionDueAt(visit, booking, treatment, pack),
    treatment,
    lastTreatment: lastTreatmentOf(visit, treatments, treatment),
    prescription,
    lastPrescription: lastPrescriptionOf(visit, prescriptions, prescription),
    rxToFill: prescription !== null && !isFilled(prescription.id),
    ...billOf(visit, booking, treatment, pack),
    previousDue: previousDueOf(visit),
  };
}

/** One visit with what its tabs read — a 404 "Visit not found" when it is unknown or gone (`getVisit`). */
export async function getVisit(id: string): Promise<VisitDetail> {
  return detailOf(await visitOf(id));
}

/** The patient's open visit (not done), today's first — the file's Start visit / Resume. */
export async function getOpenVisit(patientId: string): Promise<VisitRecord | null> {
  const today = clinicToday();
  return (
    clinicFixtures.visits
      .snapshot(
        (visit) =>
          visit.patientId === patientId &&
          visit.stage !== 'done' &&
          dayOf(visit.createdAt) === today,
      )
      .sort(newest)[0] ?? null
  );
}

/** Update a visit, moving its stage (and its clock) only when the stage changes. */
async function saveVisit(
  visit: VisitRecord,
  patch: Partial<Omit<VisitRecord, 'stageAt'>>,
): Promise<VisitRecord> {
  const stage = patch.stage ?? visit.stage;
  return clinicFixtures.visits.update(visit.id, {
    ...patch,
    ...(stage === visit.stage ? {} : { stageAt: new Date().toISOString() }),
  });
}

// ── Writes ──

/**
 * Move a checked-in booking's visit (`setVisitStage`): 409 unless the booking
 * is checked in and the stage machine allows the move; the first move creates
 * the visit (Waiting until then). Answers the visit and an Undo token.
 */
export async function setVisitStage(raw: SetVisitStageInput): Promise<VisitChange> {
  const input = validateClinicInput(setVisitStageInputSchema, raw);
  const now = new Date().toISOString();
  const booking = await clinicFixtures.appointments.get(input.appointmentId);
  if (booking.status !== 'checked_in') {
    throw clinicHttpError(409, 'not_checked_in', 'Check them in first');
  }
  const current = visitOfAppointment(booking.id);
  const from = current?.stage ?? 'waiting';
  if (!canMoveVisit(from, input.stage)) {
    throw clinicHttpError(
      409,
      'invalid_transition',
      `${STAGE_TEXT[from]} can’t move to ${STAGE_TEXT[input.stage]}`,
    );
  }
  const change = recordFixtureChange();
  const visit = current
    ? await change.update(clinicFixtures.visits, current.id, {
        stage: input.stage,
        stageAt: now,
      })
    : await change.create(clinicFixtures.visits, {
        ...newVisitFields(booking.id, booking.patientId, booking.leadId),
        stage: input.stage,
        stageAt: now,
      });
  const undoToken = crypto.randomUUID();
  undoLog.set(undoToken, change);
  return { visit, undoToken };
}

/** Undo a stage write — the visit goes back to where it was (each token works once). */
export async function undoVisitChange(undoToken: string): Promise<void> {
  const change = undoLog.get(undoToken);
  if (!change) {
    throw clinicHttpError(409, 'undo_unavailable', 'This change can no longer be undone');
  }
  undoLog.delete(undoToken);
  await change.reverse();
}

/** A new visit's own fields: waiting, nothing checked or written yet. */
function newVisitFields(
  appointmentId: string | null,
  patientId: string | null,
  leadId: string | null,
) {
  return {
    appointmentId,
    patientId,
    leadId,
    stage: 'waiting' as const,
    stageAt: new Date().toISOString(),
    checks: NO_VISIT_CHECKS,
    note: null,
    prescriptionId: null,
    treatmentId: null,
    invoiceId: null,
    sharedAt: null,
  };
}

/**
 * "Start visit" in the file (D18): the patient's open visit; else today's
 * booking's — checked in first when it is not yet, which starts the visit;
 * else a visit with no booking (the Visit model's call, L-49).
 */
export async function startVisit(raw: StartVisitInput): Promise<VisitRecord> {
  const { patientId } = validateClinicInput(startVisitInputSchema, raw);
  await clinicFixtures.patients.get(patientId);
  const open = await getOpenVisit(patientId);
  if (open) return open;
  const today = clinicToday();
  const booking = clinicFixtures.appointments
    .snapshot(
      (row) =>
        row.patientId === patientId &&
        row.date === today &&
        (row.status === 'scheduled' ||
          row.status === 'confirmed' ||
          row.status === 'checked_in'),
    )
    .sort((a, b) => compareText(a.startTime, b.startTime))[0];
  if (booking) {
    if (booking.status !== 'checked_in') {
      await setAppointmentStatus({ id: booking.id, status: 'checked_in' });
    }
    const existing = visitOfAppointment(booking.id);
    if (existing) return existing;
    return clinicFixtures.visits.create(
      newVisitFields(booking.id, patientId, booking.leadId),
    );
  }
  return clinicFixtures.visits.create(newVisitFields(null, patientId, null));
}

/** The file's step 1: tick or untick the safety checks. */
export async function setVisitChecks(raw: SetVisitChecksInput): Promise<VisitRecord> {
  const input = validateClinicInput(setVisitChecksInputSchema, raw);
  const visit = await visitOf(input.visitId);
  refuseDone(visit);
  return saveVisit(visit, { checks: { ...visit.checks, ...input.checks } });
}

/** Who signs an Rx written at a visit: its booking's doctor, else the patient's, else the first doctor. */
function doctorOf(visit: VisitRecord, booking: AppointmentRow | null): string {
  if (booking?.doctorId) return booking.doctorId;
  const patient = clinicFixtures.patients.snapshot(
    (row) => row.id === visit.patientId,
  )[0];
  if (patient?.doctorId) return patient.doctorId;
  const doctor = clinicFixtures.staff.snapshot(
    (user) => user.active && user.roles.includes('doctor'),
  )[0];
  if (!doctor) throw clinicHttpError(409, 'no_doctor', 'Add a doctor to the team first');
  return doctor.id;
}

/**
 * Approve (`today.md:78–93`): `createPrescription` with the visit's booking
 * (`S:1641`) — the Rx joins Medical's "Prescriptions to fill" — and the consult
 * note on the visit; the visit moves to Treatment when a session is due, else
 * to Checkout (never back). One Rx per visit (409 after the first).
 */
export async function approveVisitRx(
  raw: ApproveVisitRxInput,
): Promise<{ visit: VisitRecord; prescription: Prescription }> {
  const input = validateClinicInput(approveVisitRxInputSchema, raw);
  const visit = await visitOf(input.visitId);
  refuseDone(visit);
  const patientId = patientIdOf(visit);
  const detail = await detailOf(visit);
  if (detail.prescription) {
    throw clinicHttpError(
      409,
      'already_approved',
      'This visit’s prescription is already approved',
    );
  }
  const rx: PrescriptionInput = {
    patientId,
    appointmentId: visit.appointmentId,
    doctorId: doctorOf(visit, detail.booking),
    date: clinicToday(),
    items: input.items,
    advice: input.note.plan || null,
    labReport: null,
    procedureToday: null,
    followUpDate: null,
  };
  const prescription = await createPrescription(rx);
  const saved = await saveVisit(visit, {
    note: input.note,
    prescriptionId: prescription.id,
    stage: stageAfter(visit.stage, detail.sessionDue ? 'treatment' : 'checkout'),
  });
  return { visit: saved, prescription };
}

/** The session number today's session is: the package's next, else the last one's next. */
function nextSessionNo(detail: VisitDetail): number {
  if (detail.pack)
    return Math.min(detail.pack.sessionsUsed + 1, detail.pack.sessionsTotal);
  return (detail.lastTreatment?.sessionNo ?? 0) + 1;
}

/** What today's session is — its offering, name and template: the booking's, else the last session's. */
function sessionKindOf({
  booking,
  lastTreatment,
  pack,
}: VisitDetail): Pick<TreatmentInput, 'offeringId' | 'name' | 'template'> {
  return {
    offeringId: offeringOfBooking(booking)?.id ?? lastTreatment?.offeringId ?? null,
    name: lastTreatment?.name ?? booking?.serviceLabel ?? pack?.name ?? 'Treatment',
    template: lastTreatment?.template ?? 'skin',
  };
}

/** Who does today's session: the booking's team, else the last session's. */
function sessionTeamOf({
  booking,
  lastTreatment,
}: VisitDetail): Pick<TreatmentInput, 'doctorId' | 'therapistId'> {
  return {
    doctorId: booking?.doctorId ?? lastTreatment?.doctorId ?? null,
    therapistId: booking?.therapistId ?? lastTreatment?.therapistId ?? null,
  };
}

/**
 * Complete session (`today.md:95–108`): `createTreatment` with the package and
 * the session number (`S:1642`) — exactly one package session; its day-2
 * aftercare call follows from it (the task rules, `S:739`). The visit moves to
 * Checkout. One session per visit (409 after the first).
 */
export async function recordVisitSession(
  raw: RecordVisitSessionInput,
): Promise<{ visit: VisitRecord; treatment: Treatment }> {
  const input = validateClinicInput(recordVisitSessionInputSchema, raw);
  const visit = await visitOf(input.visitId);
  refuseDone(visit);
  const patientId = patientIdOf(visit);
  const detail = await detailOf(visit);
  if (detail.treatment) {
    throw clinicHttpError(409, 'already_recorded', 'Today’s session is already recorded');
  }
  const settings = Object.fromEntries(
    Object.entries(input.params).filter(([, value]) => value.trim() !== ''),
  );
  const treatment = await createTreatment({
    patientId,
    appointmentId: visit.appointmentId,
    ...sessionKindOf(detail),
    ...sessionTeamOf(detail),
    performedAt: new Date().toISOString(),
    bodyParts: input.bodyParts,
    sessionNo: nextSessionNo(detail),
    params: { ...detail.lastTreatment?.params, ...settings },
    remark: null,
    aftercareCall: 'in_2_days',
    packageId: detail.pack?.id ?? null,
  });
  const saved = await saveVisit(visit, {
    treatmentId: treatment.id,
    stage: stageAfter(visit.stage, 'checkout'),
  });
  return { visit: saved, treatment };
}

/**
 * Reverse with reason (`S:1546`): today's session soft-deleted with the reason
 * confirm's choice — its package session given back; the visit keeps its
 * stage. Answers the session, for the toast's Undo.
 */
export async function reverseVisitSession(
  raw: ReverseVisitSessionInput,
): Promise<Treatment> {
  const input = validateClinicInput(reverseVisitSessionInputSchema, raw);
  const visit = await visitOf(input.visitId);
  refuseDone(visit);
  const detail = await detailOf(visit);
  if (!detail.treatment) {
    throw clinicHttpError(409, 'no_session', 'No session is recorded at this visit');
  }
  const removed = await deleteTreatment(
    detail.treatment.id,
    input.reason,
    input.note || null,
  );
  await saveVisit(visit, { treatmentId: null });
  return removed;
}

/** The Undo of a Reverse: the session back on the visit, its package session used again. */
export async function restoreVisitSession(
  visitId: string,
  treatmentId: string,
): Promise<Treatment> {
  const visit = await visitOf(visitId);
  const restored = await restoreTreatment(treatmentId);
  await saveVisit(visit, { treatmentId: restored.id });
  return restored;
}

/**
 * Create bill (`today.md:263`) and the flow's "Create invoice from visit":
 * `createInvoice` of the clinic type with the visit's lines (`S:1716`) — one
 * bill per visit (409 after the first, "Changes now go through Cancel bill or
 * Credit note"); "Nothing to bill" (422) when the visit has no line.
 */
export async function createVisitBill(
  raw: CreateVisitBillInput,
): Promise<{ visit: VisitRecord; invoice: InvoiceRecord }> {
  const input = validateClinicInput(createVisitBillInputSchema, raw);
  const visit = await visitOf(input.visitId);
  refuseDone(visit);
  const patientId = patientIdOf(visit);
  const detail = await detailOf(visit);
  if (detail.invoice) {
    throw clinicHttpError(409, 'already_billed', 'This visit is already billed');
  }
  if (detail.billLines.length === 0) {
    throw clinicHttpError(422, 'validation', 'Nothing to bill', {
      items: ['Nothing to bill'],
    });
  }
  const patient = await clinicFixtures.patients.get(patientId);
  const { booking, treatment } = detail;
  const team = [booking?.doctorId, treatment?.therapistId ?? booking?.therapistId].filter(
    (id): id is string => Boolean(id),
  );
  const items: InvoiceLineInput[] = detail.billLines.map((line) => ({
    offeringId: line.offeringId,
    medicineId: null,
    name: line.name,
    packSize: null,
    qty: line.qty,
    rate: line.rate,
    discountPct: line.discountPct,
    gstPct: line.gstPct,
  }));
  const { detail: saved } = await createInvoice({
    type: 'clinic',
    branchId: booking?.branchId ?? patient.homeBranchId,
    patientId,
    medicalContactId: null,
    leadId: null,
    teamIds: [...new Set(team)],
    items,
    overallDiscount: 0,
    date: clinicToday(),
    remark: 'From today’s visit',
    prescriptionId: null,
    paidNow: [],
  });
  const updated = await saveVisit(visit, { invoiceId: saved.invoice.id });
  return { visit: updated, invoice: saved.invoice };
}

/**
 * Close a visit (D18): the stage it ends in and, with a patient, its booking
 * completed — a completed booking needs a patient record (the status guard).
 */
async function closeVisit(visit: VisitRecord, stage: VisitStage): Promise<VisitRecord> {
  if (visit.appointmentId && visit.patientId) {
    const booking = await clinicFixtures.appointments.get(visit.appointmentId);
    if (booking.status === 'checked_in') {
      await setAppointmentStatus({ id: booking.id, status: 'completed' });
    }
  }
  return saveVisit(visit, { stage });
}

/**
 * Receive (`today.md:110–121`): the amount in one mode, recorded as receipts
 * (`receivePayment`, `S:1708`) against the visit's bill first and then the
 * older dues, oldest first — never above what is owed (422). Once confirmed,
 * the visit goes to the pharmacy when its Rx is still to fill, else it is done;
 * either way its booking completes. A part payment leaves a due — the
 * invoices' payment-due task follows (server).
 */
export async function receiveVisitPayment(
  raw: ReceiveVisitPaymentInput,
): Promise<VisitReceipt> {
  const input = validateClinicInput(receiveVisitPaymentInputSchema, raw);
  const visit = await visitOf(input.visitId);
  refuseDone(visit);
  const patientId = patientIdOf(visit);
  const detail = await detailOf(visit);
  if (!detail.invoice) {
    throw clinicHttpError(409, 'not_billed', 'Create the bill first');
  }
  const payments = clinicFixtures.payments.snapshot();
  const owed = [
    detail.invoice,
    ...clinicFixtures.invoices
      .snapshot(
        (invoice) => invoice.patientId === patientId && invoice.id !== detail.invoice?.id,
      )
      .sort((a, b) => compareText(a.date, b.date) || a.seq - b.seq),
  ]
    .map((invoice) => ({ invoice, due: invoiceBalance(invoice, payments).due }))
    .filter((row) => row.due > 0);
  const total = owed.reduce((sum, row) => sum + row.due, 0);
  if (input.amount > total) {
    const message = 'More than is owed';
    throw clinicHttpError(422, 'validation', message, { amount: [message] });
  }
  let left = input.amount;
  let firstSeq: number | null = null;
  for (const { invoice, due } of owed) {
    if (left <= 0) break;
    const amount = Math.min(left, due);
    const receipt = await receivePayment({
      branchId: invoice.branchId,
      patientId,
      invoiceId: invoice.id,
      splits: [{ mode: input.mode, amount }],
      reference: null,
      note: null,
    });
    firstSeq ??= receipt.seq;
    left -= amount;
  }
  const stage: VisitStage = detail.rxToFill ? 'pharmacy' : 'done';
  const closed = await closeVisit(visit, stageAfter(visit.stage, stage));
  return { paymentSeq: firstSeq ?? 0, amount: input.amount, stage: closed.stage };
}

/**
 * "✓ Complete visit" (`completeVisit`, Appendix F): the visit done and its
 * booking completed; a session today out of a package used that session (it
 * was counted when recorded), and the visit's Rx follow-up becomes the
 * patient's. Answers what happened, for the toast.
 */
export async function completeVisit(raw: CompleteVisitInput): Promise<VisitCompletion> {
  const input = validateClinicInput(completeVisitInputSchema, raw);
  const visit = await visitOf(input.visitId);
  refuseDone(visit);
  const detail = await detailOf(visit);
  const followUpDate = detail.prescription?.followUpDate ?? null;
  if (followUpDate && visit.patientId) {
    await clinicFixtures.patients.update(visit.patientId, {
      followUpAt: clinicInstant(followUpDate, clinicClockTime(new Date())),
    });
  }
  const closed = await closeVisit(visit, 'done');
  return {
    visit: closed,
    packageSessionUsed: detail.treatment?.packageId != null,
    followUpDate,
  };
}

/** "Share Rx, invoice & photos" (WhatsApp, plan-only): when they went out. */
export async function shareVisit(raw: ShareVisitInput): Promise<VisitRecord> {
  const input = validateClinicInput(shareVisitInputSchema, raw);
  const visit = await visitOf(input.visitId);
  return saveVisit(visit, { sharedAt: new Date().toISOString() });
}

/**
 * The clinic's diagnosis list and Rx kits (Appendix F: a diagnosis catalogue
 * and per-doctor Rx quick-adds) — the prototype's seeds (`DX` H:3500, the
 * file's kits H:4876).
 */
export async function getVisitCatalog(): Promise<VisitCatalog> {
  const line = (
    medicineName: string,
    dose: [number, number, number],
    qty: number,
    meal: 'after' | null,
    timing: 'morning' | 'night' | 'morning_night' | null,
  ) => ({
    medicineId:
      clinicFixtures.medicines.snapshot(
        (medicine) => medicine.name.toLowerCase() === medicineName.toLowerCase(),
      )[0]?.id ?? null,
    medicineName,
    doseMorning: dose[0],
    doseAfternoon: dose[1],
    doseNight: dose[2],
    sos: false,
    meal,
    timing,
    timingText: null,
    bodyPart: null,
    bodyPartText: null,
    qty,
    remarks: null,
  });
  return {
    diagnoses: ['Melasma', 'Post-acne marks', 'Acne vulgaris', 'Hair reduction review'],
    kits: [
      {
        key: 'hairFall',
        name: 'Hair fall kit',
        tone: 'lav',
        items: [
          line('Flubolt 400', [0, 0, 1], 8, 'after', null),
          line('Clonix-B Lotion', [0, 0, 0], 1, null, 'morning_night'),
        ],
      },
      {
        key: 'postPeel',
        name: 'Post-peel kit',
        tone: 'blush',
        items: [line('Sunscreen SPF 50', [1, 1, 0], 1, null, 'morning')],
      },
      {
        key: 'pigmentation',
        name: 'Pigmentation kit',
        tone: 'butter',
        items: [line('Tranexa 500', [1, 0, 1], 20, 'after', null)],
      },
    ],
  };
}
