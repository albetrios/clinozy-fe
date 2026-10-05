import { afterEach, describe, expect, it } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  clinicOrganization,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  fetchMedicalSale,
  fetchPurchaseOrder,
  fetchPurchaseOrderSheet,
  fetchSupplier,
  listManufacturers,
  listMedicalReps,
  listMedicalSales,
  listPurchaseOrders,
  listSaleReminders,
  listSuppliers,
  medicalListSummary,
} from './medical-api.ts';

afterEach(() => resetClinicFixtures());

describe('payment reminders (`medical.md:17`, Q-M6)', () => {
  it('lists each customer the unpaid sales name, with their due and sales', async () => {
    const { clinicName, customers } = await listSaleReminders();
    expect(clinicName).toBe(clinicOrganization().name);
    expect(customers).toEqual([
      {
        customer: expect.objectContaining({ kind: 'patient', name: 'Dharti Galani' }),
        due: 56_300,
        saleSeqs: [978],
      },
    ]);
    // The list's search applies: Rhea's sale is paid, so no one is left.
    expect((await listSaleReminders({ q: 'rhea' })).customers).toEqual([]);
  });

  it('sums a customer’s unpaid sales, oldest first', async () => {
    // Rhea's #983 becomes Dharti's, its payment undone.
    const dharti = (await clinicFixtures.medicalSales.get(ref.medicalSale(978)))
      .patientId;
    const sale = await clinicFixtures.medicalSales.update(ref.medicalSale(983), {
      patientId: dharti,
    });
    for (const payment of clinicFixtures.payments.snapshot(
      (row) => row.invoiceId === sale.invoiceId,
    )) {
      await clinicFixtures.payments.remove(payment.id, 'mistake', null);
    }
    const { bill } = await fetchMedicalSale(sale.id);
    const { customers } = await listSaleReminders();
    expect(customers).toHaveLength(1);
    expect(customers[0]).toMatchObject({ due: 56_300 + bill, saleSeqs: [978, 983] });
  });
});

describe('the purchase order sheet (Q-M7)', () => {
  it('reads the order with its supplier, the clinic and its main branch', async () => {
    const sheet = await fetchPurchaseOrderSheet(ref.purchaseOrder(428));
    expect(sheet.order).toMatchObject({ seq: 428, supplierName: 'Akshar Medicines' });
    expect(sheet.supplier.name).toBe('Akshar Medicines');
    expect(sheet.organization).toMatchObject({ name: clinicOrganization().name });
    const [main] = clinicFixtures.branches.snapshot((row) => row.isMain);
    expect(sheet.branch).toEqual({
      phone: main?.phone,
      gstNumber: main?.gstNumber ?? null,
    });
    // A supplier removed since still prints on its order.
    await clinicFixtures.suppliers.remove(ref.supplier(52), 'mistake', null);
    expect((await fetchPurchaseOrderSheet(ref.purchaseOrder(428))).supplier.name).toBe(
      'Akshar Medicines',
    );
  });
});

describe('sales (`S:1657`)', () => {
  it('reads each sale with its customer, lines, bill, cost and status, newest first', async () => {
    const { items } = await listMedicalSales();
    expect(items.map((sale) => sale.seq)).toEqual([983, 982, 978]);
    const unpaid = await fetchMedicalSale(ref.medicalSale(978));
    expect(unpaid).toMatchObject({
      invoiceSeq: 788,
      customer: { kind: 'patient', name: 'Dharti Galani' },
      bill: 56_300,
      due: 56_300,
      status: 'unpaid',
    });
    expect(unpaid.lines.map((line) => [line.name, line.qty, line.batchNo])).toEqual([
      ['Beyolaic Cream', 1, 'ADE25510'],
      ['Glycolac Cream', 2, '026-312'],
    ]);
    // Cost at the best buy rates: 1 × ₹227 + 2 × ₹123.
    expect(unpaid.cost).toBe(47_300);
    expect(items.find((sale) => sale.seq === 982)?.customer).toMatchObject({
      kind: 'contact',
      name: 'Viral Sheth',
    });
  });

  it('filters Unpaid and Returned, searches the customer or "#983"', async () => {
    expect((await listMedicalSales({ status: 'unpaid' })).items).toHaveLength(1);
    expect((await listMedicalSales({ status: 'returned' })).items).toHaveLength(0);
    expect((await listMedicalSales({ q: 'rhea' })).items.map((s) => s.seq)).toEqual([
      983,
    ]);
    expect((await listMedicalSales({ q: '#982' })).items.map((s) => s.seq)).toEqual([
      982,
    ]);
    const byBill = await listMedicalSales({ sort: 'bill', order: 'asc' });
    expect(byBill.items.map((sale) => sale.seq)).toEqual([982, 978, 983]);
  });
});

