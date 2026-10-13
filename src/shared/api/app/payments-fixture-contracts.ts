import { z } from 'zod';

import {
  isoDateTimeSchema,
  paiseSchema,
  paymentModeSchema,
  paymentSchema,
} from './app-schema.ts';

/*
 * The fixture world's ledger entries — what the chat column's lead and patient history still
 * reads (`messages-api.ts`: "Received ₹9,000 · UPI · #782"). Money is paise here. Every room
 * reads clinozy-be's ledger (`payments-contracts.ts`); this goes with the chat's fixture path.
 */

// ── Ledger entries ──

/** The amount and the modes of an entry, before or after an edit. */
const paymentEditSideSchema = z.object({
  amount: paiseSchema,
  modes: z.array(paymentModeSchema),
});

/** One logged change of a fixture entry while its day is open. */
const paymentEditSchema = z.object({
  at: isoDateTimeSchema,
  byId: z.uuid(),
  from: paymentEditSideSchema,
  to: paymentEditSideSchema,
});

/**
 * A fixture ledger entry: the contract's `Payment` (`S:643–664`) with the plan's Reference, edit
 * log and bill photos (Appendix F).
 */
export const paymentRecordSchema = paymentSchema.extend({
  reference: z.string().max(60).nullable(),
  edits: z.array(paymentEditSchema),
  attachmentKeys: z.array(z.string()),
});

/** A fixture ledger entry, in paise. */
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;
