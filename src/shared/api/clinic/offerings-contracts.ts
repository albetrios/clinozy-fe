import { z } from 'zod';

import {
  civilDateSchema,
  offeringCategorySchema,
  offeringSchema,
  offeringSpecialtySchema,
  offerSchema,
  paiseSchema,
} from './clinic-schema.ts';

/*
 * The Offerings domain beyond the generated contract (KICKOFF §6.11 Data, D22):
 * the plan-only fields the screens show — each a fixture field until clinozy-be
 * serves it (Appendix F, REPLACE_WITH_API) — the derived offer state, what a
 * client sends to create or update an offering or an offer, and the list reads'
 * params. Read by the Offerings room, the Invoice drawer and the booking drawer.
 */

// ── Records ──

/**
 * An offering as the rooms read it: the contract's `Offering` (`S:557–577`)
 * plus the plan's fields (Appendix F, REPLACE_WITH_API).
 */
export const offeringRecordSchema = offeringSchema.extend({
  /**
   * What the desk bills before any offer, in paise; `null` bills the list
   * price ("leave empty = list price", `offerings.md:66`).
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
  /** Who last saved it — the "Updated" cell (`updatedById` on `_Common`, Appendix F). */
  updatedById: z.uuid(),
});

/** An offering record — the contract's fields and the plan's. */
export type OfferingRecord = z.infer<typeof offeringRecordSchema>;

/**
 * An offer as the rooms read it: the contract's `Offer` (`S:579–600`) with the
 * plan's open start ("Now") and open end ("no end"), and who last saved it;
 * `branchIds` empty = every branch (Appendix F, REPLACE_WITH_API).
 */
export const offerRecordSchema = offerSchema.extend({
  startsOn: civilDateSchema.nullable(),
  endsOn: civilDateSchema.nullable(),
  /** Who last saved it — the "Updated" cell (`updatedById` on `_Common`, Appendix F). */
  updatedById: z.uuid(),
});

/** An offer record — the contract's fields with the plan's open dates. */
export type OfferRecord = z.infer<typeof offerRecordSchema>;

/**
 * An offer's derived state (`S:101, 1735`; never stored) in the Offers tab's
 * order — Running, Scheduled, Paused, Ended (H:5477). `live` is labelled
 * "Running".
 */
export const OFFER_STATE_VALUES = ['live', 'scheduled', 'paused', 'ended'] as const;

/** Zod enum of the derived offer state. */
const offerStateSchema = z.enum(OFFER_STATE_VALUES);

/** One derived offer state. */
export type OfferState = z.infer<typeof offerStateSchema>;

// ── Writes ──

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
 * Every field a client sends for an offering, with the contract's ranges
 * (`S:557–577`) and the plan's: a duration of 0 shows "—", any GST rate
 * 0–100, up to 20 branches.
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

/** An offering's full input — what a create stores and an update re-checks once merged. */
export type OfferingInput = z.infer<typeof offeringFieldsSchema>;

/**
 * {@link offeringFieldsSchema} with its cross-field rules (H:5507): the offer
 * price never above the price, the lowest price never above the offer price.
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
 * A new offering's starting values: Treatment, sage, 1 session, 30 min, no
 * validity, GST 0 exclusive, Active, every branch (`offerings.md:315`;
 * `S:557–577` defaults). No offer price, and no automatic lowest price (Q-O4).
 * The specialty is the clinic's first (Q-O6), filled in by the create.
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
  defaultDoctorId: null,
  room: null,
  gstPct: 0,
  gstInclusive: false,
  active: true,
  branchIds: [],
  searchTerms: [],
  description: null,
};

/**
 * A create: the name and price are required and every other field falls back
 * to {@link OFFERING_DEFAULTS} — a fresh record, never a copy of another
 * (H:4070, §7.3).
 */
export type OfferingCreateInput = Pick<OfferingInput, 'name' | 'price'> &
  Partial<OfferingInput>;

/** An update: any of the fields; the server re-checks the merged record. */
export type OfferingPatch = Partial<OfferingInput>;

