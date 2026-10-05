import { z } from 'zod';

import {
  civilDateSchema,
  expiryMonthSchema,
  paiseSchema,
} from '@/shared/api/clinic/clinic-schema.ts';

/*
 * What the Medical flows send and answer (KICKOFF §6.7; `medical.md:254–309`,
 * `S:1666–1677`): a purchase order and its receipt, a sale's return, a void,
 * the expiring-stock return to a supplier and the prescriptions still to fill.
 */

/** "Pick a supplier" — a purchase order's one required field (`medical.md:259`). */
export const PICK_SUPPLIER_MESSAGE = 'Pick a supplier';

/** A purchase line's rate is required once a medicine is picked (`medical.md:259`). */
const PURCHASE_RATE_MESSAGE = 'Enter the purchase rate';

/** An arrived line needs its expiry (KICKOFF §6.7, AMBER: the prototype invents "12/27"). */
export const EXPIRY_MESSAGE = 'Enter the expiry';

/** A return with nothing coming back (`medical.md:288`). */
export const RETURN_NOTHING_MESSAGE = 'Enter what is being returned';

/** One line of a purchase order: the medicine, how many, the free units and the rate. */
const purchaseOrderLineInputSchema = z.object({
  medicineId: z.uuid(),
  qty: z.number().int().positive().max(9999),
  free: z.number().int().nonnegative().max(9999),
  rate: paiseSchema.positive(PURCHASE_RATE_MESSAGE),
});

/**
 * New / Edit purchase order (`medical.md:254–267`; `createPO` / `updatePO`,
 * `S:1670–1671`): the supplier, its bill number, the order date and the lines.
 */
export const purchaseOrderInputSchema = z.object({
  supplierId: z.uuid(PICK_SUPPLIER_MESSAGE),
  supplierBillNo: z.string().trim().max(40).nullable(),
  date: civilDateSchema,
  items: z.array(purchaseOrderLineInputSchema).max(100),
});

/** What a purchase-order save sends. */
export type PurchaseOrderInput = z.infer<typeof purchaseOrderInputSchema>;

/** One line of Receive goods: whether it arrived, its batch and expiry (`medical.md:271–275`). */
const receiveLineInputSchema = z.object({
  arrived: z.boolean(),
  batchNo: z.string().trim().max(30).nullable(),
  expiry: expiryMonthSchema.nullable(),
});

/** Receive goods (`receivePO`, `S:1672`): every line of the order, in its order. */
export const receiveInputSchema = z.object({
  lines: z.array(receiveLineInputSchema).max(100),
});

/** What Receive goods sends. */
export type ReceiveInput = z.infer<typeof receiveInputSchema>;

/** The reasons a patient brings medicine back (`medical.md:289`), in chip order. */
export const SALE_RETURN_REASONS = [
  'unused',
  'reaction',
  'rx_changed',
  'wrong_item',
  'damaged',
] as const;

/** One return reason. */
export type SaleReturnReason = (typeof SALE_RETURN_REASONS)[number];

/** A reaction or damage writes the stock off; the rest goes back into its batch (`medical.md:293`). */
export const WRITTEN_OFF_REASONS: ReadonlySet<SaleReturnReason> = new Set([
  'reaction',
  'damaged',
]);

/** How a refund is paid back (`medical.md:290`). */
export const REFUND_MODES = ['cash', 'upi', 'card'] as const;

/** One refund mode. */
export type RefundMode = (typeof REFUND_MODES)[number];

/** Return from patient (`returnSale`, `S:1667`): how many of each sold line come back, why and how. */
export const saleReturnInputSchema = z.object({
  lines: z
    .array(
      z.object({
        medicineId: z.uuid(),
        batchNo: z.string(),
        qty: z.number().int().nonnegative(),
      }),
    )
    .max(50),
  reason: z.enum(SALE_RETURN_REASONS),
  mode: z.enum(REFUND_MODES),
});

/** What a return sends. */
export type SaleReturnInput = z.infer<typeof saleReturnInputSchema>;

/** What a return answers: its worth, what was paid back and whether the stock went back. */
export interface SaleReturnResult {
  amount: number;
  /** Paid back to the customer — 0 when the return only lowered the due. */
  refunded: number;
  restocked: boolean;
}

/** Return expiring stock (`medical.md:297–309`; no schema operation, Appendix F). */
export const expiringReturnInputSchema = z.object({
  medicineId: z.uuid(),
  batchNo: z.string(),
  supplierId: z.uuid(PICK_SUPPLIER_MESSAGE),
  qty: z.number().int().positive(),
});

/** What an expiring-stock return sends. */
export type ExpiringReturnInput = z.infer<typeof expiringReturnInputSchema>;

/** What it answers: how many went back and the credit they earned, from whom. */
export interface ExpiringReturnResult {
  qty: number;
  credit: number;
  supplierName: string;
}

/** A prescription still to fill (`listPrescriptionsToFill`, `S:1658`). */
export interface PrescriptionToFill {
  id: string;
  seq: number;
  patientId: string;
  patientName: string;
  date: string;
  /** Its medicine names, in order. */
  medicines: string[];
}
