import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import { apiErrorReason } from '@/shared/errors/errorHandler.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';

import {
  type OfferingCategory,
  offeringCategorySchema,
  type OfferingSpecialty,
  offeringSpecialtySchema,
  type OfferKind,
  offerKindSchema,
  type Tone,
  toneSchema,
} from './clinic-schema.ts';

/*
 * The Offerings domain on clinozy-be (`/app/offerings`, `/app/offers`, api-integration §5.9): an
 * offering is what the clinic sells — its prices in rupees, as the API sends them (D148 Q10) —
 * and an offer a time-boxed price on some of them, its `status` worked out by the server on the
 * clinic's today (O10). The rooms read both whole and search, filter and sort them in place. A
 * write sends what changed and nothing else, and never the lowest price without
 * `offering:lower_price:read` (O15, D81).
 */

// ── The wire ──

type ApiOffering = NonNullable<ApiData<'/app/offerings/{offering_id}', 'get'>>;
type ApiOfferingRow = NonNullable<ApiData<'/app/offerings', 'get'>>[number];
type ApiOffer = NonNullable<ApiData<'/app/offers/{offer_id}', 'get'>>;
type ApiOfferRow = NonNullable<ApiData<'/app/offers', 'get'>>[number];
type ApiOrganization = NonNullable<ApiData<'/tenancy/organization', 'get'>>;

/** A new offering as `POST /app/offerings` takes it. */
export type ApiOfferingCreate = NonNullable<ApiBody<'/app/offerings', 'post'>>;
/** An offering change as `PATCH /app/offerings/:offering_id` takes it. */
export type ApiOfferingChange = NonNullable<
  ApiBody<'/app/offerings/{offering_id}', 'patch'>
>;
/** A new offer as `POST /app/offers` takes it. */
export type ApiOfferCreate = NonNullable<ApiBody<'/app/offers', 'post'>>;
/** An offer change as `PATCH /app/offers/:offer_id` takes it. */
export type ApiOfferChange = NonNullable<ApiBody<'/app/offers/{offer_id}', 'patch'>>;

/** The GST rates an offering takes (`gst_percent`) — the drawer's chips. */
export const GST_PERCENT_VALUES = [0, 5, 12, 18, 28] as const;

/** One GST rate. */
export type GstPercent = (typeof GST_PERCENT_VALUES)[number];

/**
 * An offer's status as the server works it out on the clinic's today (O10): paused when it is
 * not active, else scheduled before its start, ended after its end, live in between — the
 * Offers tab's order. `live` is labelled "Running".
 */
export const OFFER_STATUS_VALUES = ['live', 'scheduled', 'paused', 'ended'] as const;

/** One offer status. */
export type OfferStatus = (typeof OFFER_STATUS_VALUES)[number];

const offeringFieldsWire = {
  id: z.string(),
  offering_number: z.number().int(),
  name: z.string(),
  category: offeringCategorySchema,
  specialty: offeringSpecialtySchema,
  tone: toneSchema,
  price: z.number(),
  min_price: z.number().nullable(),
  duration_minutes: z.number().int(),
  sessions: z.number().int(),
  validity_days: z.number().int(),
  gst_percent: z.literal(GST_PERCENT_VALUES),
  is_active: z.boolean(),
  offering_group_id: z.string().nullable(),
  offer_price: z.number().nullable(),
  branch_ids: z.array(z.string()),
  is_gst_inclusive: z.boolean(),
  search_terms: z.array(z.string()),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
};

/** One offering (`GET /app/offerings/:offering_id`, and every write's answer). */
export const offeringWire = wireSchema<ApiOffering>()(z.object(offeringFieldsWire));

/** An offerings list row (`GET /app/offerings`). */
export const offeringRowWire = wireSchema<ApiOfferingRow>()(z.object(offeringFieldsWire));

const offerFieldsWire = {
  id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  kind: offerKindSchema,
  value: z.number(),
  offering_ids: z.array(z.string()),
  branch_ids: z.array(z.string()),
  starts_on: z.string().nullable(),
  ends_on: z.string().nullable(),
  is_active: z.boolean(),
  status: z.enum(OFFER_STATUS_VALUES),
  tone: toneSchema,
  note: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
};

/** One offer (`GET /app/offers/:offer_id`, and every write's answer). */
export const offerWire = wireSchema<ApiOffer>()(z.object(offerFieldsWire));

/** An offers list row (`GET /app/offers`). */
export const offerRowWire = wireSchema<ApiOfferRow>()(z.object(offerFieldsWire));

