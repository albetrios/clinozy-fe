import { z } from 'zod';

import {
  civilDateSchema,
  phoneSchema,
  type PoStage,
  type Tone,
  toneSchema,
} from '@/shared/api/app/app-schema.ts';

/*
 * What a client sends for the Medical store's partners — suppliers,
 * manufacturers and MRs — and an MR's visits (KICKOFF §6.7 Drawers; `S:741–793`,
 * "create/update Supplier, Manufacturer, MR", `S:1675`). The drawers hold
 * their own form values; these are the writes' contracts, checked again by the
 * fixture server until clinozy-be answers (REPLACE_WITH_API).
 */

/** "Add a name" — each partner's one required field (`medical.md:194, 212, 228`). */
export const PARTNER_NAME_MESSAGE = 'Add a name';

/** The six colours a manufacturer takes, in the swatch row's order (`medical.md:213`). */
export const MANUFACTURER_TONES: readonly Tone[] = [
  'lav',
  'sky',
  'butter',
  'blush',
  'sage',
  'mint',
];

/** A name the drawers send: trimmed, required. */
const nameSchema = (max: number) =>
  z.string().trim().min(1, PARTNER_NAME_MESSAGE).max(max);

/** Supplier: Agency name* · Phone · GST number · the makers it distributes (`medical.md:190–200`). */
export const supplierInputSchema = z.object({
  name: nameSchema(120),
  phone: phoneSchema.nullable(),
  /** A GSTIN is 15 characters; the design takes it as typed. */
  gstNumber: z.string().trim().max(20).nullable(),
  manufacturerIds: z.array(z.uuid()).max(50),
});

/** What a supplier save sends. */
export type SupplierInput = z.infer<typeof supplierInputSchema>;

/**
 * Manufacturer: Name* (upper case, as the pack prints it) · Colour · who
 * distributes and represents it (`medical.md:208–216`). The links live on the
 * suppliers and MRs; the server writes them there.
 */
export const manufacturerInputSchema = z.object({
  name: nameSchema(40).transform((name) => name.toUpperCase()),
  tone: toneSchema,
  supplierIds: z.array(z.uuid()).max(50),
  mrIds: z.array(z.uuid()).max(50),
});

/** What a manufacturer save sends. */
export type ManufacturerInput = z.input<typeof manufacturerInputSchema>;

/** MR: Name* · Phone · Next visit · the makers they represent (`medical.md:224–231`). */
export const medicalRepInputSchema = z.object({
  name: nameSchema(120),
  phone: phoneSchema.nullable(),
  nextVisitOn: civilDateSchema.nullable(),
  manufacturerIds: z.array(z.uuid()).max(50),
});

/** What an MR save sends. */
export type MedicalRepInput = z.infer<typeof medicalRepInputSchema>;

/**
 * Log MR visit (`logMRVisit`, `S:1676`): the visit's date, samples and note,
 * and the next visit it sets on the MR (`medical.md:239–251`).
 */
export const mrVisitInputSchema = z.object({
  mrId: z.uuid(),
  date: civilDateSchema,
  nextVisitOn: civilDateSchema.nullable(),
  samples: z.string().trim().max(120).nullable(),
  notes: z.string().trim().max(1000).nullable(),
});

/** What a visit log sends. */
export type MrVisitInput = z.infer<typeof mrVisitInputSchema>;

/**
 * One row of a supplier's Account (`medical.md:200`): a purchase order — its
 * stage, total and what is still owed on it — or a credit from returned stock.
 */
export type SupplierAccountRow =
  | {
      kind: 'order';
      id: string;
      seq: number;
      billNo: string | null;
      date: string;
      stage: PoStage;
      /** The order's total, paise. */
      amount: number;
      /** Owed on a received order not paid in full; 0 otherwise. */
      due: number;
    }
  | {
      kind: 'credit';
      id: string;
      /** The returned batch: "Credit · 026-312". */
      batchNo: string;
      date: string;
      /** The credit, paise (shown as a minus). */
      amount: number;
    };
