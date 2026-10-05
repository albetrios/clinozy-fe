import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  branchRef,
  MAIN_BRANCH,
} from '@/shared/api/clinic/fixtures/organization.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { staffRef } from '@/shared/api/clinic/fixtures/staff.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import {
  listLedger,
  listOpenSupplierBills,
  payExpense,
} from '@/shared/api/clinic/payments-api.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';

import {
  fetchMedicalSale,
  fetchSupplier,
  fetchSupplierAccount,
  listMedicalSales,
  listPurchaseOrders,
} from './medical-api.ts';
import {
  cancelPurchaseOrder,
  collectSale,
  createPurchaseOrder,
  listPrescriptionsToFill,
  receivePurchaseOrder,
  returnExpiringStock,
  returnSale,
  updatePurchaseOrder,
  voidSale,
} from './medical-flows-api.ts';

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');
const MAIN = branchRef(MAIN_BRANCH);
const SHREE_RAMDEV = ref.supplier(58);
const KR_MEDICAL = ref.supplier(61);

/** The rejection a call ends in: its status and the server's message. */
async function failureOf(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!isHttpError(error)) throw new Error('expected an HTTP error');
  const body = (error.data as { error: { detail: string; fields?: object } }).error;
  return { status: error.status, ...body };
}

/** A medicine's batch by number. */
async function batchOf(medicineSeq: number, batchNo: string) {
  const medicine = await clinicFixtures.medicines.get(ref.medicine(medicineSeq));
  return medicine.batches.find((batch) => batch.batchNo === batchNo);
}

