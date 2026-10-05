import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { invoiceBalance } from './clinic-money.ts';
import type { PrescriptionItem } from './clinic-schema.ts';
import { clinicInstant } from './clinic-time.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import { receivePayment } from './payments-api.ts';
import { createPrescription } from './prescriptions-api.ts';
import { createTreatment } from './treatments-api.ts';
import {
  completeVisit,
  createVisitBill,
  fetchOpenVisit,
  fetchVisit,
  fetchVisitCatalog,
  setVisitChecks,
  shareVisit,
  startVisit,
  visitQueryKeys,
} from './visits-api.ts';

const TODAY = '2026-10-03';

/** The rejection a call ends in: its status and the envelope's code and detail. */
async function failureOf(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!isHttpError(error)) throw new Error('expected an HTTP error');
  const body = (error.data as { error: { code: string; detail: string } }).error;
  return { status: error.status, code: body.code, detail: body.detail };
}

/** A reviewed Rx line. */
const line = (medicineName: string): PrescriptionItem => ({
  medicineId: null,
  medicineName,
  doseMorning: 1,
  doseAfternoon: 0,
  doseNight: 1,
  sos: false,
  meal: null,
  timing: null,
  timingText: null,
  bodyPart: null,
  bodyPartText: null,
  qty: 1,
  remarks: null,
});

const visitOf = (seq: number) => ref.visit(seq);
const appointmentOf = (seq: number) => ref.appointment(seq);
const patientOfVisit = async (seq: number) =>
  (await fetchVisit(visitOf(seq))).person.patientId ?? '';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:42')));
  resetClinicFixtures();
});
afterEach(() => {
  resetClinicFixtures();
  vi.useRealTimers();
});

describe('getVisit (D18; Appendix F, fixture)', () => {
  it('reads a visit with its booking, its package, the session due and the last session', async () => {
    const detail = await fetchVisit(visitOf(2865));
    expect(detail.person.name).toBe('Dhruv Patel');
    expect(detail.booking?.id).toBe(appointmentOf(2865));
    expect(detail.patient).toMatchObject({ firstName: 'Dhruv', lastName: 'Patel' });
    expect(detail.pack).toMatchObject({ sessionsTotal: 10, sessionsUsed: 3 });
    expect(detail.sessionDue).toBe(true);
    expect(detail.treatment).toBeNull();
    expect(detail.lastTreatment).toMatchObject({
      sessionNo: 3,
      name: 'Laser hair reduction',
    });
    // A pack carries today's session: ₹0, no charge.
    expect(detail.billLines).toEqual([
      expect.objectContaining({ fromPack: true, rate: 0, qty: 1 }),
    ]);
    expect(detail.billDue).toBe(0);
  });

  it('reads a checkout visit with its bill and what it owes', async () => {
    const detail = await fetchVisit(visitOf(2864));
    expect(detail.invoice?.seq).toBe(791);
    expect(detail.billLines).toEqual([
      expect.objectContaining({ name: 'Chemical peel', discountPct: 10, gstPct: 18 }),
    ]);
    expect(detail.billDue).toBe(371_700);
    expect(detail.sessionDue).toBe(false);
  });

  it('reads the pharmacy visit’s Rx as still to fill', async () => {
    const detail = await fetchVisit(visitOf(2863));
    expect(detail.prescription?.seq).toBe(501);
    expect(detail.rxToFill).toBe(true);
  });

  it('answers 404 for a visit it does not know', async () => {
    expect(await failureOf(fetchVisit(ref.visit(1)))).toMatchObject({ status: 404 });
  });

  it('keys every visit read under the visits', () => {
    expect(visitQueryKeys.detail('v')).toEqual(['clinic', 'visits', 'detail', 'v']);
    expect(visitQueryKeys.open('p')).toEqual(['clinic', 'visits', 'open', 'p']);
    expect(visitQueryKeys.catalog()).toEqual(['clinic', 'visits', 'catalog']);
  });
});

