import {
  clinicHttpError,
  compareText,
  refuseUnknownIds,
  validateClinicInput,
} from '@/shared/api/clinic/clinic-fixture-store.ts';
import { invoiceBalance, invoiceLineAmounts } from '@/shared/api/clinic/clinic-money.ts';
import type {
  DeleteReason,
  Invoice,
  MedicalPurchaseOrder,
  MedicalSale,
  MedicineBatch,
  PaymentMode,
} from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { assertDayOpen } from '@/shared/api/clinic/day-close-api.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import { newLedgerEntry } from '@/shared/api/clinic/payments-api.ts';
import type { PaymentRecord } from '@/shared/api/clinic/payments-contracts.ts';

import {
  type ExpiringReturnInput,
  expiringReturnInputSchema,
  type ExpiringReturnResult,
  EXPIRY_MESSAGE,
  PICK_SUPPLIER_MESSAGE,
  type PrescriptionToFill,
  type PurchaseOrderInput,
  purchaseOrderInputSchema,
  type ReceiveInput,
  receiveInputSchema,
  RETURN_NOTHING_MESSAGE,
  type SaleReturnInput,
  saleReturnInputSchema,
  type SaleReturnResult,
  WRITTEN_OFF_REASONS,
} from './medical-flows-contracts.ts';
import { supplierCreditStore } from './medical-supplier-credits.ts';

/*
 * The Medical flows' writes (`S:1666–1677`) on the fixture world until
 * clinozy-be serves them — every call is REPLACE_WITH_API (D6): purchase orders
 * and their receipt, a sale's Collect, return and void, the expiring-stock
 * return, and the prescriptions still to fill. Money goes through the ledger
 * (Q-M1): Collect writes a receipt, a refund a credit note and its entry.
 */

const fixtureWorld = () => import('@/shared/api/clinic/fixtures/world.fixtures.ts');

type FixtureWorld = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

/** A 422 the drawers show on a field. */
function refuse(field: string, message: string): never {
  throw clinicHttpError(422, 'validation', message, { [field]: [message] });
}

/** A 409: the record is no longer in a state the write applies to. */
function conflict(message: string): never {
  throw clinicHttpError(409, 'conflict', message);
}

// ── Purchase orders ──

/** The order's fields, checked: a known supplier, medicines the store stocks. */
function orderFields(world: FixtureWorld, input: PurchaseOrderInput) {
  const fields = validateClinicInput(purchaseOrderInputSchema, input);
  refuseUnknownIds(
    'supplierId',
    [fields.supplierId],
    world.suppliers.snapshot(),
    PICK_SUPPLIER_MESSAGE,
  );
  refuseUnknownIds(
    'items',
    fields.items.map((item) => item.medicineId),
    world.medicines.snapshot(),
    'Pick medicines the store stocks',
  );
  return {
    supplierId: fields.supplierId,
    supplierBillNo: fields.supplierBillNo || null, // NOSONAR(S6606): a blank bill number is none
    date: fields.date,
    items: fields.items.map((item) => ({
      ...item,
      batchNo: null,
      expiry: null,
      received: false,
    })),
  };
}

/**
 * New purchase order (`createPO`, `S:1670`): stage Ordered, nothing paid —
 * stock moves when the goods are received.
 */
export async function createPurchaseOrder(
  input: PurchaseOrderInput,
): Promise<MedicalPurchaseOrder> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.purchaseOrders.create({
    ...orderFields(clinicFixtures, input),
    stage: 'ordered',
    paid: 0,
    cancelReason: null,
  });
}

/** An order that is still Ordered — the only stage that edits, receives or cancels (`S:59`). */
async function orderedOrder(world: FixtureWorld, id: string) {
  const order = await world.purchaseOrders.get(id);
  if (order.stage !== 'ordered') conflict('This order is no longer open');
  return order;
}

/** Save a purchase order (`updatePO`, `S:1671`) while it is Ordered. */
export async function updatePurchaseOrder(
  id: string,
  input: PurchaseOrderInput,
): Promise<MedicalPurchaseOrder> {
  const { clinicFixtures } = await fixtureWorld();
  await orderedOrder(clinicFixtures, id);
  return clinicFixtures.purchaseOrders.update(id, orderFields(clinicFixtures, input));
}

/**
 * Cancel an Ordered order (`cancelPO`, `S:1673`): it stops here; stock and the
 * supplier's dues are not changed. The reason is the `delete_reason` the
 * confirm stores (D32); {@link restorePurchaseOrder} is its Undo.
 */
export async function cancelPurchaseOrder(
  id: string,
  reason: DeleteReason,
): Promise<MedicalPurchaseOrder> {
  const { clinicFixtures } = await fixtureWorld();
  await orderedOrder(clinicFixtures, id);
  return clinicFixtures.purchaseOrders.update(id, {
    stage: 'cancelled',
    cancelReason: reason,
  });
}

