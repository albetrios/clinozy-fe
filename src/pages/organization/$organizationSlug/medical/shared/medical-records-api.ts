import { api } from '@/core/http/api.ts';
import type { DeleteReason } from '@/shared/api/app/app-schema.ts';
import { receivePayment } from '@/shared/api/app/payments-api.ts';
import type { LedgerRow, MoneyMode } from '@/shared/api/app/payments-contracts.ts';

import {
  type ManufacturerRow,
  manufacturerWire,
  medicalRepVisitWire,
  medicalRepWire,
  type MrRow,
  type MrVisitRow,
  type PurchaseCancelReason,
  type PurchaseOrderRow,
  purchaseOrderWire,
  type SaleRow,
  type SaleVoidReason,
  saleWire,
  type SupplierCreditRow,
  type SupplierCreditVoidReason,
  supplierCreditWire,
  type SupplierRow,
  supplierWire,
  toManufacturerRow,
  toMrRow,
  toMrVisitRow,
  toPurchaseOrderRow,
  toSaleRow,
  toSupplierCreditRow,
  toSupplierRow,
} from './medical-contracts.ts';
import {
  expiringReturnBodyOf,
  type ExpiringReturnInput,
  manufacturerChangeOf,
  manufacturerCreateBodyOf,
  type ManufacturerInput,
  medicalRepChangeOf,
  medicalRepCreateBodyOf,
  type MedicalRepInput,
  mrVisitBodyOf,
  type MrVisitInput,
  purchaseOrderChangeOf,
  purchaseOrderCreateBodyOf,
  type PurchaseOrderInput,
  purchaseOrderNoteChangeOf,
  receiveBodyOf,
  type ReceiveInput,
  saleBodyOf,
  type SaleInput,
  saleReturnBodyOf,
  type SaleReturnInput,
  supplierChangeOf,
  supplierCreateBodyOf,
  type SupplierInput,
} from './medical-records-contracts.ts';

/*
 * The Medical store's writes on clinozy-be (api-integration §5.5): suppliers, manufacturers and
 * MRs (create, edit with the read's `updated_at`, a picker's quick create, delete with its reason
 * and restore), an MR's visit, purchase orders (create, edit, cancel and its
 * Undo, Receive goods), sales (create, Collect through the ledger, a return, the void and its
 * Undo) and supplier credits (Return expiring stock, the void and its Undo). Each write carries
 * its action's idempotency key; a delete is idempotent on the server.
 */

/** An action's key, as every write takes it. */
interface Action {
  idempotencyKey: string;
}

// ── Suppliers ──

const supplierOf = (data: unknown) => toSupplierRow(supplierWire.parse(data));

/** New supplier — a taken name is a 409 on Name. */
export async function createSupplier({
  input,
  idempotencyKey,
}: Action & { input: SupplierInput }): Promise<SupplierRow> {
  const response = await api.post('/app/suppliers', {
    body: supplierCreateBodyOf(input),
    idempotencyKey,
  });
  return supplierOf(response.data);
}

/** Save a supplier — only what changed; nothing changed answers the record with no write. */
export async function updateSupplier({
  record,
  input,
  idempotencyKey,
}: Action & { record: SupplierRow; input: SupplierInput }): Promise<SupplierRow> {
  const change = supplierChangeOf(record, input);
  if (change === null) return record;
  const response = await api.patch('/app/suppliers/{supplier_id}', {
    params: { supplier_id: record.id },
    body: change,
    idempotencyKey,
  });
  return supplierOf(response.data);
}

/** "Add supplier “Shree”" from a picker — the name and the makers its picker came from, marked quick. */
export function quickCreateSupplier({
  name,
  manufacturerIds = [],
  idempotencyKey,
}: Action & { name: string; manufacturerIds?: readonly string[] }): Promise<SupplierRow> {
  return createSupplier({
    input: {
      name,
      phone: null,
      gstNumber: null,
      email: null,
      address: null,
      manufacturerIds: [...manufacturerIds],
      isQuick: true,
    },
    idempotencyKey,
  });
}