describe('startVisit and the open visit', () => {
  it('opens the patient’s open visit rather than starting a second', async () => {
    const patientId = await patientOfVisit(2866);
    const visit = await startVisit({ patientId });
    expect(visit.id).toBe(visitOf(2866));
    expect((await fetchOpenVisit(patientId))?.id).toBe(visitOf(2866));
  });

  it('starts today’s checked-in booking’s visit, waiting', async () => {
    const meera = clinicFixtures.appointments.snapshot(
      (row) => row.id === appointmentOf(2847),
    )[0];
    const visit = await startVisit({ patientId: meera?.patientId ?? '' });
    expect(visit).toMatchObject({ appointmentId: appointmentOf(2847), stage: 'waiting' });
  });

  it('checks in today’s booking that is not yet, which starts the visit', async () => {
    const priti = clinicFixtures.appointments.snapshot(
      (row) => row.id === appointmentOf(2848),
    )[0];
    const visit = await startVisit({ patientId: priti?.patientId ?? '' });
    expect(visit.appointmentId).toBe(appointmentOf(2848));
    expect((await clinicFixtures.appointments.get(appointmentOf(2848))).status).toBe(
      'checked_in',
    );
  });

  it('starts a visit with no booking when the patient has none today', async () => {
    const varun = clinicFixtures.patients.snapshot((row) => row.firstName === 'Varun')[0];
    const visit = await startVisit({ patientId: varun?.id ?? '' });
    expect(visit).toMatchObject({
      appointmentId: null,
      patientId: varun?.id,
      stage: 'waiting',
    });
    expect((await fetchVisit(visit.id)).booking).toBeNull();
  });

  it('has no open visit for a patient who is not in today', async () => {
    const varun = clinicFixtures.patients.snapshot((row) => row.firstName === 'Varun')[0];
    expect(await fetchOpenVisit(varun?.id ?? '')).toBeNull();
  });

  it('ticks and unticks the safety checks', async () => {
    await setVisitChecks({ visitId: visitOf(2866), checks: { consent: true } });
    const visit = await setVisitChecks({
      visitId: visitOf(2866),
      checks: { photos: true },
    });
    expect(visit.checks).toEqual({ consent: true, photos: true, allergies: false });
  });
});

/** An Rx written at a visit — through the patient's own write, as the file's drawer does. */
async function prescribeAt(seq: number, name = 'Tretinoin 0.025% cream 20 g') {
  const detail = await fetchVisit(visitOf(seq));
  const doctor = clinicFixtures.staff.snapshot(
    (user) => user.active && user.roles.includes('doctor'),
  )[0];
  return createPrescription({
    patientId: detail.person.patientId ?? '',
    appointmentId: appointmentOf(seq),
    doctorId: detail.booking?.doctorId ?? doctor?.id ?? '',
    date: TODAY,
    items: [line(name)],
    advice: null,
    labReport: null,
    procedureToday: null,
    followUpDate: null,
  });
}

/** Today's session at a visit — the package's next — as the Treatment drawer writes it. */
async function sessionAt(seq: number) {
  const before = await fetchVisit(visitOf(seq));
  return createTreatment({
    patientId: before.person.patientId ?? '',
    appointmentId: appointmentOf(seq),
    offeringId: before.lastTreatment?.offeringId ?? null,
    name: before.lastTreatment?.name ?? 'Treatment',
    template: 'skin',
    performedAt: new Date().toISOString(),
    doctorId: null,
    therapistId: null,
    bodyParts: [],
    sessionNo: (before.pack?.sessionsUsed ?? 0) + 1,
    params: {},
    remark: null,
    aftercareCall: 'in_2_days',
    packageId: before.pack?.id ?? null,
  });
}

const stageOf = async (seq: number) => (await fetchVisit(visitOf(seq))).visit.stage;