/** The clinic's specialties, its main one first (`GET /tenancy/organization`) — a new offering's. */
export const clinicSpecialtiesWire = wireSchema<ApiOrganization>()(
  z.object({ specialties: z.array(offeringSpecialtySchema) }),
);

// ── The rooms' shapes ──

/** An offering as the rooms read it. Money in rupees. */
export interface OfferingRecord {
  /** The offering's id (`off_…`). */
  id: string;
  /** "#274" is this number. */
  offeringNumber: number;
  name: string;
  category: OfferingCategory;
  specialty: OfferingSpecialty;
  tone: Tone;
  /** The list price — "was ₹1,500", shown on the invoice. */
  price: number;
  /** What the desk bills before any offer; `null` bills the list price. */
  offerPrice: number | null;
  /**
   * The lowest the desk may bill (0 = none); `null` when the member cannot see it — without
   * `offering:lower_price:read` (O15).
   */
  minPrice: number | null;
  /** 5–480 minutes. */
  durationMin: number;
  sessions: number;
  /** 0 = no expiry. */
  validityDays: number;
  gstPercent: GstPercent;
  /** Whether the prices include GST. */
  isGstInclusive: boolean;
  /** Bookable and billable; an inactive one is hidden from both. */
  isActive: boolean;
  /** Served, unused: the design has no group screen or picker (OFFERINGS-M8). */
  offeringGroupId: string | null;
  /** Where it is sold ("Available at"); empty = every branch. */
  branchIds: string[];
  /** Extra words the search matches ("laser, face, hair removal"). */
  searchTerms: string[];
  /** What is included — the list's sub-line. */
  description: string | null;
  createdAt: string;
  /** What a change sends back as `expected_updated_at` — and the Updated cell's time. */
  updatedAt: string;
}

/** An offer as the rooms read it. A `₹ off` or fixed `value` is rupees. */
export interface OfferRecord {
  /** The offer's id (`ofr_…`). */
  id: string;
  name: string;
  /** Upper case, as stored. */
  code: string | null;
  kind: OfferKind;
  /** Percent, rupees or free sessions, by kind. */
  value: number;
  /** The offerings it applies to — empty once every one of them was deleted (OFFERINGS-M4). */
  offeringIds: string[];
  /** Where the desk can use it; empty = every branch. */
  branchIds: string[];
  /** `YYYY-MM-DD`; `null` = "Now". */
  startsOn: string | null;
  /** `YYYY-MM-DD`; `null` = "no end". */
  endsOn: string | null;
  /** False = paused. */
  isActive: boolean;
  /** The server's status on the clinic's today. */
  status: OfferStatus;
  tone: Tone;
  note: string | null;
  createdAt: string;
  /** What a change sends back as `expected_updated_at`. */
  updatedAt: string;
}

