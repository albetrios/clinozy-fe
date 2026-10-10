import { z } from 'zod';

import {
  civilDateSchema,
  offeringSchema,
  offerSchema,
  paiseSchema,
} from './clinic-schema.ts';

/*
 * The fixture world's offerings and offers, for the rooms still on fixtures: the Invoice
 * drawer (Payments, and its Medical sale mode), its stacked "New offering" and the fixture
 * invoices, plans and patient records they seed from. Money in paise, ids uuids. The Offerings
 * room itself reads clinozy-be (`offerings-contracts.ts`); this module goes with the last
 * fixture room that reads an offering.
 */

// ── Records ──

/**
 * An offering as the fixture rooms read it: the contract's `Offering` (`S:557–577`) without
 * the default doctor and room the API has no field for (§6 #10, O6), plus the plan's fields.
 */
export const offeringRecordSchema = offeringSchema
  .omit({ defaultDoctorId: true, room: true })
  .extend({
    /**
     * What the desk bills before any offer, in paise; `null` bills the list price ("leave
     * empty = list price", `offerings.md:66`).
     */
    offerPrice: paiseSchema.nullable(),
    /** Where it is sold ("Available at"); empty = every branch. */
    branchIds: z.array(z.uuid()),
    /** Whether the prices include GST (Q-O3); exclusive by default. */
    gstInclusive: z.boolean(),
    /** Extra words the search matches ("laser, face, hair removal"). */
    searchTerms: z.array(z.string()),
    /** What is included — the list's sub-line. */
    description: z.string().nullable(),
    /** GST as a number (Appendix F) — the contract's five whole rates, or any other. */
    gstPct: z.number().nonnegative(),
    /** Who last saved it (`updatedById` on `_Common`, Appendix F). */
    updatedById: z.uuid(),
  });

/** A fixture offering record — the contract's fields and the plan's. */
export type OfferingRecord = z.infer<typeof offeringRecordSchema>;

/**
 * An offer as the fixture rooms read it: the contract's `Offer` (`S:579–600`) with the plan's
 * open start ("Now") and open end ("no end"), and who last saved it; `branchIds` empty = every
 * branch.
 */
export const offerRecordSchema = offerSchema.extend({
  startsOn: civilDateSchema.nullable(),
  endsOn: civilDateSchema.nullable(),
  /** Who last saved it (`updatedById` on `_Common`, Appendix F). */
  updatedById: z.uuid(),
});

/** A fixture offer record — the contract's fields with the plan's open dates. */
export type OfferRecord = z.infer<typeof offerRecordSchema>;

/**
 * An offer's derived state (`S:101, 1735`; never stored) in the Offers tab's order — Running,
 * Scheduled, Paused, Ended (H:5477). clinozy-be works it out itself (`status`, O10).
 */
export type OfferState = 'live' | 'scheduled' | 'paused' | 'ended';

// ── The stacked "New offering" ──

/** The `_Common` audit fields and the id — the server sets them, a client never sends them. */
const SERVER_SET = {
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  deleteReason: true,
  deleteNote: true,
} as const;

/**
 * Every field the stacked "New offering" stores, with the contract's ranges (`S:557–577`) and
 * the plan's: a duration of 0 shows "—", any GST rate 0–100, up to 20 branches.
 */
const offeringFieldsSchema = offeringRecordSchema
  .omit({ ...SERVER_SET, seq: true })
  .extend({
    name: z.string().trim().min(1, 'Add a name').max(120),
    durationMin: z.number().int().min(0).max(480),
    sessions: z.number().int().min(1).max(99),
    validityDays: z.number().int().min(0).max(1095),
    gstPct: z.number().min(0).max(100),
    branchIds: z.array(z.uuid()).max(20),
    searchTerms: z.array(z.string().trim().min(1)),
    description: z.string().trim().max(1000).nullable(),
  });

/** An offering's full input — what a fixture create stores. */
type OfferingInput = z.infer<typeof offeringFieldsSchema>;

/**
 * {@link offeringFieldsSchema} with its cross-field rules (H:5507): the offer price never above
 * the price, the lowest price never above the offer price.
 */
export const offeringInputSchema = offeringFieldsSchema.superRefine((offering, ctx) => {
  if (offering.offerPrice !== null && offering.offerPrice > offering.price) {
    ctx.addIssue({
      code: 'custom',
      path: ['offerPrice'],
      message: 'Offer price can’t be above the price',
    });
  }
  if (offering.minPrice > (offering.offerPrice ?? offering.price)) {
    ctx.addIssue({
      code: 'custom',
      path: ['minPrice'],
      message: 'Lowest price can’t be above the offer price',
    });
  }
});

/**
 * A new fixture offering's starting values: Treatment, sage, 1 session, 30 min, no validity, GST
 * 0 exclusive, Active, every branch (`offerings.md:315`; `S:557–577` defaults). No offer price,
 * and no automatic lowest price (Q-O4). The specialty is the clinic's first (Q-O6), filled in
 * by the create.
 */
export const OFFERING_DEFAULTS: Readonly<
  Omit<OfferingInput, 'name' | 'price' | 'specialty'>
> = {
  category: 'treatment',
  tone: 'sage',
  offerPrice: null,
  minPrice: 0,
  durationMin: 30,
  sessions: 1,
  validityDays: 0,
  gstPct: 0,
  gstInclusive: false,
  active: true,
  branchIds: [],
  searchTerms: [],
  description: null,
};

/**
 * A fixture create: the name and price are required and every other field falls back to
 * {@link OFFERING_DEFAULTS} — a fresh record, never a copy of another (H:4070, §7.3).
 */
export type OfferingCreateInput = Pick<OfferingInput, 'name' | 'price'> &
  Partial<OfferingInput>;
