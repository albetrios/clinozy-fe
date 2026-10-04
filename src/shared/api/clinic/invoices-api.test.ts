import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { invoicePaid } from './clinic-money.ts';
import { branchRef, MAIN_BRANCH } from './fixtures/organization.fixtures.ts';
import { patientRef } from './fixtures/patients.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { staffRef } from './fixtures/staff.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  addMedicalContact,
  createInvoice,
  createSale,
  deleteInvoice,
  fetchInvoice,
  fetchInvoicePresets,
  fetchOftenBilled,
  invoiceQueryKeys,
  restoreInvoice,
  searchSaleCustomers,
  setMedicalContactPhone,
  updateInvoice,
} from './invoices-api.ts';
import type { InvoiceInput, InvoiceLineInput } from './invoices-contracts.ts';

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');
const TODAY = '2026-10-03';
const MAIN = branchRef(MAIN_BRANCH);
const DHARTI = patientRef('Dharti Galani');
const RHEA = patientRef('Rhea Shah');
const DOCTOR = staffRef('DD');

/** The rejection a call ends in, so its status and fields can be read. */
async function failureOf(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!isHttpError(error)) throw new Error('expected an HTTP error');
  const body = (
    error.data as { error: { code: string; detail: string; fields?: object } }
  ).error;
  return { status: error.status, ...body };
}

const offering = (seq: number) => {
  const found = clinicFixtures.offerings.snapshot().find((row) => row.seq === seq);
  if (!found) throw new Error(`offering #${seq}`);
  return found;
};

const medicine = (seq: number) => {
  const found = clinicFixtures.medicines.snapshot().find((row) => row.seq === seq);
  if (!found) throw new Error(`medicine #${seq}`);
  return found;
};

/** An offering's line at a rate, no discount. */
const offeringLine = (seq: number, overrides: Partial<InvoiceLineInput> = {}) => {
  const row = offering(seq);
  return {
    offeringId: row.id,
    medicineId: null,
    name: row.name,
    packSize: null,
    qty: 1,
    rate: row.offerPrice ?? row.price,
    discountPct: 0,
    gstPct: row.gstPct,
    ...overrides,
  } satisfies InvoiceLineInput;
};

/** A medicine's line at its MRP, GST included (D45). */
const medicineLine = (seq: number, qty: number) => {
  const row = medicine(seq);
  return {
    offeringId: null,
    medicineId: row.id,
    name: row.name,
    packSize: null,
    qty,
    rate: row.mrp,
    discountPct: 0,
    gstPct: 0,
  } satisfies InvoiceLineInput;
};

const clinicInvoice = (overrides: Partial<InvoiceInput> = {}): InvoiceInput => ({
  type: 'clinic',
  branchId: MAIN,
  patientId: DHARTI,
  medicalContactId: null,
  leadId: null,
  teamIds: [DOCTOR],
  items: [offeringLine(271)],
  overallDiscount: 0,
  date: TODAY,
  remark: null,
  prescriptionId: null,
  paidNow: [],
  ...overrides,
});

const sale = (overrides: Partial<InvoiceInput> = {}): InvoiceInput =>
  clinicInvoice({ type: 'medical', patientId: RHEA, teamIds: [], ...overrides });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('invoiceQueryKeys', () => {
  it('nests every key under ["clinic", "invoices"], so one invalidation reaches them all', () => {
    for (const key of [
      invoiceQueryKeys.detail('X'),
      invoiceQueryKeys.presets('P'),
      invoiceQueryKeys.oftenBilled('medical'),
      invoiceQueryKeys.customers(),
    ]) {
      expect(key.slice(0, 2)).toEqual(['clinic', 'invoices']);
    }
  });
});