/** The Medical ledger's entries for an invoice or a bill. */
async function medicalLedger() {
  return (await listLedger({ scope: 'medical' })).items;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('purchase orders (createPO · updatePO · cancelPO, S:1670–1673)', () => {
  it('creates an Ordered order: its lines unreceived, nothing paid', async () => {
    const order = await createPurchaseOrder({
      supplierId: KR_MEDICAL,
      supplierBillNo: ' T-90 ',
      date: '2026-10-03',
      items: [{ medicineId: ref.medicine(458), qty: 4, free: 1, rate: 44_000 }],
    });
    expect(order).toMatchObject({
      stage: 'ordered',
      paid: 0,
      supplierBillNo: 'T-90',
      items: [{ qty: 4, free: 1, rate: 44_000, received: false, batchNo: null }],
    });
    expect((await listPurchaseOrders({ stage: 'ordered' })).items).toHaveLength(2);
  });

  it('refuses an unknown supplier and a line without a rate', async () => {
    const unknown = await failureOf(
      createPurchaseOrder({
        supplierId: ref.supplier(99),
        supplierBillNo: null,
        date: '2026-10-03',
        items: [],
      }),
    );
    expect(unknown).toMatchObject({ status: 422, detail: 'Pick a supplier' });
    const noRate = await failureOf(
      createPurchaseOrder({
        supplierId: KR_MEDICAL,
        supplierBillNo: null,
        date: '2026-10-03',
        items: [{ medicineId: ref.medicine(458), qty: 1, free: 0, rate: 0 }],
      }),
    );
    expect(noRate.status).toBe(422);
  });

  it('saves only an Ordered order, and cancels one out of the list', async () => {
    const saved = await updatePurchaseOrder(ref.purchaseOrder(430), {
      supplierId: KR_MEDICAL,
      supplierBillNo: 'T-82370',
      date: '2026-10-02',
      items: [{ medicineId: ref.medicine(455), qty: 6, free: 0, rate: 21_200 }],
    });
    expect(saved.items).toHaveLength(1);
    const received = await failureOf(
      updatePurchaseOrder(ref.purchaseOrder(431), {
        supplierId: SHREE_RAMDEV,
        supplierBillNo: null,
        date: '2026-10-02',
        items: [],
      }),
    );
    expect(received).toMatchObject({
      status: 409,
      detail: 'This order is no longer open',
    });

    const cancelled = await cancelPurchaseOrder(ref.purchaseOrder(430), 'mistake');
    expect(cancelled).toMatchObject({ stage: 'cancelled', cancelReason: 'mistake' });
    const seqs = (await listPurchaseOrders()).items.map((order) => order.seq);
    expect(seqs).not.toContain(430);
    expect(
      (await failureOf(cancelPurchaseOrder(ref.purchaseOrder(430), 'other'))).status,
    ).toBe(409);
  });
});

describe('receive goods (receivePO, S:1672)', () => {
  it('adds each arrived line to stock — qty + free — and makes the order a bill to pay', async () => {
    // #430: 4 × Trichospire (no batch typed) and 10 + 2 free × Epriva into DS-25045.
    const order = await receivePurchaseOrder(ref.purchaseOrder(430), {
      lines: [
        { arrived: true, batchNo: null, expiry: '12/27' },
        { arrived: true, batchNo: 'DS-25045', expiry: '10/27' },
      ],
    });
    expect(order.stage).toBe('received');
    expect(order.items.map((item) => [item.received, item.batchNo])).toEqual([
      [true, 'NEW-430'],
      [true, 'DS-25045'],
    ]);
    expect(await batchOf(451, 'NEW-430')).toMatchObject({
      qty: 4,
      expiry: '12/27',
      purchaseRate: 52_900,
    });
    expect((await batchOf(455, 'DS-25045'))?.qty).toBe(5 + 12);
    // Send payment can settle it now: 4 × ₹529 + 10 × ₹212, free units cost nothing.
    const bill = (await listOpenSupplierBills()).find(
      (open) => open.purchaseId === ref.purchaseOrder(430),
    );
    expect(bill).toMatchObject({ kind: 'medical_po', due: 423_600 });
  });

  it('leaves a line that did not arrive out of stock', async () => {
    const order = await receivePurchaseOrder(ref.purchaseOrder(430), {
      lines: [
        { arrived: false, batchNo: null, expiry: null },
        { arrived: true, batchNo: null, expiry: '10/27' },
      ],
    });
    expect(order.items.map((item) => item.received)).toEqual([false, true]);
    expect(await batchOf(451, 'NEW-430')).toBeUndefined();
    expect(await batchOf(455, 'NEW-430')).toMatchObject({ qty: 12 });
  });

  it('takes what arrived off the order into stock and onto the bill ("+ Add unexpected item")', async () => {
    // #430's two lines came, and 3 + 1 free × #458 at ₹440 with them.
    const order = await receivePurchaseOrder(ref.purchaseOrder(430), {
      lines: [
        { arrived: true, batchNo: null, expiry: '12/27' },
        { arrived: true, batchNo: 'DS-25045', expiry: '10/27' },
      ],
      extras: [
        {
          medicineId: ref.medicine(458),
          qty: 3,
          free: 1,
          rate: 44_000,
          batchNo: null,
          expiry: '06/28',
        },
      ],
    });
    expect(order.stage).toBe('received');
    expect(order.items).toHaveLength(3);
    expect(order.items[2]).toEqual({
      medicineId: ref.medicine(458),
      qty: 3,
      free: 1,
      rate: 44_000,
      batchNo: 'NEW-430',
      expiry: '06/28',
      received: true,
    });
    expect(await batchOf(458, 'NEW-430')).toMatchObject({
      qty: 4,
      expiry: '06/28',
      purchaseRate: 44_000,
    });
    // The bill counts it with the order's lines: 4 × ₹529 + 10 × ₹212 + 3 × ₹440.
    const bill = (await listOpenSupplierBills()).find(
      (open) => open.purchaseId === ref.purchaseOrder(430),
    );
    expect(bill).toMatchObject({ due: 423_600 + 132_000 });
  });

  it('needs an unexpected line’s expiry, a stocked medicine and its rate', async () => {
    // Nothing on the order came: the unexpected line is all that arrived.
    const lines = [
      { arrived: false, batchNo: null, expiry: null },
      { arrived: false, batchNo: null, expiry: null },
    ];
    const extra = {
      medicineId: ref.medicine(458),
      qty: 1,
      free: 0,
      rate: 44_000,
      batchNo: null,
      expiry: '06/28',
    };
    const order = ref.purchaseOrder(430);
    expect(
      await failureOf(
        receivePurchaseOrder(order, { lines, extras: [{ ...extra, expiry: null }] }),
      ),
    ).toMatchObject({ status: 422, fields: { 'extras.0.expiry': ['Enter the expiry'] } });
    expect(
      await failureOf(
        receivePurchaseOrder(order, {
          lines,
          extras: [{ ...extra, medicineId: '00000000-0000-4000-8000-000000000000' }],
        }),
      ),
    ).toMatchObject({ status: 422, detail: 'Pick medicines the store stocks' });
    expect(
      await failureOf(
        receivePurchaseOrder(order, { lines, extras: [{ ...extra, rate: 0 }] }),
      ),
    ).toMatchObject({
      status: 422,
      fields: { 'extras.0.rate': ['Enter the purchase rate'] },
    });
  });

  it('needs an arrived line’s expiry and something that arrived', async () => {
    const noExpiry = await failureOf(
      receivePurchaseOrder(ref.purchaseOrder(430), {
        lines: [
          { arrived: true, batchNo: null, expiry: null },
          { arrived: false, batchNo: null, expiry: null },
        ],
      }),
    );
    expect(noExpiry).toMatchObject({
      status: 422,
      fields: { 'lines.0.expiry': ['Enter the expiry'] },
    });
    const nothing = await failureOf(
      receivePurchaseOrder(ref.purchaseOrder(430), {
        lines: [
          { arrived: false, batchNo: null, expiry: null },
          { arrived: false, batchNo: null, expiry: null },
        ],
      }),
    );
    expect(nothing).toMatchObject({ status: 422, detail: 'Tick what arrived' });
    const short = await failureOf(
      receivePurchaseOrder(ref.purchaseOrder(430), { lines: [] }),
    );
    expect(short.status).toBe(422);
  });
});

describe('every money action reaches the ledger (Q-M1)', () => {
  it('Collect writes the due as one UPI receipt against the sale’s invoice', async () => {
    // #978: 1 × Beyolaic ₹239 + 2 × Glycolac ₹162.
    const receipt = await collectSale(ref.medicalSale(978));
    expect(receipt).toMatchObject({
      direction: 'received',
      kind: 'receipt',
      amount: 56_300,
      splits: [{ mode: 'upi', amount: 56_300 }],
      invoiceId: ref.invoice(788),
    });
    expect(await fetchMedicalSale(ref.medicalSale(978))).toMatchObject({
      paid: 56_300,
      due: 0,
      status: 'paid',
    });
    expect((await medicalLedger()).map((row) => row.id)).toContain(receipt.id);
  });

  it('refuses to collect a settled sale, or on a closed day', async () => {
    const settled = await failureOf(collectSale(ref.medicalSale(983)));
    expect(settled).toMatchObject({ status: 409, detail: 'Nothing is due on this sale' });
    await clinicFixtures.dayCloses.create({
      branchId: MAIN,
      date: '2026-10-03',
      openingCash: 200_000,
      openingSource: 'default_float',
      openingAcceptedAt: NOW.toISOString(),
      countedCash: 200_000,
      closedAt: NOW.toISOString(),
      closedById: staffRef('RS'),
    });
    expect((await failureOf(collectSale(ref.medicalSale(978)))).status).toBe(409);
  });

  it('a supplier bill paid through Send payment is Medical’s too', async () => {
    const paid = await payExpense({
      branchId: MAIN,
      billRef: { kind: 'medical_po', purchaseId: ref.purchaseOrder(431), billNo: '1631' },
      payeeName: 'Shree Ramdev Medical Agency',
      expenseCategory: 'medicines',
      amount: 298_000,
      mode: 'upi',
      paidOn: '2026-10-03',
      note: null,
      attachmentKeys: [],
    });
    expect((await medicalLedger()).map((row) => row.id)).toContain(paid.id);
    expect((await fetchSupplier(SHREE_RAMDEV)).payable).toBe(0);
  });

  it('keeps the clinic’s own entries out of the Medical scope', async () => {
    const rows = await medicalLedger();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan((await listLedger()).items.length);
    for (const row of rows) {
      expect(
        row.invoice?.type === 'medical' ||
          row.bill?.kind === 'medical_po' ||
          row.expenseCategory === 'medicines',
      ).toBe(true);
    }
  });
});

describe('return from patient (returnSale, S:1667)', () => {
  it('puts the stock back and refunds a paid sale: a credit note and its refund entry', async () => {
    // #983 (paid ₹1,200): one Admosh back from ASC002.
    const result = await returnSale(ref.medicalSale(983), {
      lines: [{ medicineId: ref.medicine(454), batchNo: 'ASC002', qty: 1 }],
      reason: 'unused',
      mode: 'cash',
    });
    expect(result).toEqual({ amount: 55_000, refunded: 55_000, restocked: true });
    expect((await batchOf(454, 'ASC002'))?.qty).toBe(3);
    const refund = (await medicalLedger()).find((row) => row.kind === 'refund');
    expect(refund).toMatchObject({
      direction: 'paid',
      amount: 55_000,
      splits: [{ mode: 'cash', amount: 55_000 }],
      invoice: { seq: 790 },
    });
    expect(refund?.creditNoteSeq).not.toBeNull();
    expect(await fetchMedicalSale(ref.medicalSale(983))).toMatchObject({
      returned: 55_000,
      due: 0,
      status: 'paid',
    });
    expect((await listMedicalSales({ status: 'returned' })).items).toHaveLength(1);
  });

  it('writes a damaged or reacted return off, and names a walk-in on its refund', async () => {
    // #982: Viral Sheth, a Medical contact, paid ₹285 for one Azelan.
    const result = await returnSale(ref.medicalSale(982), {
      lines: [{ medicineId: ref.medicine(450), batchNo: 'AZ771', qty: 1 }],
      reason: 'damaged',
      mode: 'upi',
    });
    expect(result).toMatchObject({ refunded: 28_500, restocked: false });
    expect((await batchOf(450, 'AZ771'))?.qty).toBe(6);
    const refund = (await medicalLedger()).find((row) => row.kind === 'refund');
    expect(refund).toMatchObject({ partyName: 'Viral Sheth', patientId: null });
  });

  it('lowers an unpaid sale’s due and pays nothing back', async () => {
    const before = (await listLedger()).items.length;
    const result = await returnSale(ref.medicalSale(978), {
      lines: [{ medicineId: ref.medicine(456), batchNo: '026-312', qty: 1 }],
      reason: 'rx_changed',
      mode: 'cash',
    });
    expect(result).toEqual({ amount: 16_200, refunded: 0, restocked: true });
    expect((await listLedger()).items).toHaveLength(before);
    expect((await fetchMedicalSale(ref.medicalSale(978))).due).toBe(40_100);
  });

  it('refuses more than was sold — counting what came back — and nothing at all', async () => {
    const tooMany = await failureOf(
      returnSale(ref.medicalSale(978), {
        lines: [{ medicineId: ref.medicine(456), batchNo: '026-312', qty: 3 }],
        reason: 'unused',
        mode: 'cash',
      }),
    );
    expect(tooMany).toMatchObject({ status: 422, detail: 'More than was sold' });
    await returnSale(ref.medicalSale(978), {
      lines: [{ medicineId: ref.medicine(456), batchNo: '026-312', qty: 2 }],
      reason: 'unused',
      mode: 'cash',
    });
    const again = await failureOf(
      returnSale(ref.medicalSale(978), {
        lines: [{ medicineId: ref.medicine(456), batchNo: '026-312', qty: 1 }],
        reason: 'unused',
        mode: 'cash',
      }),
    );
    expect(again.status).toBe(422);
    const nothing = await failureOf(
      returnSale(ref.medicalSale(978), {
        lines: [{ medicineId: ref.medicine(453), batchNo: 'ADE25510', qty: 0 }],
        reason: 'unused',
        mode: 'cash',
      }),
    );
    expect(nothing).toMatchObject({
      status: 422,
      detail: 'Enter what is being returned',
    });
  });
});

describe('void a sale (voidSale, S:1668; Q-M2)', () => {
  it('puts the stock back, cancels the invoice and leaves the list', async () => {
    const sale = await voidSale(ref.medicalSale(978), 'mistake', null);
    expect(sale.voidedAt).not.toBeNull();
    expect((await batchOf(453, 'ADE25510'))?.qty).toBe(8);
    expect((await batchOf(456, '026-312'))?.qty).toBe(5);
    expect(
      clinicFixtures.invoices.snapshot((invoice) => invoice.id === ref.invoice(788)),
    ).toHaveLength(0);
    const seqs = (await listMedicalSales()).items.map((row) => row.seq);
    expect(seqs).not.toContain(978);
    expect((await failureOf(fetchMedicalSale(ref.medicalSale(978)))).status).toBe(404);
  });

  it('refuses a sale with money on it or a return', async () => {
    expect(
      (await failureOf(voidSale(ref.medicalSale(983), 'mistake', null))).status,
    ).toBe(409);
    await returnSale(ref.medicalSale(978), {
      lines: [{ medicineId: ref.medicine(456), batchNo: '026-312', qty: 1 }],
      reason: 'unused',
      mode: 'cash',
    });
    expect((await failureOf(voidSale(ref.medicalSale(978), 'other', 'x'))).status).toBe(
      409,
    );
  });
});

describe('return expiring stock (Appendix F)', () => {
  it('drops the batch, credits qty × its rate, lowers the payable and joins the Account', async () => {
    // Two Admosh packs from ASC002 (₹182 each) back to Shree Ramdev, owed ₹2,980.
    const result = await returnExpiringStock({
      medicineId: ref.medicine(454),
      batchNo: 'ASC002',
      supplierId: SHREE_RAMDEV,
      qty: 2,
    });
    expect(result).toEqual({
      qty: 2,
      credit: 36_400,
      supplierName: 'Shree Ramdev Medical Agency',
    });
    expect((await batchOf(454, 'ASC002'))?.qty).toBe(0);
    expect((await fetchSupplier(SHREE_RAMDEV)).payable).toBe(298_000 - 36_400);
    const [first] = await fetchSupplierAccount(SHREE_RAMDEV);
    expect(first).toMatchObject({ kind: 'credit', batchNo: 'ASC002', amount: 36_400 });
  });

  it('caps the quantity at the batch and refuses an empty batch', async () => {
    const result = await returnExpiringStock({
      medicineId: ref.medicine(456),
      batchNo: '026-312',
      supplierId: ref.supplier(52),
      qty: 9,
    });
    expect(result.qty).toBe(3);
    const empty = await failureOf(
      returnExpiringStock({
        medicineId: ref.medicine(456),
        batchNo: '026-312',
        supplierId: ref.supplier(52),
        qty: 1,
      }),
    );
    expect(empty).toMatchObject({ status: 409, detail: 'Nothing left in this batch' });
  });

  it('forgets the credits when the world starts over', async () => {
    await returnExpiringStock({
      medicineId: ref.medicine(454),
      batchNo: 'ASC002',
      supplierId: SHREE_RAMDEV,
      qty: 1,
    });
    resetClinicFixtures();
    expect((await fetchSupplier(SHREE_RAMDEV)).payable).toBe(298_000);
  });
});

describe('prescriptions to fill (listPrescriptionsToFill, S:1658)', () => {
  it('lists the prescriptions no live sale filled, newest first, with their medicines', async () => {
    const list = await listPrescriptionsToFill();
    const [newest] = list;
    expect(newest).toMatchObject({ seq: 501, patientName: 'Harsh Trivedi' });
    expect(newest?.medicines).toContain('Tretinoin 0.025% cream 20 g');
    const dates = list.map((rx) => rx.date);
    expect([...dates].sort().reverse()).toEqual(dates);

    await clinicFixtures.medicalSales.update(ref.medicalSale(983), {
      prescriptionId: ref.prescription(501),
    });
    const after = await listPrescriptionsToFill();
    expect(after.map((rx) => rx.seq)).not.toContain(501);
  });
});