/** An offering from the wire. */
export function toOfferingRecord(row: z.output<typeof offeringRowWire>): OfferingRecord {
  return {
    id: row.id,
    offeringNumber: row.offering_number,
    name: row.name,
    category: row.category,
    specialty: row.specialty,
    tone: row.tone,
    price: row.price,
    offerPrice: row.offer_price,
    minPrice: row.min_price,
    durationMin: row.duration_minutes,
    sessions: row.sessions,
    validityDays: row.validity_days,
    gstPercent: row.gst_percent,
    isGstInclusive: row.is_gst_inclusive,
    isActive: row.is_active,
    offeringGroupId: row.offering_group_id,
    branchIds: row.branch_ids,
    searchTerms: row.search_terms,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** An offer from the wire. */
export function toOfferRecord(row: z.output<typeof offerRowWire>): OfferRecord {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    kind: row.kind,
    value: row.value,
    offeringIds: row.offering_ids,
    branchIds: row.branch_ids,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isActive: row.is_active,
    status: row.status,
    tone: row.tone,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The catalogue A to Z by name — how the rooms that pick an offering list it (what the API's
 * `sort=name` answered when each read the catalogue on its own).
 */
export function offeringsByName<T extends Pick<OfferingRecord, 'name'>>(
  catalogue: readonly T[],
): T[] {
  return [...catalogue].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Writes ──

/** Everything the Offering drawer writes. Money in rupees. */
export interface OfferingFields {
  name: string;
  category: OfferingCategory;
  tone: Tone;
  /** Empty = every branch. */
  branchIds: string[];
  price: number;
  /** `null` = bill the list price. */
  offerPrice: number | null;
  /**
   * The lowest price, 0 for none. `null` sends nothing — it stays as it is — and so does any
   * value from a member without `offering:lower_price:read`: the server keeps the floor out of
   * their reach (D81).
   */
  minPrice: number | null;
  sessions: number;
  /**
   * `null` sends nothing: on a create the server's rate for the category (0 for a consultation,
   * else 18), on an edit the saved one.
   */
  gstPercent: GstPercent | null;
  isGstInclusive: boolean;
  durationMin: number;
  validityDays: number;
  searchTerms: string[];
  description: string | null;
  isActive: boolean;
}

/**
 * A new offering's starting values: Treatment, sage, every branch, 1 session, 30 min, no
 * validity, no offer price, GST exclusive at the category's rate, Active — and no lowest price
 * (Q-O4).
 */
export const OFFERING_DEFAULTS: Readonly<Omit<OfferingFields, 'name' | 'price'>> = {
  category: 'treatment',
  tone: 'sage',
  branchIds: [],
  offerPrice: null,
  minPrice: null,
  sessions: 1,
  gstPercent: null,
  isGstInclusive: false,
  durationMin: 30,
  validityDays: 0,
  searchTerms: [],
  description: null,
  isActive: true,
};

/** Who may set the lowest price — the member's `offering:lower_price:read`. */
export interface LowestPriceAccess {
  canSetLowestPrice: boolean;
}

/** The search terms as sent: trimmed, blanks dropped. */
const searchTermsOf = (terms: readonly string[]) =>
  terms.map((term) => term.trim()).filter((term) => term !== '');

/** A text field as sent: trimmed, an empty one none. */
const optionalTextOf = (text: string | null) => {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

/** The fields every offering write sends as they are (the prices, the GST and the floor aside). */
function offeringBodyOf(fields: OfferingFields) {
  return {
    name: fields.name.trim(),
    category: fields.category,
    tone: fields.tone,
    branch_ids: fields.branchIds,
    price: fields.price,
    offer_price: fields.offerPrice,
    sessions: fields.sessions,
    is_gst_inclusive: fields.isGstInclusive,
    duration_minutes: fields.durationMin,
    validity_days: fields.validityDays,
    search_terms: searchTermsOf(fields.searchTerms),
    description: optionalTextOf(fields.description),
    is_active: fields.isActive,
  } satisfies ApiOfferingChange;
}

/**
 * A new offering as `POST /app/offerings` takes it: the clinic's specialty when known (else
 * the server's), the GST rate when picked (else the category's), and the lowest price only
 * from a member who may set it.
 */
export function offeringCreateBodyOf(
  fields: OfferingFields,
  {
    canSetLowestPrice,
    specialty,
  }: LowestPriceAccess & { specialty: OfferingSpecialty | null },
): ApiOfferingCreate {
  return {
    ...offeringBodyOf(fields),
    ...(specialty === null ? {} : { specialty }),
    ...(fields.gstPercent === null ? {} : { gst_percent: fields.gstPercent }),
    ...(canSetLowestPrice && fields.minPrice !== null
      ? { min_price: fields.minPrice }
      : {}),
  };
}

/** Two lists hold the same values, in any order — the branches and an offer's offerings. */
const sameSet = (next: readonly string[], saved: readonly string[]) =>
  next.length === saved.length && next.every((value) => saved.includes(value));

/** Two lists hold the same values in the same order — the search terms. */
const sameList = (next: readonly string[], saved: readonly string[]) =>
  next.length === saved.length && next.every((value, index) => value === saved[index]);

/** The keys of a body whose values differ from the record's — what a change sends. */
function changedOf<Body extends object>(
  body: Body,
  unchanged: { [Key in keyof Body]?: boolean },
): Partial<Body> | null {
  const keys = (Object.keys(body) as (keyof Body)[]).filter((key) => !unchanged[key]);
  if (keys.length === 0) return null;
  return Object.fromEntries(keys.map((key) => [key, body[key]])) as Partial<Body>;
}

/**
 * An offering edit as `PATCH /app/offerings/:offering_id` takes it — only the fields that
 * changed, `null` when none did. The lowest price goes only from a member who may set it, and
 * only when it changed; a `null` GST rate stays as saved.
 */
export function offeringChangeOf(
  record: OfferingRecord,
  fields: OfferingFields,
  { canSetLowestPrice }: LowestPriceAccess,
): ApiOfferingChange | null {
  const body: ApiOfferingChange = {
    ...offeringBodyOf(fields),
    ...(fields.gstPercent === null ? {} : { gst_percent: fields.gstPercent }),
    ...(canSetLowestPrice && fields.minPrice !== null
      ? { min_price: fields.minPrice }
      : {}),
  };
  return changedOf(body, {
    name: body.name === record.name,
    category: body.category === record.category,
    tone: body.tone === record.tone,
    branch_ids: sameSet(body.branch_ids ?? [], record.branchIds),
    price: body.price === record.price,
    offer_price: body.offer_price === record.offerPrice,
    sessions: body.sessions === record.sessions,
    gst_percent: body.gst_percent === record.gstPercent,
    is_gst_inclusive: body.is_gst_inclusive === record.isGstInclusive,
    duration_minutes: body.duration_minutes === record.durationMin,
    validity_days: body.validity_days === record.validityDays,
    search_terms: sameList(body.search_terms ?? [], record.searchTerms),
    description: body.description === record.description,
    is_active: body.is_active === record.isActive,
    min_price: body.min_price === record.minPrice,
  });
}

/** Everything the Offer drawer writes. A `₹ off` or fixed `value` is rupees. */
export interface OfferFields {
  name: string;
  /** Letters and digits as typed — the server stores it upper case; empty is none. */
  code: string | null;
  kind: OfferKind;
  value: number;
  offeringIds: string[];
  /** Empty = every branch. */
  branchIds: string[];
  /** `YYYY-MM-DD`; `null` = "Now". */
  startsOn: string | null;
  /** `YYYY-MM-DD`; `null` = "no end". */
  endsOn: string | null;
  /** False = paused. */
  isActive: boolean;
  tone: Tone;
  note: string | null;
}

/** A new offer's starting values: "% off" at 10, blush, every branch, "Now" – "no end", Live. */
export const OFFER_DEFAULTS: Readonly<Omit<OfferFields, 'name' | 'offeringIds'>> = {
  code: null,
  kind: 'percent',
  value: 10,
  branchIds: [],
  startsOn: null,
  endsOn: null,
  isActive: true,
  tone: 'blush',
  note: null,
};

/** A new offer as `POST /app/offers` takes it. */
export function offerCreateBodyOf(fields: OfferFields): ApiOfferCreate {
  return {
    name: fields.name.trim(),
    code: optionalTextOf(fields.code),
    kind: fields.kind,
    value: fields.value,
    offering_ids: fields.offeringIds,
    branch_ids: fields.branchIds,
    starts_on: fields.startsOn,
    ends_on: fields.endsOn,
    is_active: fields.isActive,
    tone: fields.tone,
    note: optionalTextOf(fields.note),
  };
}

/**
 * An offer edit as `PATCH /app/offers/:offer_id` takes it — only the fields that changed,
 * `null` when none did. The offerings go only when the set changed: resent unchanged, one made
 * inactive since would refuse the whole save (OFFERINGS-M5). A code differing only in case is
 * the same code.
 */
export function offerChangeOf(
  record: OfferRecord,
  fields: OfferFields,
): ApiOfferChange | null {
  const body = offerCreateBodyOf(fields);
  return changedOf(body, {
    name: body.name === record.name,
    code: body.code?.toUpperCase() === record.code?.toUpperCase(),
    kind: body.kind === record.kind,
    value: body.value === record.value,
    offering_ids: sameSet(body.offering_ids, record.offeringIds),
    branch_ids: sameSet(body.branch_ids ?? [], record.branchIds),
    starts_on: body.starts_on === record.startsOn,
    ends_on: body.ends_on === record.endsOn,
    is_active: body.is_active === record.isActive,
    tone: body.tone === record.tone,
    note: body.note === record.note,
  });
}

// ── Refusals ──

/** The 409 reason of a name another offering has (D81). */
const OFFERING_NAME_TAKEN = 'offering_name_taken';

/** The 409 reason of a code another live offer uses (D81). */
const OFFER_CODE_IN_USE = 'offer_code_in_use';

/** Whether a refusal is a 409 for this reason — or a 409 with no reason at all. */
function isConflictFor(error: unknown, reason: string): boolean {
  if (!isHttpError(error) || error.status !== 409) return false;
  const given = apiErrorReason(error);
  return given === undefined || given === reason;
}

/**
 * Whether an offering save was refused for its name — another offering has it (`409
 * offering_name_taken`). A 409 without a reason counts too: clinozy-be sends none for it before
 * D81, and a stale save carries `record_changed`.
 */
export function isOfferingNameTaken(error: unknown): boolean {
  return isConflictFor(error, OFFERING_NAME_TAKEN);
}

/**
 * Whether an offer save was refused for its code — another live offer uses it (`409
 * offer_code_in_use`). A 409 without a reason counts too: clinozy-be sends none for it before
 * D81, and a stale save carries `record_changed`.
 */
export function isOfferCodeInUse(error: unknown): boolean {
  return isConflictFor(error, OFFER_CODE_IN_USE);
}
