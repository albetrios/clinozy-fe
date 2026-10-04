import type { InvoiceStatus } from './clinic-money.ts';
import type {
  Channel,
  DeliveryStatus,
  InvoiceType,
  LeadStatus,
  OfferingCategory,
  SuggestionStatus,
  Tone,
} from './clinic-schema.ts';

/*
 * A patient's plan (`getPlan`, `S:1635`; `OfferingSuggestion`, `S:480–499`):
 * the offering suggestions joined with their offering and who made them, the
 * ideas the plan derives from the patient's history, their last purchases and
 * the contact's last messages — what the Offering suggestions card shows in
 * the appointment form and the patient file. REPLACE_WITH_API: the joins and
 * the ideas are the server's; the fixture server answers them for now.
 */

/** Who made a suggestion, as the card's 26px avatar shows them. */
export interface PlanSuggester {
  name: string;
  initials: string;
  tone: Tone;
}

/**
 * One offering suggestion as the plan reads it — the record and its offering
 * (`null` name: the offering was removed). Money is in paise; `price` is the
 * whole line's final price, `null` meaning list × qty (`S:490`).
 */
export interface PlanSuggestion {
  id: string;
  offeringId: string;
  name: string | null;
  category: OfferingCategory | null;
  tone: Tone;
  /** The offering's sessions per unit (a package's count; 1 otherwise). */
  sessions: number;
  /** One unit's list price. */
  listPrice: number;
  /** One unit's lowest price; `null` when the offering has no floor. */
  floorPrice: number | null;
  qty: number;
  price: number | null;
  status: SuggestionStatus;
  appointmentId: string | null;
  /** Where it was suggested ("Appt #2790 · Consultation", "Counselling call"). */
  sourceLabel: string;
  reason: string | null;
  /** ISO instant it was suggested. */
  createdAt: string;
  /** Units invoiced so far — Σ the invoice links' qty. */
  invoicedQty: number;
  /** What the linked invoice lines come to. */
  invoicedAmount: number;
  suggestedBy: PlanSuggester | null;
}

/**
 * Why the plan offers an idea (H:4355–4366): a doctor's note, a complaint,
 * the visits so far (a package saves on each session), a package nearly used
 * up, or a first visit.
 */
export type PlanIdeaReason =
  | { kind: 'note'; text: string }
  | { kind: 'complaint'; text: string }
  | { kind: 'visits'; count: number }
  | { kind: 'renew' }
  | { kind: 'first' };

/** An offering the plan suggests adding — the card's Sparkles rows (at most four). */
export interface PlanIdea {
  offeringId: string;
  name: string;
  category: OfferingCategory;
  tone: Tone;
  sessions: number;
  listPrice: number;
  reason: PlanIdeaReason;
}

/** One line the patient bought — "<first>’s last purchases" (the last six). */
export interface PlanPurchase {
  /** `<invoice id>:<line index>`. */
  id: string;
  invoiceId: string;
  invoiceSeq: number;
  invoiceType: InvoiceType;
  invoiceStatus: InvoiceStatus;
  /** The invoice's date. */
  date: string;
  name: string;
  /** The offering's category; `null` for a medicine or an unknown line. */
  category: OfferingCategory | null;
  qty: number;
  /** The line after its discount, before GST. */
  amount: number;
  /** A package's sessions used of the total; `null` for anything else. */
  sessions: { used: number; total: number } | null;
}

/** One message of the contact's thread — "Contact activity" (the last five, newest first). */
export interface PlanActivity {
  id: string;
  /** ISO instant. */
  at: string;
  channel: Channel;
  direction: 'sent' | 'got';
  text: string;
  /** A sent message's delivery; `null` for one they sent. */
  delivery: DeliveryStatus | null;
}

/** A patient's plan (`getPlan`, `S:1635`). */
export interface PatientPlan {
  suggestions: PlanSuggestion[];
  ideas: PlanIdea[];
  purchases: PlanPurchase[];
  /** Receipts less refunds over every invoice of theirs, in paise. */
  paidSoFar: number;
  /** Their lead — "Contact activity · Lead #<seq> · <status>", "Open chat"; `null` without one. */
  lead: { id: string; seq: number; status: LeadStatus | null } | null;
  activity: PlanActivity[];
}

/** A suggestion's quantity range (`S:487`). */
export const PLAN_QTY = { min: 1, max: 99 } as const;

/**
 * A new suggestion (`addSuggestion`, `S:1646`): an idea's "+ Add" or "Add
 * offering" — one unit at list price, Planned, against the visit it was made
 * in.
 */
export interface SuggestionCreateInput {
  patientId: string;
  offeringId: string;
  appointmentId?: string | null;
  /** Where it was made ("Appt #2861 · Hydrafacial", "Patient file"). */
  sourceLabel: string;
  /** Why — an idea's reason. */
  reason?: string | null;
}

/** An edit of one suggestion (`updateSuggestion`, `S:1646`): its quantity, final price or status. */
export interface SuggestionPatch {
  qty?: number;
  price?: number | null;
  status?: SuggestionStatus;
}