/** Delete a supplier with the Reason confirm's choice — `409 supplier_has_dues` while it is owed or has an order. */
export async function deleteSupplier(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<void> {
  await api.delete('/app/suppliers/{supplier_id}', {
    params: { supplier_id: id },
    reason,
    ...(note ? { note } : {}),
  });
}

/** Restore a deleted supplier — the toast's Undo. */
export async function restoreSupplier(
  id: string,
  idempotencyKey: string,
): Promise<SupplierRow> {
  const response = await api.post('/app/suppliers/{supplier_id}/restore', {
    params: { supplier_id: id },
    idempotencyKey,
  });
  return supplierOf(response.data);
}

// ── Manufacturers ──

const manufacturerOf = (data: unknown) => toManufacturerRow(manufacturerWire.parse(data));

/** New manufacturer — its name upper case; a taken name is a 409 on Name. */
export async function createManufacturer({
  input,
  idempotencyKey,
}: Action & { input: ManufacturerInput }): Promise<ManufacturerRow> {
  const response = await api.post('/app/manufacturers', {
    body: manufacturerCreateBodyOf(input),
    idempotencyKey,
  });
  return manufacturerOf(response.data);
}

/** Save a manufacturer — only what changed; nothing changed answers the record with no write. */
export async function updateManufacturer({
  record,
  input,
  idempotencyKey,
}: Action & {
  record: ManufacturerRow;
  input: ManufacturerInput;
}): Promise<ManufacturerRow> {
  const change = manufacturerChangeOf(record, input);
  if (change === null) return record;
  const response = await api.patch('/app/manufacturers/{manufacturer_id}', {
    params: { manufacturer_id: record.id },
    body: change,
    idempotencyKey,
  });
  return manufacturerOf(response.data);
}

/** "Add manufacturer “GALDERMA”" from a picker — the name only, marked quick. */
export function quickCreateManufacturer({
  name,
  idempotencyKey,
}: Action & { name: string }): Promise<ManufacturerRow> {
  return createManufacturer({
    input: { name, tone: 'lav', supplierIds: [], mrIds: [], isQuick: true },
    idempotencyKey,
  });
}

/** Delete a manufacturer with the Reason confirm's choice — refused while a live medicine names it. */
export async function deleteManufacturer(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<void> {
  await api.delete('/app/manufacturers/{manufacturer_id}', {
    params: { manufacturer_id: id },
    reason,
    ...(note ? { note } : {}),
  });
}

/** Restore a deleted manufacturer — the toast's Undo. */
export async function restoreManufacturer(
  id: string,
  idempotencyKey: string,
): Promise<ManufacturerRow> {
  const response = await api.post('/app/manufacturers/{manufacturer_id}/restore', {
    params: { manufacturer_id: id },
    idempotencyKey,
  });
  return manufacturerOf(response.data);
}

// ── MRs ──

const mrOf = (data: unknown) => toMrRow(medicalRepWire.parse(data));

/** New MR. */
export async function createMedicalRep({
  input,
  idempotencyKey,
}: Action & { input: MedicalRepInput }): Promise<MrRow> {
  const response = await api.post('/app/medical-reps', {
    body: medicalRepCreateBodyOf(input),
    idempotencyKey,
  });
  return mrOf(response.data);
}

/** Save an MR — only what changed; nothing changed answers the record with no write. */
export async function updateMedicalRep({
  record,
  input,
  idempotencyKey,
}: Action & { record: MrRow; input: MedicalRepInput }): Promise<MrRow> {
  const change = medicalRepChangeOf(record, input);
  if (change === null) return record;
  const response = await api.patch('/app/medical-reps/{medical_rep_id}', {
    params: { medical_rep_id: record.id },
    body: change,
    idempotencyKey,
  });
  return mrOf(response.data);
}

/** "Add MR “Rakesh”" from a picker — the name only. */
export function quickCreateMedicalRep({
  name,
  idempotencyKey,
}: Action & { name: string }): Promise<MrRow> {
  return createMedicalRep({
    input: { name, phone: null, nextVisitOn: null, manufacturerIds: [] },
    idempotencyKey,
  });
}

/** Delete an MR with the Reason confirm's choice. */
export async function deleteMedicalRep(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<void> {
  await api.delete('/app/medical-reps/{medical_rep_id}', {
    params: { medical_rep_id: id },
    reason,
    ...(note ? { note } : {}),
  });
}

/** Restore a deleted MR — the toast's Undo. */
export async function restoreMedicalRep(
  id: string,
  idempotencyKey: string,
): Promise<MrRow> {
  const response = await api.post('/app/medical-reps/{medical_rep_id}/restore', {
    params: { medical_rep_id: id },
    idempotencyKey,
  });
  return mrOf(response.data);
}

/** Log MR visit — sets the MR's next visit when one is given. */
export async function logMrVisit({
  input,
  idempotencyKey,
}: Action & { input: MrVisitInput }): Promise<MrVisitRow> {
  const response = await api.post('/app/medical-reps/{medical_rep_id}/visits', {
    params: { medical_rep_id: input.mrId },
    body: mrVisitBodyOf(input),
    idempotencyKey,
  });
  return toMrVisitRow(medicalRepVisitWire.parse(response.data));
}

// ── Purchase orders ──

const orderOf = (data: unknown) => toPurchaseOrderRow(purchaseOrderWire.parse(data));

/** New purchase order — Ordered, nothing paid; a typed medicine becomes a quick one (MD26). */
export async function createPurchaseOrder({
  input,
  idempotencyKey,
}: Action & { input: PurchaseOrderInput }): Promise<PurchaseOrderRow> {
  const response = await api.post('/app/medical-purchase-orders', {
    body: purchaseOrderCreateBodyOf(input),
    idempotencyKey,
  });
  return orderOf(response.data);
}

/**
 * Save an Ordered order — only what changed, with the read's `updated_at`; a received one is a
 * 409. Nothing changed answers the order with no write.
 */
export async function updatePurchaseOrder({
  record,
  input,
  idempotencyKey,
}: Action & {
  record: PurchaseOrderRow;
  input: PurchaseOrderInput;
}): Promise<PurchaseOrderRow> {
  const change = purchaseOrderChangeOf(record, input);
  if (change === null) return record;
  const response = await api.patch(
    '/app/medical-purchase-orders/{medical_purchase_order_id}',
    {
      params: { medical_purchase_order_id: record.id },
      body: change,
      idempotencyKey,
    },
  );
  return orderOf(response.data);
}

/**
 * Save a received order's note — the one change a received order takes (D10), with the read's
 * `updated_at`. An unchanged note answers the order with no write.
 */
export async function updatePurchaseOrderNote({
  record,
  note,
  idempotencyKey,
}: Action & {
  record: PurchaseOrderRow;
  note: string | null;
}): Promise<PurchaseOrderRow> {
  const change = purchaseOrderNoteChangeOf(record, note);
  if (change === null) return record;
  const response = await api.patch(
    '/app/medical-purchase-orders/{medical_purchase_order_id}',
    {
      params: { medical_purchase_order_id: record.id },
      body: change,
      idempotencyKey,
    },
  );
  return orderOf(response.data);
}

/** Cancel an Ordered order with why — the cancel is the delete (MD15); stock and dues are untouched. */
export async function cancelPurchaseOrder(
  id: string,
  reason: PurchaseCancelReason,
  note: string | null,
): Promise<void> {
  await api.delete('/app/medical-purchase-orders/{medical_purchase_order_id}', {
    params: { medical_purchase_order_id: id },
    reason,
    ...(note ? { note } : {}),
  });
}

/** Undo a cancel — the toast's Undo: the order is Ordered again. */
export async function restorePurchaseOrder(
  id: string,
  idempotencyKey: string,
): Promise<PurchaseOrderRow> {
  const response = await api.post(
    '/app/medical-purchase-orders/{medical_purchase_order_id}/restore',
    { params: { medical_purchase_order_id: id }, idempotencyKey },
  );
  return orderOf(response.data);
}

/**
 * Receive goods: each arrived line becomes stock in its batch (`NEW-<n>` when none is typed) at its
 * rate, what came unordered joins the order (MD26), and the order is Received — its bill the
 * supplier's due.
 */
export async function receivePurchaseOrder({
  id,
  input,
  idempotencyKey,
}: Action & { id: string; input: ReceiveInput }): Promise<PurchaseOrderRow> {
  const response = await api.post(
    '/app/medical-purchase-orders/{medical_purchase_order_id}/receive',
    {
      params: { medical_purchase_order_id: id },
      body: receiveBodyOf(input),
      idempotencyKey,
    },
  );
  return orderOf(response.data);
}

// ── Sales ──

const saleOf = (data: unknown) => toSaleRow(saleWire.parse(data));

/**
 * New sale: the server draws each line from its batches by earliest expiry and prices it at the
 * MRP; "Paid now" is a receipt — `409 not_enough_stock`, `prescription_filled`, `day_closed`.
 */
export async function createSale({
  input,
  idempotencyKey,
}: Action & { input: SaleInput }): Promise<SaleRow> {
  const response = await api.post('/app/medical-sales', {
    body: saleBodyOf(input),
    idempotencyKey,
  });
  return saleOf(response.data);
}

/**
 * Collect: one receipt for the sale's whole due on the ledger, against its invoice, from its buyer
 * (`POST /app/payments`) — `409 more_than_due`, `day_closed`.
 */
export function collectSale({
  sale,
  mode,
  idempotencyKey,
}: Action & { sale: SaleRow; mode: MoneyMode }): Promise<LedgerRow> {
  if (!(sale.customer && sale.invoice)) {
    return Promise.reject(
      new Error('medical: a sale without a buyer or invoice has nothing to collect'),
    );
  }
  return receivePayment({
    input: {
      branchId: sale.branchId,
      contactId: sale.customer.id,
      invoiceId: sale.invoice.id,
      splits: [{ mode, amount: sale.due }],
      reference: null,
      note: null,
    },
    idempotencyKey,
  });
}

/**
 * Return from patient (route 50): on a sale paid in full (`409 sale_not_paid` — collect first),
 * with `payment:delete` — the credit note and its refund, or as store credit a `give` pending
 * credit (MD33). Answers the sale.
 */
export async function returnSale({
  id,
  input,
  idempotencyKey,
}: Action & { id: string; input: SaleReturnInput }): Promise<SaleRow> {
  const response = await api.post('/app/medical-sales/{medical_sale_id}/returns', {
    params: { medical_sale_id: id },
    body: saleReturnBodyOf(input),
    idempotencyKey,
  });
  return saleOf(response.data);
}

/** Void a sale with why — only with nothing paid or returned; the stock goes back, the invoice goes. */
export async function voidSale(
  id: string,
  reason: SaleVoidReason,
  note: string | null,
): Promise<void> {
  await api.delete('/app/medical-sales/{medical_sale_id}', {
    params: { medical_sale_id: id },
    reason,
    ...(note ? { note } : {}),
  });
}

/** Undo a void — the toast's Undo: the stock leaves its batches again, the invoice comes back. */
export async function restoreSale(id: string, idempotencyKey: string): Promise<SaleRow> {
  const response = await api.post('/app/medical-sales/{medical_sale_id}/restore', {
    params: { medical_sale_id: id },
    idempotencyKey,
  });
  return saleOf(response.data);
}

// ── Supplier credits ──

const creditOf = (data: unknown) => toSupplierCreditRow(supplierCreditWire.parse(data));

/**
 * Return expiring stock: the packs leave the batch (`409 not_enough_stock`) and the supplier owes
 * them back at the batch's rate, applied to its dues at once.
 */
export async function createSupplierCredit({
  input,
  idempotencyKey,
}: Action & { input: ExpiringReturnInput }): Promise<SupplierCreditRow> {
  const response = await api.post('/app/suppliers/{supplier_id}/credits', {
    params: { supplier_id: input.supplierId },
    body: expiringReturnBodyOf(input),
    idempotencyKey,
  });
  return creditOf(response.data);
}

/** Void a supplier credit with why (MD32): its packs go back, the supplier's dues rise by it. */
export async function voidSupplierCredit({
  supplierId,
  creditId,
  reason,
  note,
}: {
  supplierId: string;
  creditId: string;
  reason: SupplierCreditVoidReason;
  note: string | null;
}): Promise<void> {
  await api.delete('/app/suppliers/{supplier_id}/credits/{supplier_credit_id}', {
    params: { supplier_id: supplierId, supplier_credit_id: creditId },
    reason,
    ...(note ? { note } : {}),
  });
}

/** Undo a supplier credit's void — the packs leave the batch again (`409 not_enough_stock`). */
export async function restoreSupplierCredit({
  supplierId,
  creditId,
  idempotencyKey,
}: Action & { supplierId: string; creditId: string }): Promise<SupplierCreditRow> {
  const response = await api.post(
    '/app/suppliers/{supplier_id}/credits/{supplier_credit_id}/restore',
    {
      params: { supplier_id: supplierId, supplier_credit_id: creditId },
      idempotencyKey,
    },
  );
  return creditOf(response.data);
}
