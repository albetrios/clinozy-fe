import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { invoiceTotals } from './app-money.ts';
import { appFixtures, resetAppFixtures } from './fixtures/world.fixtures.ts';
import {
  addMedicalContact,
  createSale,
  fetchOftenBilled,
  fetchSaleInvoice,
  fixtureInvoiceQueryKeys,
  searchSaleCustomers,
  setMedicalContactPhone,
} from './invoices-fixture-api.ts';
import type { InvoiceInput as SaleInput } from './invoices-fixture-contracts.ts';
import { medicineStock } from './medicine-stock.ts';

/*
 * The parked Medical room's sales on the fixture world (D153 seam) — what the shared Invoice
 * drawer reads and writes in sale mode — and a sale's invoice read back in the live invoice's
 * shape (rupees) for its print.
 */

/** A medicine the store holds at least `qty` of, with its MRP in paise. */
function medicineInStock(qty: number) {
  const medicine = appFixtures.medicines
    .snapshot()
    .find((row) => medicineStock(row.batches) >= qty);
  if (!medicine) throw new Error(`no medicine with ${qty} in stock`);
  return medicine;
}

function mainBranchId(): string {
  const branch = appFixtures.branches.snapshot().find((row) => row.isMain);
  if (!branch) throw new Error('no main branch');
  return branch.id;
}

/** A sale of `qty` of one medicine at its MRP to a Medical contact, with `paid` paise now. */
function saleOf({
  medicine,
  qty,
  contactId,
  paid = 0,
}: {
  medicine: ReturnType<typeof medicineInStock>;
  qty: number;
  contactId: string;
  paid?: number;
}): SaleInput {
  return {
    type: 'medical',
    branchId: mainBranchId(),
    patientId: null,
    medicalContactId: contactId,
    leadId: null,
    teamIds: [],
    items: [
      {
        offeringId: null,
        medicineId: medicine.id,
        name: medicine.name,
        packSize: null,
        qty,
        rate: medicine.mrp,
        discountPct: 10,
        gstPct: 0,
      },
    ],
    overallDiscount: 0,
    date: new Date().toISOString().slice(0, 10),
    remark: '  ',
    prescriptionId: null,
    paidNow: paid > 0 ? [{ mode: 'cash', amount: paid }] : [],
  };
}

