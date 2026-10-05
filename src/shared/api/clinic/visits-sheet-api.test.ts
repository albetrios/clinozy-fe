import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { invoiceBalance } from './clinic-money.ts';
import type { PrescriptionItem } from './clinic-schema.ts';
import { clinicInstant } from './clinic-time.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  approveVisitRx,
  completeVisit,
  createVisitBill,
  fetchOpenVisit,
  fetchVisit,
  fetchVisitCatalog,
  receiveVisitPayment,
  recordVisitSession,
  restoreVisitSession,
  reverseVisitSession,
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

const NOTE = {
  complaint: 'Review of dark patches',
  findings: 'Patches lighter',
  diagnoses: ['Melasma'],
  plan: 'Continue laser',
};

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

describe('approveVisitRx (Consult & Rx)', () => {
  it('writes the Rx on the booking, keeps the note and moves a consult on to Checkout', async () => {
    const { visit, prescription } = await approveVisitRx({
      visitId: visitOf(2866),
      note: NOTE,
      items: [line('Tretinoin 0.025% cream 20 g')],
      language: 'en',
    });
    expect(prescription).toMatchObject({
      appointmentId: appointmentOf(2866),
      date: TODAY,
    });
    expect(visit).toMatchObject({
      stage: 'checkout',
      note: NOTE,
      prescriptionId: prescription.id,
    });
    expect((await fetchVisit(visitOf(2866))).rxToFill).toBe(true);
  });

  it('moves a visit with a session due on to Treatment', async () => {
    const { visit } = await approveVisitRx({
      visitId: visitOf(2865),
      note: NOTE,
      items: [line('Sunscreen SPF 50')],
      language: 'en',
    });
    expect(visit.stage).toBe('treatment');
  });

  it('approves once per visit, and never for a visit already completed', async () => {
    const input = {
      visitId: visitOf(2866),
      note: NOTE,
      items: [line('A')],
      language: 'en' as const,
    };
    await approveVisitRx(input);
    expect(await failureOf(approveVisitRx(input))).toMatchObject({
      status: 409,
      code: 'already_approved',
    });
    await completeVisit({ visitId: visitOf(2866) });
    expect(await failureOf(approveVisitRx(input))).toMatchObject({
      status: 409,
      code: 'visit_done',
    });
  });

  it('refuses a visit with no patient record', async () => {
    const lead = await clinicFixtures.visits.create({
      appointmentId: null,
      patientId: null,
      leadId: ref.lead(2385),
      stage: 'with_doctor',
      stageAt: new Date().toISOString(),
      checks: { consent: false, photos: false, allergies: false },
      note: null,
      prescriptionId: null,
      treatmentId: null,
      invoiceId: null,
      sharedAt: null,
    });
    expect(
      await failureOf(
        approveVisitRx({
          visitId: lead.id,
          note: NOTE,
          items: [line('A')],
          language: 'en',
        }),
      ),
    ).toMatchObject({ status: 409, code: 'needs_patient' });
  });
});

describe('recordVisitSession and its reverse (Treatment)', () => {
  it('records the package’s next session once and moves the visit to Checkout', async () => {
    const { visit, treatment } = await recordVisitSession({
      visitId: visitOf(2865),
      params: { power: '20 J/cm²', machine: 'GentleMax' },
      bodyParts: ['legs'],
    });
    expect(treatment).toMatchObject({
      sessionNo: 4,
      aftercareCall: 'in_2_days',
      bodyParts: ['legs'],
      appointmentId: appointmentOf(2865),
    });
    expect(treatment.params).toMatchObject({ power: '20 J/cm²', skinType: 'Type IV' });
    expect(visit.stage).toBe('checkout');
    const detail = await fetchVisit(visitOf(2865));
    expect(detail.pack?.sessionsUsed).toBe(4);
    expect(detail.treatment?.id).toBe(treatment.id);
    expect(
      await failureOf(
        recordVisitSession({ visitId: visitOf(2865), params: {}, bodyParts: [] }),
      ),
    ).toMatchObject({ status: 409, code: 'already_recorded' });
  });

  it('reverses the session with a reason — the package session back — and restores it', async () => {
    const { treatment } = await recordVisitSession({
      visitId: visitOf(2865),
      params: {},
      bodyParts: [],
    });
    await reverseVisitSession({ visitId: visitOf(2865), reason: 'mistake', note: null });
    let detail = await fetchVisit(visitOf(2865));
    expect(detail.treatment).toBeNull();
    expect(detail.pack?.sessionsUsed).toBe(3);
    await restoreVisitSession(visitOf(2865), treatment.id);
    detail = await fetchVisit(visitOf(2865));
    expect(detail.treatment?.id).toBe(treatment.id);
    expect(detail.pack?.sessionsUsed).toBe(4);
  });

  it('has nothing to reverse before a session is recorded', async () => {
    expect(
      await failureOf(
        reverseVisitSession({ visitId: visitOf(2865), reason: 'mistake', note: null }),
      ),
    ).toMatchObject({ status: 409, code: 'no_session' });
  });
});