/**
 * Undo a cancel — the Undo of "PO #430 cancelled" (`POST …/restore` in the
 * 10s window, D32; REPLACE_WITH_API — a backend request, Appendix F): the
 * order is Ordered again, the stage it was cancelled from, its reason gone.
 */
export async function restorePurchaseOrder(id: string): Promise<MedicalPurchaseOrder> {
  const { clinicFixtures } = await fixtureWorld();
  const order = await clinicFixtures.purchaseOrders.get(id);
  if (order.stage !== 'cancelled') conflict('This order is not cancelled');
  return clinicFixtures.purchaseOrders.update(id, {
    stage: 'ordered',
    cancelReason: null,
  });
}

/** Add `qty` to the medicine's batch `batchNo`, opening it when it is new. */
function withStock(
  batches: readonly MedicineBatch[],
  batch: MedicineBatch,
): MedicineBatch[] {
  const known = batches.some((row) => row.batchNo === batch.batchNo);
  if (!known) return [...batches, batch];
  return batches.map((row) =>
    row.batchNo === batch.batchNo ? { ...row, qty: row.qty + batch.qty } : row,
  );
}

/**
 * Receive goods (`receivePO`, `S:1672`): every arrived line becomes stock —
 * qty + free into its batch ("NEW-430" when none was typed) at the line's
 * rate — and the order moves to Received. An arrived line needs its expiry
 * (KICKOFF §6.7, AMBER). What arrived that the order did not list ("+ Add
 * unexpected item", H:5388; Appendix F) joins the order as a received line on
 * the same terms, so the bill counts it.
 */
export async function receivePurchaseOrder(
  id: string,
  input: ReceiveInput,
): Promise<MedicalPurchaseOrder> {
  const { clinicFixtures } = await fixtureWorld();
  const order = await orderedOrder(clinicFixtures, id);
  const { lines, extras } = validateClinicInput(receiveInputSchema, input);
  if (lines.length !== order.items.length) refuse('lines', 'Tick what arrived');
  lines.forEach((line, index) => {
    if (line.arrived && !line.expiry) refuse(`lines.${index}.expiry`, EXPIRY_MESSAGE);
  });
  refuseUnknownIds(
    'extras',
    extras.map((extra) => extra.medicineId),
    clinicFixtures.medicines.snapshot(),
    'Pick medicines the store stocks',
  );
  extras.forEach((extra, index) => {
    if (!extra.expiry) refuse(`extras.${index}.expiry`, EXPIRY_MESSAGE);
  });
  if (!lines.some((line) => line.arrived) && extras.length === 0) {
    refuse('lines', 'Tick what arrived');
  }

  const newBatch = `NEW-${order.seq}`;
  const items = [
    ...order.items.map((item, index) => {
      const line = lines[index];
      if (!line?.arrived) return item;
      return {
        ...item,
        batchNo: line.batchNo || newBatch, // NOSONAR(S6606): a blank batch takes the new one
        expiry: line.expiry,
        received: true,
      };
    }),
    ...extras.map((extra) => ({
      ...extra,
      batchNo: extra.batchNo || newBatch, // NOSONAR(S6606): a blank batch takes the new one
      received: true,
    })),
  ];
  for (const item of items) {
    if (!(item.received && item.batchNo && item.expiry)) continue;
    const medicine = await clinicFixtures.medicines.get(item.medicineId);
    await clinicFixtures.medicines.update(medicine.id, {
      batches: withStock(medicine.batches, {
        batchNo: item.batchNo,
        expiry: item.expiry,
        qty: item.qty + item.free,
        purchaseRate: item.rate,
      }),
    });
  }
  return clinicFixtures.purchaseOrders.update(id, { items, stage: 'received' });
}

// ── Sales ──

/**
 * A sale with its invoice and what is owed on it — the bill less returns and
 * what was paid — and who its ledger entries name: the patient, else the
 * walk-in's Medical contact as the payee.
 */
async function saleState(world: FixtureWorld, saleId: string) {
  const sale = await world.medicalSales.get(saleId);
  if (sale.voidedAt) conflict('This sale is void');
  const invoice = await world.invoices.get(sale.invoiceId);
  const balance = invoiceBalance(invoice, world.payments.snapshot());
  const returned = sale.returns.reduce((sum, back) => sum + back.amount, 0);
  const due = Math.max(0, balance.bill - returned - balance.paid);
  const [contact] = sale.patientId
    ? []
    : world.medicalContacts.snapshot((row) => row.id === sale.medicalContactId);
  const party = { patientId: sale.patientId, payeeName: contact?.name ?? null };
  return { sale, invoice, bill: balance.bill, paid: balance.paid, returned, due, party };
}