describe('the fixture sales (invoices-fixture-api)', () => {
  beforeEach(() => resetAppFixtures());
  afterEach(() => resetAppFixtures());

  it('keys every fixture read under one root', () => {
    expect(fixtureInvoiceQueryKeys.sale('inv_1')).toEqual([
      'app',
      'fixture-invoices',
      'sale',
      'inv_1',
    ]);
    expect(fixtureInvoiceQueryKeys.oftenBilled('medical').slice(0, 2)).toEqual(
      fixtureInvoiceQueryKeys.all,
    );
    expect(fixtureInvoiceQueryKeys.customers()).toEqual([
      'app',
      'fixture-invoices',
      'customers',
    ]);
  });

  it('reads a seeded sale’s invoice in the live shape — rupees, numbered, never settled', async () => {
    const saved = appFixtures.invoices.snapshot((row) => row.saleId !== null)[0];
    if (!saved) throw new Error('the world seeds no sale');

    const detail = await fetchSaleInvoice(saved.id);

    const totals = invoiceTotals(saved);
    const { invoice } = detail;
    expect(invoice.id).toBe(saved.id);
    expect(invoice.number).toBe(`INV-${saved.seq}`);
    expect(invoice.type).toBe('medical');
    expect(invoice.isSettled).toBe(false);
    expect(invoice.financialYear).toBe('');
    expect(invoice.subtotal).toBe(Math.round(totals.subtotal) / 100);
    expect(invoice.gstTotal).toBe(Math.round(totals.gst) / 100);
    expect(invoice.discountTotal).toBe(
      Math.round(totals.lineDiscount + totals.overallDiscount) / 100,
    );
    expect(invoice.items.map((line) => line.id)).toEqual(
      saved.items.map((_line, index) => `${saved.id}:${index + 1}`),
    );
    expect(invoice.items.every((line) => !line.isGstInclusive)).toBe(true);
    expect(invoice.paid + invoice.due).toBeCloseTo(invoice.total, 2);
    expect(detail.sale?.id).toBe(saved.saleId);
    expect(detail.sheet.branch?.id).toBe(saved.branchId);
  });

  it('turns down an invoice that does not exist with a 404', async () => {
    const error = await fetchSaleInvoice('inv_missing').catch(
      (thrown: unknown) => thrown,
    );
    expect(isHttpError(error) && error.status).toBe(404);
  });

  it('sells to a new Medical contact: the stock is drawn, a blank remark is none, the receipt is on the ledger', async () => {
    const medicine = medicineInStock(2);
    const stockBefore = medicineStock(medicine.batches);
    const contact = await addMedicalContact('  Walk-in Ravi ');
    expect(contact).toEqual({
      id: expect.any(String),
      name: 'Walk-in Ravi',
      phone: null,
    });

    const result = await createSale(
      saleOf({ medicine, qty: 2, contactId: contact.id, paid: 10_000 }),
    );

    const after = appFixtures.medicines.snapshot((row) => row.id === medicine.id)[0];
    expect(medicineStock(after?.batches ?? [])).toBe(stockBefore - 2);
    expect(result.detail.invoice.remark).toBeNull();
    expect(result.detail.invoice.items[0]?.batchNo).not.toBeNull();

    const detail = await fetchSaleInvoice(result.detail.invoice.id);
    // A contact with no mobile prints with none.
    expect(detail.invoice.contact).toEqual({
      id: contact.id,
      name: 'Walk-in Ravi',
      phone: '',
    });
    expect(detail.party).toEqual({
      contactId: contact.id,
      patientId: null,
      name: 'Walk-in Ravi',
      phone: '',
    });
    // Two at MRP less 10%, in rupees.
    expect(detail.invoice.total).toBe(Math.round(medicine.mrp * 2 * 0.9) / 100);
    expect(detail.invoice.paid).toBe(100);
    expect(detail.payments).toHaveLength(1);
    expect(detail.invoice.status).toBe('partial');
  });

  it('refuses a sale of more than the store holds, drawing nothing', async () => {
    const medicine = medicineInStock(1);
    const stock = medicineStock(medicine.batches);
    const contact = await addMedicalContact('Walk-in');

    const error = await createSale(
      saleOf({ medicine, qty: stock + 1, contactId: contact.id }),
    ).catch((thrown: unknown) => thrown);

    expect(isHttpError(error) && error.status).toBe(409);
    expect(isHttpError(error) && JSON.stringify(error.data)).toContain(
      `Only ${stock} of ${medicine.name} in stock`,
    );
    const after = appFixtures.medicines.snapshot((row) => row.id === medicine.id)[0];
    expect(medicineStock(after?.batches ?? [])).toBe(stock);
  });

  it('saves a new contact’s mobile — only a 10-digit Indian mobile, or none', async () => {
    const contact = await addMedicalContact('Walk-in');
    await expect(
      setMedicalContactPhone(contact.id, '+919876543210'),
    ).resolves.toMatchObject({
      phone: '+919876543210',
    });
    const refused = await setMedicalContactPhone(contact.id, '+915876543210').catch(
      (thrown: unknown) => thrown,
    );
    expect(isHttpError(refused) && refused.status).toBe(422);
    await expect(setMedicalContactPhone(contact.id, null)).resolves.toMatchObject({
      phone: null,
    });
  });

  it('finds a new contact in the customer field, after the patients and leads', async () => {
    const contact = await addMedicalContact('Zzyzx Walk-in');
    const page = await searchSaleCustomers('zzyzx');
    expect(page.items).toEqual([
      { kind: 'contact', id: contact.id, name: 'Zzyzx Walk-in', phone: null },
    ]);
    expect(page.nextCursor).toBeNull();
    await expect(searchSaleCustomers('no-such-customer-anywhere')).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('names what is billed most — a sale’s medicines apart from the clinic’s offerings', async () => {
    const medical = await fetchOftenBilled('medical');
    const clinic = await fetchOftenBilled('clinic');
    expect(medical.length).toBeGreaterThan(0);
    expect(new Set(medical).size).toBe(medical.length);
    expect(medical.some((name) => clinic.includes(name))).toBe(false);
  });
});
