import { z } from 'zod';

import type { ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import {
  DELIVERY_STATUS_VALUES,
  type DeliveryStatus,
  OFFERING_CATEGORY_VALUES,
  type OfferingCategory,
  SUGGESTION_STATUS_VALUES,
  type SuggestionStatus,
  type Tone,
  TONE_VALUES,
} from './clinic-schema.ts';

/*
 * A patient's plan on clinozy-be (api-integration §5.4; route map `getPlan`): the offering
 * suggestions (`/app/patients/:patient_id/offering-suggestions`) with the server's plan total
 * (`meta.plan_total`, the planned and accepted rows), what each row invoiced
 * (`invoiced_quantity`, `is_fully_invoiced`), its lowest-price flag (`is_below_lowest_price`)
 * and where it was made (`source_label`); the ideas (`…/offering-ideas`); the offerings the card
 * names and adds from (`/app/offerings`); and the contact's last messages
 * (`/app/contacts/:contact_id/activities`). The client computes none of these (§7). Money is in
 * rupees, as the API sends it.
 */

type ApiSuggestion = NonNullable<
  ApiData<'/app/patients/{patient_id}/offering-suggestions', 'get'>
>[number];
type ApiOffering = NonNullable<ApiData<'/app/offerings', 'get'>>[number];
type ApiActivity = NonNullable<
  ApiData<'/app/contacts/{contact_id}/activities', 'get'>
>[number];

/** A plan row as the API answers it. */
export const planSuggestionWire = wireSchema<ApiSuggestion>()(
  z.object({
    id: z.string(),
    offering_id: z.string(),
    offering_name: z.string(),
    quantity: z.number().int(),
    price: z.number().nullable(),
    status: z.enum(SUGGESTION_STATUS_VALUES),
    reason: z.string().nullable(),
    source_label: z.string(),
    suggested_by_membership_id: z.string().nullable(),
    invoiced_quantity: z.number().int(),
    is_fully_invoiced: z.boolean(),
    is_below_lowest_price: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

/** One offering in the patient's plan. */
export interface PlanSuggestionRow {
  id: string;
  offeringId: string;
  /** The offering's name — empty when the offering is gone. */
  name: string;
  /** 1–99. */
  quantity: number;
  /** The whole quantity's final amount; `null` = the offering's billed price × quantity (PK9). */
  price: number | null;
  status: SuggestionStatus;
  /** Why it was suggested. */
  reason: string | null;
  /** Where it was made: "Patient file", "Appt #2861 · Hydrafacial", "Check-in · 24 Sep". */
  sourceLabel: string;
  /** Who suggested it — a membership id. */
  suggestedById: string | null;
  /** Units the invoices' lines have taken. */
  invoicedQuantity: number;
  /** Every unit invoiced — "✓ Invoiced", its controls gone. */
  isFullyInvoiced: boolean;
  /** Its price is under the offering's lowest price × quantity — warned, not refused (PK9). */
  isBelowLowestPrice: boolean;
  createdAt: string;
  /** What a change sends back as `expected_updated_at`. */
  updatedAt: string;
}

/** A plan row from the wire. */
export function toPlanSuggestionRow(
  row: z.output<typeof planSuggestionWire>,
): PlanSuggestionRow {
  return {
    id: row.id,
    offeringId: row.offering_id,
    name: row.offering_name,
    quantity: row.quantity,
    price: row.price,
    status: row.status,
    reason: row.reason,
    sourceLabel: row.source_label,
    suggestedById: row.suggested_by_membership_id,
    invoicedQuantity: row.invoiced_quantity,
    isFullyInvoiced: row.is_fully_invoiced,
    isBelowLowestPrice: row.is_below_lowest_price,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** A patient's plan: its rows, newest first, and the server's total. */
export interface PatientPlan {
  suggestions: PlanSuggestionRow[];
  /** The planned and accepted rows' final amounts (`meta.plan_total`). */
  planTotal: number;
}

/**
 * One idea as `…/offering-ideas` answers it. The OpenAPI document gives that route's 200 no body
 * (api-integration §9 M3), so there is no generated type to check this against.
 */
export const planIdeaWire = z.object({
  offering_id: z.string(),
  offering_name: z.string(),
  category: z.enum(OFFERING_CATEGORY_VALUES),
  sessions: z.number().int(),
  price: z.number(),
  reason: z.string(),
});

/** An offering the server suggests adding — the card's Sparkles rows (at most four). */
export interface PlanIdeaRow {
  offeringId: string;
  name: string;
  category: OfferingCategory;
  sessions: number;
  /** The offering's list price. */
  price: number;
  /** Why, in the server's words ("First visit · start with a consultation"). */
  reason: string;
}

/** An idea from the wire. */
export function toPlanIdeaRow(row: z.output<typeof planIdeaWire>): PlanIdeaRow {
  return {
    offeringId: row.offering_id,
    name: row.offering_name,
    category: row.category,
    sessions: row.sessions,
    price: row.price,
    reason: row.reason,
  };
}

/** An offering as the catalogue answers it — the parts the plan card reads. */
export const planOfferingWire = wireSchema<ApiOffering>()(
  z.object({
    id: z.string(),
    name: z.string(),
    category: z.enum(OFFERING_CATEGORY_VALUES),
    tone: z.enum(TONE_VALUES),
    sessions: z.number().int(),
    price: z.number(),
    offer_price: z.number().nullable(),
    min_price: z.number().nullable(),
    is_active: z.boolean(),
  }),
);

/** An offering the card names a row by, prices it with, and adds from ("Add offering"). */
export interface PlanOffering {
  id: string;
  name: string;
  category: OfferingCategory;
  tone: Tone;
  /** Sessions per unit — a package's count, 1 otherwise. */
  sessions: number;
  /** One unit's list price. */
  price: number;
  /** One unit's offer price, when it has one — what it bills at instead. */
  offerPrice: number | null;
  /** One unit's lowest price — `null` without `offering:lower_price:read` (O15). */
  minPrice: number | null;
  isActive: boolean;
}

/** A catalogue row from the wire. */
export function toPlanOffering(row: z.output<typeof planOfferingWire>): PlanOffering {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    tone: row.tone,
    sessions: row.sessions,
    price: row.price,
    offerPrice: row.offer_price,
    minPrice: row.min_price,
    isActive: row.is_active,
  };
}

/** One unit's billed price — the offer price, else the list price (PK9). */
export const billedPrice = (
  offering: Pick<PlanOffering, 'price' | 'offerPrice'>,
): number => offering.offerPrice ?? offering.price;

/** The contact-stream entries "Contact activity" lists: the messages and the calls. */
export const PLAN_ACTIVITY_TYPES = ['whatsapp', 'instagram', 'call_log'] as const;

/** Every entry type of a contact's stream. */
const ACTIVITY_TYPE_VALUES = [
  'whatsapp',
  'instagram',
  'call_log',
  'note',
  'system',
] as const;

/** A contact-stream entry as the API answers it — the parts the card reads. */
export const planActivityWire = wireSchema<ApiActivity>()(
  z.object({
    id: z.string(),
    type: z.enum(ACTIVITY_TYPE_VALUES),
    direction: z.enum(['sent', 'received']).nullable(),
    body: z.string(),
    delivery_status: z.enum(DELIVERY_STATUS_VALUES).nullable(),
    occurred_at: z.string(),
  }),
);

/** One message or call of the contact's stream — "Contact activity" (the last five). */
export interface PlanActivityRow {
  id: string;
  /** ISO instant. */
  at: string;
  channel: 'whatsapp' | 'instagram' | 'call';
  direction: 'sent' | 'received';
  text: string;
  /** A sent message's delivery; `null` for one they sent or a call. */
  delivery: DeliveryStatus | null;
}

/** A stream entry from the wire — `null` for a note or a server entry, which the card skips. */
export function toPlanActivityRow(
  row: z.output<typeof planActivityWire>,
): PlanActivityRow | null {
  if (row.type === 'note' || row.type === 'system') return null;
  return {
    id: row.id,
    at: row.occurred_at,
    channel: row.type === 'call_log' ? 'call' : row.type,
    direction: row.direction ?? 'sent',
    text: row.body,
    delivery: row.delivery_status,
  };
}

/** A new plan row: one unit at its billed price, Planned (`POST …/offering-suggestions`). */
export interface SuggestionCreateInput {
  offeringId: string;
  /** Why — an idea's reason. */
  reason: string | null;
}

/** A plan row's change (`PATCH …/offering-suggestions/:id`): its quantity, final amount or status. */
export interface SuggestionChange {
  quantity?: number;
  /** The whole quantity's final amount; `null` goes back to the billed price. */
  price?: number | null;
  status?: SuggestionStatus;
}