/** The four kinds' value ranges (`S:587`) and the toast each names (H:5521). */
const OFFER_VALUE_RANGES = {
  percent: { min: 1, max: 100, message: 'Set the discount' },
  amount: { min: 1, max: Number.MAX_SAFE_INTEGER, message: 'Set the amount' },
  fixed: { min: 1, max: Number.MAX_SAFE_INTEGER, message: 'Set the amount' },
  extra: { min: 1, max: 20, message: 'Set the free sessions' },
} as const;

/**
 * Every field a client sends for an offer, with the contract's ranges
 * (`S:579–600`) and the plan's: the note up to 1,000 characters (AMBER), no
 * branches meaning every branch.
 */
const offerFieldsSchema = offerRecordSchema.omit(SERVER_SET).extend({
  name: z.string().trim().min(1, 'Name the offer').max(80),
  code: z
    .string()
    .max(16)
    .regex(/^[A-Z0-9]*$/, 'Use capital letters and digits only')
    .nullable(),
  offeringIds: z.array(z.uuid()).min(1, 'Pick at least one offering').max(50),
  branchIds: z.array(z.uuid()).max(20),
  note: z.string().trim().max(1000).nullable(),
});

/** An offer's full input — what a create stores and an update re-checks once merged. */
export type OfferInput = z.infer<typeof offerFieldsSchema>;

/**
 * {@link offerFieldsSchema} with its cross-field rules: the value in its kind's
 * range (percent 1–100, amounts at least ₹0.01, 1–20 extra sessions) and the
 * end never before the start (H:5521).
 */
export const offerInputSchema = offerFieldsSchema.superRefine((offer, ctx) => {
  const range = OFFER_VALUE_RANGES[offer.kind];
  if (offer.value < range.min || offer.value > range.max) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: range.message });
  }
  if (offer.startsOn !== null && offer.endsOn !== null && offer.endsOn < offer.startsOn) {
    ctx.addIssue({ code: 'custom', path: ['endsOn'], message: 'Ends before it starts' });
  }
});

/**
 * A new offer's starting values: "% off" at 10, blush, every branch, no dates
 * ("Now" – "no end"), Live (`offerings.md:316`).
 */
export const OFFER_DEFAULTS: Readonly<Omit<OfferInput, 'name' | 'offeringIds'>> = {
  code: null,
  kind: 'percent',
  value: 10,
  branchIds: [],
  startsOn: null,
  endsOn: null,
  paused: false,
  tone: 'blush',
  note: null,
};

/**
 * A create: the name and the offerings are required and every other field
 * falls back to {@link OFFER_DEFAULTS}.
 */
export type OfferCreateInput = Pick<OfferInput, 'name' | 'offeringIds'> &
  Partial<OfferInput>;

/** An update: any of the fields; the server re-checks the merged record. */
export type OfferPatch = Partial<OfferInput>;

// ── List reads ──

/** The offerings list's sort keys (`S:1734`: `updatedAt` by default; name, price, category). */
const OFFERING_SORT_KEYS = ['updatedAt', 'name', 'price', 'category'] as const;

/**
 * `listOfferings`' params (`S:1734`), passed through to clinozy-be when the API
 * lands. `q` matches the name, the search terms and "#274" (H:5454). The rooms
 * read the whole catalogue and search, filter and sort it in place (KICKOFF
 * §6.11 Lists, AMBER), so these stay optional.
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const offeringListParamsSchema = z.object({
  q: z.string().max(80).optional(),
  category: offeringCategorySchema.optional(),
  specialty: offeringSpecialtySchema.optional(),
  sort: z.enum(OFFERING_SORT_KEYS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

/** Params of the offerings list read. */
export type OfferingListParams = z.infer<typeof offeringListParamsSchema>;

/**
 * `listOffers`' params (`S:1735`): the derived `state`, and `q` on the name,
 * the code and the offerings' names (H:5476). Sorted by `startsOn`, newest
 * first.
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const offerListParamsSchema = z.object({
  q: z.string().max(80).optional(),
  state: offerStateSchema.optional(),
});

/** Params of the offers list read. */
export type OfferListParams = z.infer<typeof offerListParamsSchema>;