describe('the records written at a visit move it on (D18, S:352; L-64)', () => {
  it('an Rx at the consult moves it to Checkout, and it is still to fill', async () => {
    expect(await stageOf(2866)).toBe('with_doctor');
    const prescription = await prescribeAt(2866);
    expect(prescription.appointmentId).toBe(appointmentOf(2866));
    expect(await stageOf(2866)).toBe('checkout');
    expect((await fetchVisit(visitOf(2866))).rxToFill).toBe(true);
  });

  it('an Rx never moves a visit back — a visit with a session due stays in Treatment', async () => {
    expect(await stageOf(2865)).toBe('treatment');
    await prescribeAt(2865, 'Sunscreen SPF 50');
    expect(await stageOf(2865)).toBe('treatment');
  });

  it('today’s session moves the visit to Checkout and uses the package session', async () => {
    await sessionAt(2865);
    const after = await fetchVisit(visitOf(2865));
    expect(after.visit.stage).toBe('checkout');
    expect(after.treatment).not.toBeNull();
    expect(after.pack?.sessionsUsed).toBe(4);
  });

  it('a receipt at Checkout sends a visit with an Rx to fill to the pharmacy', async () => {
    await prescribeAt(2866);
    const { invoice } = await createVisitBill({ visitId: visitOf(2866) });
    const due = invoiceBalance(invoice, clinicFixtures.payments.snapshot()).due;
    await receivePayment({
      branchId: invoice.branchId,
      patientId: await patientOfVisit(2866),
      invoiceId: invoice.id,
      splits: [{ mode: 'cash', amount: Math.floor(due / 2) }],
      reference: null,
      note: null,
    });
    expect(await stageOf(2866)).toBe('pharmacy');
  });

  it('a receipt at Checkout with nothing to fill leaves the visit for “Complete visit”', async () => {
    const invoice = await clinicFixtures.invoices.get(ref.invoice(791));
    await receivePayment({
      branchId: invoice.branchId,
      patientId: await patientOfVisit(2864),
      invoiceId: invoice.id,
      splits: [{ mode: 'upi', amount: 371_700 }],
      reference: null,
      note: null,
    });
    expect(await stageOf(2864)).toBe('checkout');
    await completeVisit({ visitId: visitOf(2864) });
    expect(await stageOf(2864)).toBe('done');
    expect((await clinicFixtures.appointments.get(appointmentOf(2864))).status).toBe(
      'completed',
    );
  });

  it('moves nothing for a visit already completed', async () => {
    await completeVisit({ visitId: visitOf(2866) });
    await prescribeAt(2866);
    expect(await stageOf(2866)).toBe('done');
  });
});

describe('createVisitBill (the flow’s “Create invoice from visit”)', () => {
  it('bills the visit’s lines once', async () => {
    const { visit, invoice } = await createVisitBill({ visitId: visitOf(2866) });
    expect(invoice).toMatchObject({ type: 'clinic', remark: 'From today’s visit' });
    expect(invoice.items.length).toBeGreaterThan(0);
    expect(visit.invoiceId).toBe(invoice.id);
    expect(await failureOf(createVisitBill({ visitId: visitOf(2866) }))).toMatchObject({
      status: 409,
      code: 'already_billed',
    });
  });

  it('refuses to bill a visit with nothing on it', async () => {
    const varun = clinicFixtures.patients.snapshot((row) => row.firstName === 'Varun')[0];
    const visit = await startVisit({ patientId: varun?.id ?? '' });
    expect(await failureOf(createVisitBill({ visitId: visit.id }))).toMatchObject({
      status: 422,
      detail: 'Nothing to bill',
    });
  });
});

describe('completeVisit, shareVisit and the catalog', () => {
  it('completes the visit and its booking, and names the package session it used', async () => {
    await sessionAt(2865);
    const done = await completeVisit({ visitId: visitOf(2865) });
    expect(done).toMatchObject({ packageSessionUsed: true, followUpDate: null });
    expect(done.visit.stage).toBe('done');
    expect((await clinicFixtures.appointments.get(appointmentOf(2865))).status).toBe(
      'completed',
    );
  });

  it('sets the patient’s follow-up from the visit Rx', async () => {
    const prescription = await prescribeAt(2866, 'A');
    await clinicFixtures.prescriptions.update(prescription.id, {
      followUpDate: '2026-10-26',
    });
    const done = await completeVisit({ visitId: visitOf(2866) });
    expect(done.followUpDate).toBe('2026-10-26');
    const patientId = done.visit.patientId ?? '';
    expect((await clinicFixtures.patients.get(patientId)).followUpAt?.slice(0, 10)).toBe(
      '2026-10-26',
    );
  });

  it('marks the Rx, invoice and photos sent', async () => {
    const visit = await shareVisit({ visitId: visitOf(2866) });
    expect(visit.sharedAt).toBe(new Date(clinicInstant(TODAY, '10:42')).toISOString());
  });

  it('serves the clinic’s diagnoses and Rx kits', async () => {
    const catalog = await fetchVisitCatalog();
    expect(catalog.diagnoses).toContain('Melasma');
    expect(catalog.kits.map((kit) => kit.name)).toEqual([
      'Hair fall kit',
      'Post-peel kit',
      'Pigmentation kit',
    ]);
    expect(catalog.kits.every((kit) => kit.items.length > 0)).toBe(true);
  });
});