describe('purchase orders (`S:1661`)', () => {
  it('reads each order’s supplier, items, free units, total and due — owed only once received', async () => {
    const { items } = await listPurchaseOrders();
    expect(items.map((order) => order.seq)).toEqual([431, 430, 428]);
    const received = await fetchPurchaseOrder(ref.purchaseOrder(431));
    expect(received).toMatchObject({
      supplierName: 'Shree Ramdev Medical Agency',
      itemNames: ['Admosh UV Sunscreen 60g', 'Arganlif Hair Serum 50 ml'],
      freeCount: 1,
      total: 298_000,
      due: 298_000,
    });
    expect((await fetchPurchaseOrder(ref.purchaseOrder(430))).due).toBe(0);
    // Paid ₹1,200 of ₹1,296 is still Paid: settled, nothing owed.
    expect((await fetchPurchaseOrder(ref.purchaseOrder(428))).due).toBe(0);
  });

  it('filters by stage and searches the bill number', async () => {
    expect((await listPurchaseOrders({ stage: 'ordered' })).items).toHaveLength(1);
    expect((await listPurchaseOrders({ q: '1631' })).items.map((o) => o.seq)).toEqual([
      431,
    ]);
  });
});

describe('suppliers, manufacturers and MRs (`S:1662`)', () => {
  it('derives what each supplier is owed, since when, and its oldest open bill', async () => {
    const owed = await fetchSupplier(ref.supplier(58));
    expect(owed).toMatchObject({
      payable: 298_000,
      orderCount: 1,
      hasOpenOrder: true,
      oldestOpenBill: { id: ref.purchaseOrder(431), seq: 431, due: 298_000 },
    });
    expect(owed.ageingDays).toBeGreaterThanOrEqual(0);
    const clear = await fetchSupplier(ref.supplier(59));
    expect(clear).toMatchObject({ payable: 0, ageingDays: null, orderCount: 0 });
    const { items } = await listSuppliers({ manufacturer: [ref.manufacturer(6)] });
    expect(items.map((supplier) => supplier.name)).toEqual([
      'Akshar Medicines',
      'NH Pharma',
    ]);
  });

  it('joins each maker’s medicines, suppliers and MRs', async () => {
    const { items } = await listManufacturers();
    const alvi = items.find((maker) => maker.name === 'ALVI');
    expect(alvi).toMatchObject({
      medicineCount: 1,
      suppliers: [{ name: 'K R Medical Agency' }, { name: 'Akshar Medicines' }],
      mrs: [{ name: 'Alvio Pharma · Rakesh' }],
    });
    const filtered = await listManufacturers({ mrs: [ref.medicalRep(3)] });
    expect(filtered.items.map((maker) => maker.name)).toEqual(['AVRI', 'PHARM']);
  });

  it('reads each MR’s makers and last visit', async () => {
    const { items } = await listMedicalReps();
    expect(items.map((mr) => mr.name)).toEqual([
      'Alvio Pharma · Rakesh',
      'Atopic Dermocare · Meet',
      'Avriva Skintech · Jay',
    ]);
    expect(items[0]).toMatchObject({ samples: '5 samples' });
    expect(items[2]).toMatchObject({ samples: null });
  });

  it('answers the footers’ counts and what the suppliers are owed', async () => {
    expect(await medicalListSummary('sales', {})).toEqual({ total: 3, payable: 0 });
    expect(await medicalListSummary('suppliers', {})).toEqual({
      total: 4,
      payable: 298_000,
    });
    expect((await medicalListSummary('manufacturers', {})).total).toBe(6);
    expect((await medicalListSummary('mrs', {})).total).toBe(3);
    expect((await medicalListSummary('purchases', { stage: 'paid' })).total).toBe(1);
  });
});
