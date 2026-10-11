import { z } from 'zod';

import {
  civilDateSchema,
  offeringSchema,
  offerSchema,
  paiseSchema,
} from './app-schema.ts';

/*
 * The fixture world's offerings and offers, for the room still on fixtures: Medical's sale
 * server and the fixture invoices and patient records it seeds from. Money in paise, ids uuids.
 * The Offerings room and the Invoice drawer read clinozy-be (`offerings-contracts.ts`, D153,
 * D156); this module goes with Medical.
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