/**
 * Collect (KICKOFF §6.7 Money actions): one receipt for the sale's full due in
 * UPI — the Receive drawer's "Full · ₹X" preset — on the ledger against its
 * invoice, from the patient or the walk-in's Medical contact. Nothing due is a
 * 409; a closed day is the ledger's 409.
 */
export async function collectSale(
  saleId: string,
  mode: PaymentMode = 'upi',
): Promise<PaymentRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const { invoice, due, party } = await saleState(clinicFixtures, saleId);
  if (due === 0) conflict('Nothing is due on this sale');
  await assertDayOpen(invoice.branchId, clinicToday());
  return clinicFixtures.payments.create(
    newLedgerEntry({
      direction: 'received',
      kind: 'receipt',
      branchId: invoice.branchId,
      amount: due,
      splits: [{ mode, amount: due }],
      ...party,
      invoiceId: invoice.id,
    }),
  );
}

/** Each sold line's batch, quantity and unit price, by medicine and batch. */
function soldLines(invoice: Invoice) {
  return invoice.items.flatMap((item) =>
    item.medicineId && item.batchNo && item.qty > 0
      ? [
          {
            key: `${item.medicineId}·${item.batchNo}`,
            medicineId: item.medicineId,
            batchNo: item.batchNo,
            qty: item.qty,
            unit: invoiceLineAmounts(item).net / item.qty,
          },
        ]
      : [],
  );
}

/** How many of a sold line already came back. */
function returnedQty(sale: MedicalSale, medicineId: string, batchNo: string) {
  return sale.returns
    .flatMap((back) => back.items)
    .filter((item) => item.medicineId === medicineId && item.batchNo === batchNo)
    .reduce((sum, item) => sum + item.qty, 0);
}

/** Put `qty` back into each line's batch — a negative `qty` takes it out again, never below none. */
async function restock(
  world: FixtureWorld,
  lines: readonly { medicineId: string; batchNo: string; qty: number }[],
) {
  for (const line of lines) {
    const medicine = await world.medicines.get(line.medicineId);
    const known = medicine.batches.some((batch) => batch.batchNo === line.batchNo);
    if (!known) continue;
    await world.medicines.update(medicine.id, {
      batches: medicine.batches.map((batch) =>
        batch.batchNo === line.batchNo
          ? { ...batch, qty: Math.max(0, batch.qty + line.qty) }
          : batch,
      ),
    });
  }
}

/**
 * Return from patient (`returnSale`, `S:1667`): what comes back goes into its
 * batch — written off for a reaction or damage — and the sale shows "−
 * ₹550 returned". Money goes back only for what was paid beyond the new bill:
 * a credit note and a refund entry in the chosen mode; on an unpaid sale the
 * return just lowers the due (AMBER, KICKOFF §6.7).
 */
export async function returnSale(
  saleId: string,
  input: SaleReturnInput,
): Promise<SaleReturnResult> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(saleReturnInputSchema, input);
  const state = await saleState(clinicFixtures, saleId);
  const sold = new Map(soldLines(state.invoice).map((line) => [line.key, line]));
  const back = fields.lines.filter((line) => line.qty > 0);
  if (back.length === 0) refuse('lines', RETURN_NOTHING_MESSAGE);
  let amount = 0;
  back.forEach((line, index) => {
    const soldLine = sold.get(`${line.medicineId}·${line.batchNo}`);
    const left = soldLine
      ? soldLine.qty - returnedQty(state.sale, line.medicineId, line.batchNo)
      : 0;
    if (!soldLine || line.qty > left) refuse(`lines.${index}.qty`, 'More than was sold');
    amount += Math.round(soldLine.unit * line.qty);
  });

  const restocked = !WRITTEN_OFF_REASONS.has(fields.reason);
  if (restocked) await restock(clinicFixtures, back);
  await clinicFixtures.medicalSales.update(saleId, {
    returns: [
      ...state.sale.returns,
      { items: back, amount, reason: fields.reason, at: new Date().toISOString() },
    ],
  });

  // Paid beyond what the sale now bills comes back; an unpaid sale pays nothing.
  const owed = state.bill - state.returned - amount;
  const refunded = Math.min(amount, Math.max(0, state.paid - owed));
  if (refunded > 0) {
    await assertDayOpen(state.invoice.branchId, clinicToday());
    const note = await clinicFixtures.creditNotes.create({
      invoiceId: state.invoice.id,
      amount: refunded,
      reason: fields.reason,
    });
    await clinicFixtures.payments.create(
      newLedgerEntry({
        direction: 'paid',
        kind: 'refund',
        branchId: state.invoice.branchId,
        amount: refunded,
        splits: [{ mode: fields.mode, amount: refunded }],
        ...state.party,
        invoiceId: state.invoice.id,
        creditNoteId: note.id,
      }),
    );
  }
  return { amount, refunded, restocked };
}