describe('createVisitBill and receiveVisitPayment (Checkout)', () => {
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

  it('refuses to bill a visit with nothing on it, and to receive before the bill', async () => {
    const varun = clinicFixtures.patients.snapshot((row) => row.firstName === 'Varun')[0];
    const visit = await startVisit({ patientId: varun?.id ?? '' });
    expect(await failureOf(createVisitBill({ visitId: visit.id }))).toMatchObject({
      status: 422,
      detail: 'Nothing to bill',
    });
    expect(
      await failureOf(
        receiveVisitPayment({ visitId: visit.id, amount: 100, mode: 'upi' }),
      ),
    ).toMatchObject({ status: 409, code: 'not_billed' });
  });

  it('receives the bill in full and the visit completes — off the floor', async () => {
    const receipt = await receiveVisitPayment({
      visitId: visitOf(2864),
      amount: 371_700,
      mode: 'upi',
    });
    expect(receipt).toMatchObject({ amount: 371_700, stage: 'done' });
    const invoice = await clinicFixtures.invoices.get(ref.invoice(791));
    expect(invoiceBalance(invoice, clinicFixtures.payments.snapshot()).due).toBe(0);
    expect((await clinicFixtures.appointments.get(appointmentOf(2864))).status).toBe(
      'completed',
    );
  });

  it('sends a visit with an Rx to fill on to the pharmacy, and leaves a part payment due', async () => {
    await approveVisitRx({
      visitId: visitOf(2866),
      note: NOTE,
      items: [line('A')],
      language: 'en',
    });
    const { invoice } = await createVisitBill({ visitId: visitOf(2866) });
    const due = invoiceBalance(invoice, clinicFixtures.payments.snapshot()).due;
    const receipt = await receiveVisitPayment({
      visitId: visitOf(2866),
      amount: Math.floor(due / 2),
      mode: 'cash',
    });
    expect(receipt.stage).toBe('pharmacy');
    const after = await clinicFixtures.invoices.get(invoice.id);
    expect(invoiceBalance(after, clinicFixtures.payments.snapshot()).due).toBe(
      due - Math.floor(due / 2),
    );
  });

  it('refuses more than is owed', async () => {
    expect(
      await failureOf(
        receiveVisitPayment({ visitId: visitOf(2864), amount: 9_999_900, mode: 'card' }),
      ),
    ).toMatchObject({ status: 422, detail: 'More than is owed' });
  });
});

describe('completeVisit, shareVisit and the catalog', () => {
  it('completes the visit and its booking, and names the package session it used', async () => {
    await recordVisitSession({ visitId: visitOf(2865), params: {}, bodyParts: [] });
    const done = await completeVisit({ visitId: visitOf(2865) });
    expect(done).toMatchObject({ packageSessionUsed: true, followUpDate: null });
    expect(done.visit.stage).toBe('done');
    expect((await clinicFixtures.appointments.get(appointmentOf(2865))).status).toBe(
      'completed',
    );
  });

  it('sets the patient’s follow-up from the visit Rx', async () => {
    const { prescription } = await approveVisitRx({
      visitId: visitOf(2866),
      note: NOTE,
      items: [line('A')],
      language: 'en',
    });
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