describe('createInvoice (S:1716)', () => {
  it('stores the invoice and answers its totals, party and balance', async () => {
    const { detail } = await createInvoice(
      clinicInvoice({ items: [offeringLine(271, { qty: 2 })], remark: 'Two sittings' }),
    );
    expect(detail.invoice).toMatchObject({
      type: 'clinic',
      patientId: DHARTI,
      teamIds: [DOCTOR],
      remark: 'Two sittings',
      saleId: null,
    });
    expect(detail.invoice.seq).toBeGreaterThan(791);
    expect(detail.party).toMatchObject({ kind: 'patient', name: 'Dharti Galani' });
    expect(detail.balance).toEqual({
      bill: 600_000,
      paid: 0,
      due: 600_000,
      status: 'unpaid',
    });
    expect((await fetchInvoice(detail.invoice.id)).invoice.id).toBe(detail.invoice.id);
  });

  it('records "Paid now" as one receipt with a split per mode (Appendix F)', async () => {
    const { detail } = await createInvoice(
      clinicInvoice({
        paidNow: [
          { mode: 'cash', amount: 100_000 },
          { mode: 'upi', amount: 200_000 },
        ],
      }),
    );
    expect(detail.payments).toHaveLength(1);
    expect(detail.payments[0]).toMatchObject({
      direction: 'received',
      kind: 'receipt',
      amount: 300_000,
      patientId: DHARTI,
      invoiceId: detail.invoice.id,
      splits: [
        { mode: 'cash', amount: 100_000 },
        { mode: 'upi', amount: 200_000 },
      ],
    });
    expect(detail.balance).toMatchObject({ paid: 300_000, due: 0, status: 'paid' });
  });

  it('opens one "Payment due" task for a balance (Q-T3)', async () => {
    const { detail } = await createInvoice(
      clinicInvoice({ paidNow: [{ mode: 'upi', amount: 100_000 }] }),
    );
    const tasks = clinicFixtures.tasks.snapshot(
      (row) => row.sourceId === detail.invoice.id,
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      rule: 'payment',
      kind: 'payment_reminder',
      title: 'Collect ₹2,000 from Dharti',
      why: `Clinic invoice #${detail.invoice.seq} has a balance.`,
      sourceType: 'invoice',
      ownerRole: 'front_desk',
      status: 'open',
    });
    // A paid invoice opens none.
    const paid = await createInvoice(
      clinicInvoice({ paidNow: [{ mode: 'cash', amount: 300_000 }] }),
    );
    expect(
      clinicFixtures.tasks.snapshot((row) => row.sourceId === paid.detail.invoice.id),
    ).toHaveLength(0);
  });

  it('opens a package per unit of a multi-session offering, valid for its validity (H:5065)', async () => {
    const { detail } = await createInvoice(
      clinicInvoice({ items: [offeringLine(273, { qty: 2 })] }),
    );
    const packs = clinicFixtures.patientPackages.snapshot(
      (row) => row.invoiceId === detail.invoice.id,
    );
    expect(packs).toHaveLength(2);
    expect(packs[0]).toMatchObject({
      patientId: DHARTI,
      offeringId: offering(273).id,
      sessionsTotal: 6,
      sessionsUsed: 0,
      validUntil: '2027-04-01',
    });
  });

  it('marks the patient’s plan rows invoiced and counts them (H:4410)', async () => {
    const planned = clinicFixtures.offeringSuggestions
      .snapshot((row) => row.patientId === DHARTI)
      .find((row) => row.status === 'planned');
    if (!planned) throw new Error('a planned suggestion');
    const line = offeringLine(270);
    const plannedOffering = clinicFixtures.offerings
      .snapshot()
      .find((row) => row.id === planned.offeringId);
    if (!plannedOffering) throw new Error('the planned offering');
    const { planLinked, detail } = await createInvoice(
      clinicInvoice({
        items: [line, offeringLine(plannedOffering.seq, { qty: planned.qty })],
      }),
    );
    expect(planLinked).toBe(1);
    const after = await clinicFixtures.offeringSuggestions.get(planned.id);
    expect(after.status).toBe('accepted');
    expect(after.invoiceLinks).toEqual([
      { invoiceId: detail.invoice.id, invoiceLineIndex: 1, qty: planned.qty },
    ]);
  });

  it('refuses without a patient or a line, the first problem named (422)', async () => {
    expect(
      await failureOf(createInvoice(clinicInvoice({ patientId: null }))),
    ).toMatchObject({
      status: 422,
      detail: 'Pick a patient',
    });
    expect(await failureOf(createInvoice(clinicInvoice({ items: [] })))).toMatchObject({
      status: 422,
      detail: 'Add at least one item',
    });
  });

  it('refuses a line below its lowest price (H:5059)', async () => {
    // Back Peeling: ₹3,000, lowest ₹2,250 — 30% off is ₹2,100.
    const failure = await failureOf(
      createInvoice(clinicInvoice({ items: [offeringLine(271, { discountPct: 30 })] })),
    );
    expect(failure).toMatchObject({
      status: 422,
      fields: { 'items.0.discountPct': [expect.any(String)] },
    });
    expect(failure.detail).toContain('Back Peeling');
  });

  it('refuses "Paid now" above the bill, and a payment on a closed day (409)', async () => {
    expect(
      await failureOf(
        createInvoice(clinicInvoice({ paidNow: [{ mode: 'cash', amount: 400_000 }] })),
      ),
    ).toMatchObject({ status: 409, detail: 'Paid ₹4,000 is more than the bill ₹3,000' });
    const today = await clinicFixtures.dayCloses.create({
      branchId: MAIN,
      date: TODAY,
      openingCash: 200_000,
      openingSource: 'default_float',
      openingAcceptedAt: NOW.toISOString(),
      countedCash: 200_000,
      closedAt: NOW.toISOString(),
      closedById: DOCTOR,
    });
    expect(today.closedAt).not.toBeNull();
    const before = clinicFixtures.invoices.snapshot().length;
    expect(
      await failureOf(
        createInvoice(clinicInvoice({ paidNow: [{ mode: 'cash', amount: 100_000 }] })),
      ),
    ).toMatchObject({ status: 409 });
    expect(clinicFixtures.invoices.snapshot()).toHaveLength(before);
    // With nothing paid now, the invoice itself is not the day's.
    await expect(createInvoice(clinicInvoice())).resolves.toBeDefined();
  });

  it('sends a Medical invoice to the sale path', async () => {
    const { detail } = await createInvoice(sale({ items: [medicineLine(450, 1)] }));
    expect(detail.sale).not.toBeNull();
  });
});