/**
 * Void a sale (`voidSale`, `S:1668`; Q-M2): only one nothing was paid on or
 * returned from — the sale is void, its invoice cancelled, and every line's
 * stock goes back into its batch. {@link restoreSale} is its Undo.
 */
export async function voidSale(
  saleId: string,
  reason: DeleteReason,
  note: string | null,
): Promise<MedicalSale> {
  const { clinicFixtures } = await fixtureWorld();
  const state = await saleState(clinicFixtures, saleId);
  if (state.paid > 0 || state.sale.returns.length > 0) {
    conflict('Only a sale with nothing paid or returned is voided');
  }
  await restock(clinicFixtures, soldLines(state.invoice));
  await clinicFixtures.invoices.remove(state.invoice.id, reason, note);
  return clinicFixtures.medicalSales.update(saleId, {
    voidedAt: new Date().toISOString(),
  });
}

/**
 * Undo a void — the Undo of "Sale #978 voided" (`POST …/restore` in the 10s
 * window, D32; REPLACE_WITH_API — a backend request, Appendix F): its invoice
 * comes back, every line's stock leaves its batch again, and the sale is in
 * the list as it was.
 */
export async function restoreSale(saleId: string): Promise<MedicalSale> {
  const { clinicFixtures } = await fixtureWorld();
  const sale = await clinicFixtures.medicalSales.get(saleId);
  if (!sale.voidedAt) conflict('This sale is not void');
  const invoice = await clinicFixtures.invoices.restore(sale.invoiceId);
  await restock(
    clinicFixtures,
    soldLines(invoice).map((line) => ({ ...line, qty: -line.qty })),
  );
  return clinicFixtures.medicalSales.update(saleId, { voidedAt: null });
}

// ── Stock back to a supplier ──

/**
 * Return expiring stock (`medical.md:297–309`; no schema operation, Appendix
 * F): the batch drops by what goes back — capped at what it holds — and the
 * supplier gives a credit of qty × the batch's purchase rate, which lowers what
 * the room owes them.
 */
export async function returnExpiringStock(
  input: ExpiringReturnInput,
): Promise<ExpiringReturnResult> {
  const { clinicFixtures, onClinicFixturesReset } = await fixtureWorld();
  const fields = validateClinicInput(expiringReturnInputSchema, input);
  const medicine = await clinicFixtures.medicines.get(fields.medicineId);
  const supplier = await clinicFixtures.suppliers.get(fields.supplierId);
  const batch = medicine.batches.find((row) => row.batchNo === fields.batchNo);
  if (!batch || batch.qty === 0) conflict('Nothing left in this batch');
  const qty = Math.min(fields.qty, batch.qty);
  await clinicFixtures.medicines.update(medicine.id, {
    batches: medicine.batches.map((row) =>
      row.batchNo === batch.batchNo ? { ...row, qty: row.qty - qty } : row,
    ),
  });
  const credit = qty * batch.purchaseRate;
  supplierCreditStore(onClinicFixturesReset).add({
    supplierId: supplier.id,
    medicineId: medicine.id,
    batchNo: batch.batchNo,
    qty,
    amount: credit,
  });
  return { qty, credit, supplierName: supplier.name };
}

// ── Prescriptions to fill ──

/** How many prescriptions "Prescriptions to fill" lists (`S:1658`). */
const TO_FILL_LIMIT = 20;

/**
 * The prescriptions no live sale has filled yet (`listPrescriptionsToFill`,
 * `S:1658`): each with medicines, newest first, at most 20.
 */
export async function listPrescriptionsToFill(): Promise<PrescriptionToFill[]> {
  const { clinicFixtures } = await fixtureWorld();
  const filled = new Set(
    clinicFixtures.medicalSales
      .snapshot((sale) => sale.voidedAt === null && sale.prescriptionId !== null)
      .map((sale) => sale.prescriptionId),
  );
  const patients = new Map(
    clinicFixtures.patients.snapshot().map((patient) => [patient.id, patient]),
  );
  return clinicFixtures.prescriptions
    .snapshot((rx) => rx.items.length > 0 && !filled.has(rx.id))
    .sort((a, b) => compareText(b.date, a.date) || b.seq - a.seq)
    .slice(0, TO_FILL_LIMIT)
    .flatMap((rx) => {
      const patient = patients.get(rx.patientId);
      if (!patient) return [];
      return [
        {
          id: rx.id,
          seq: rx.seq,
          patientId: patient.id,
          patientName: patientName(patient),
          date: rx.date,
          medicines: rx.items.map((item) => item.medicineName),
        },
      ];
    });
}