describe('createSale (S:1666)', () => {
  it('draws the stock by earliest expiry, writes the sale and stamps each line’s batch', async () => {
    const { detail } = await createSale(
      sale({
        items: [medicineLine(450, 2)],
        paidNow: [{ mode: 'cash', amount: 57_000 }],
      }),
    );
    expect(detail.invoice).toMatchObject({ type: 'medical', patientId: RHEA });
    expect(detail.invoice.items[0]?.batchNo).toBe('AZ771');
    expect(detail.sale).not.toBeNull();
    const savedSale = await clinicFixtures.medicalSales.get(detail.sale?.id ?? '');
    expect(savedSale.invoiceId).toBe(detail.invoice.id);
    expect(medicine(450).batches[0]?.qty).toBe(4);
    expect(detail.balance.status).toBe('paid');
  });

  it('refuses more than the stock, naming the medicine (409)', async () => {
    expect(
      await failureOf(createSale(sale({ items: [medicineLine(456, 4)] }))),
    ).toMatchObject({
      status: 409,
      detail: 'Only 3 of Glycolac Cream in stock',
    });
    expect(medicine(456).batches[0]?.qty).toBe(3);
  });

  it('sells to a Medical contact, the receipt naming them as the payer', async () => {
    const viral = clinicFixtures.medicalContacts.snapshot()[0];
    if (!viral) throw new Error('a contact');
    const { detail } = await createSale(
      sale({
        patientId: null,
        medicalContactId: viral.id,
        items: [medicineLine(450, 1)],
        paidNow: [{ mode: 'upi', amount: 28_500 }],
      }),
    );
    expect(detail.party).toMatchObject({ kind: 'contact', name: 'Viral Sheth' });
    expect(detail.payments[0]).toMatchObject({
      patientId: null,
      payeeName: 'Viral Sheth',
    });
  });

  it('saves a lead bought as a customer as a Medical contact (C24)', async () => {
    const lead = clinicFixtures.leads.snapshot(
      (row) => row.patientId === null && !row.isContactThread && row.phone !== null,
    )[0];
    if (!lead) throw new Error('a lead');
    const before = clinicFixtures.medicalContacts.snapshot().length;
    const { detail } = await createSale(
      sale({ patientId: null, leadId: lead.id, items: [medicineLine(450, 1)] }),
    );
    expect(detail.party).toMatchObject({ kind: 'contact', name: lead.name });
    expect(clinicFixtures.medicalContacts.snapshot()).toHaveLength(before + 1);
  });

  it('asks for a customer and for a medicine on every line', async () => {
    expect(
      await failureOf(
        createSale(sale({ patientId: null, items: [medicineLine(450, 1)] })),
      ),
    ).toMatchObject({ status: 422, detail: 'Pick a customer' });
    expect(
      await failureOf(
        createSale(sale({ items: [{ ...medicineLine(450, 1), medicineId: null }] })),
      ),
    ).toMatchObject({
      status: 422,
      fields: { 'items.0.medicineId': ['Pick a medicine'] },
    });
  });
});

describe('updateInvoice (S:1716)', () => {
  it('saves new lines, records a payment now and keeps the packages in step', async () => {
    const { detail } = await createInvoice(
      clinicInvoice({ items: [offeringLine(273, { qty: 2 })] }),
    );
    const { detail: changed } = await updateInvoice(
      detail.invoice.id,
      clinicInvoice({
        items: [offeringLine(273, { qty: 1 })],
        paidNow: [{ mode: 'card', amount: 50_000 }],
      }),
    );
    expect(changed.invoice.items).toHaveLength(1);
    expect(changed.balance).toMatchObject({ bill: 750_000, paid: 50_000 });
    expect(
      clinicFixtures.patientPackages.snapshot(
        (row) => row.invoiceId === detail.invoice.id,
      ),
    ).toHaveLength(1);
  });

  it('refuses a bill below what is already paid (409)', async () => {
    const { detail } = await createInvoice(
      clinicInvoice({ paidNow: [{ mode: 'cash', amount: 300_000 }] }),
    );
    expect(
      await failureOf(
        updateInvoice(
          detail.invoice.id,
          clinicInvoice({ items: [offeringLine(271, { discountPct: 20 })] }),
        ),
      ),
    ).toMatchObject({ status: 409, detail: 'Paid ₹3,000 is more than the bill ₹2,400' });
  });

  it('keeps a sale’s medicines (S:51) but takes its Remark', async () => {
    const { detail } = await createSale(sale({ items: [medicineLine(450, 1)] }));
    expect(
      await failureOf(
        updateInvoice(detail.invoice.id, sale({ items: [medicineLine(450, 2)] })),
      ),
    ).toMatchObject({ status: 409 });
    const { detail: changed } = await updateInvoice(
      detail.invoice.id,
      sale({ items: [medicineLine(450, 1)], remark: 'Collect tomorrow' }),
    );
    expect(changed.invoice.remark).toBe('Collect tomorrow');
    expect(changed.invoice.items[0]?.batchNo).toBe('AZ771');
  });
});

describe('deleteInvoice / restoreInvoice (S:1546)', () => {
  it('deletes an unpaid invoice with its unused packages, and Undo brings both back', async () => {
    const { detail } = await createInvoice(clinicInvoice({ items: [offeringLine(273)] }));
    await deleteInvoice(detail.invoice.id, 'mistake', null);
    expect(
      clinicFixtures.invoices.snapshot((row) => row.id === detail.invoice.id),
    ).toEqual([]);
    expect(
      clinicFixtures.patientPackages.snapshot(
        (row) => row.invoiceId === detail.invoice.id,
      ),
    ).toEqual([]);
    await restoreInvoice(detail.invoice.id);
    expect(
      clinicFixtures.patientPackages.snapshot(
        (row) => row.invoiceId === detail.invoice.id,
      ),
    ).toHaveLength(1);
  });

  it('refuses an invoice with payments, and a sale’s (409)', async () => {
    const paid = await createInvoice(
      clinicInvoice({ paidNow: [{ mode: 'cash', amount: 100_000 }] }),
    );
    expect(
      await failureOf(deleteInvoice(paid.detail.invoice.id, 'other', null)),
    ).toMatchObject({
      status: 409,
      detail: `Invoice #${paid.detail.invoice.seq} has payments · refund them first`,
    });
    const sold = await createSale(sale({ items: [medicineLine(450, 1)] }));
    expect(
      await failureOf(deleteInvoice(sold.detail.invoice.id, 'other', null)),
    ).toMatchObject({
      status: 409,
    });
  });
});

describe('the drawer’s reads', () => {
  it('reads Quick fill’s presets: packages, the last invoice of each type, the latest Rx', async () => {
    const presets = await fetchInvoicePresets(DHARTI);
    expect(presets.lastByType.clinic?.seq).toBe(787);
    expect(presets.lastByType.consultation?.seq).toBe(786);
    expect(presets.packages.length).toBeGreaterThan(0);
    expect(presets.latestRx?.seq).toBe(497);
    expect(presets.recentTeamIds.length).toBeGreaterThan(0);
  });

  it('lists the names billed most, medicines apart from offerings (H:5058)', async () => {
    const medical = await fetchOftenBilled('medical');
    const clinic = await fetchOftenBilled('clinic');
    expect(clinic.slice(0, 3)).toEqual(['LHR Half Leg', 'Underarm Peel', 'Back Peeling']);
    expect(clinic).not.toContain('Flubolt 400');
    expect(medical).not.toContain('Back Peeling');
    expect(medical).toContain('Flubolt 400');
  });

  it('finds Medical customers: patients, leads not yet patients, contacts', async () => {
    const page = await searchSaleCustomers('viral');
    expect(page.items).toEqual([
      expect.objectContaining({ kind: 'contact', name: 'Viral Sheth' }),
    ]);
    const kinds = new Set((await searchSaleCustomers('')).items.map((row) => row.kind));
    expect(kinds.has('patient')).toBe(true);
  });

  it('adds a Medical contact and saves its mobile on it', async () => {
    const contact = await addMedicalContact('Neha Rao');
    expect(contact).toMatchObject({ name: 'Neha Rao', phone: null });
    await expect(
      setMedicalContactPhone(contact.id, '+919876543210'),
    ).resolves.toMatchObject({
      phone: '+919876543210',
    });
    expect(await failureOf(setMedicalContactPhone(contact.id, '12345'))).toMatchObject({
      status: 422,
    });
  });

  it('answers a stored invoice’s ledger entries — what the print reads', async () => {
    const detail = await fetchInvoice(ref.invoice(785));
    expect(detail.balance).toMatchObject({
      bill: 130_000,
      paid: 60_000,
      status: 'partial',
    });
    expect(invoicePaid(detail.invoice.id, detail.payments)).toBe(60_000);
  });
});
