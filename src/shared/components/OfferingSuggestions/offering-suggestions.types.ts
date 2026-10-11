import type { SuggestionStatus, Tone } from '@/shared/api/app/app-schema.ts';

/**
 * One plan row as the card shows it (`…/offering-suggestions`, named and priced from the
 * offerings catalogue, with who suggested it). Money is in paise — the formatter's unit.
 */
export interface SuggestionLine {
  id: string;
  /** The offering's name ("LHR Full Face · B4G7"). */
  name: string;
  /** The offering's category tone — the row's 8px dot. */
  tone: Tone;
  /** The details tooltip ("Package · 7 sessions · List ₹4,800 · …"). */
  info: string;
  /** 1–99. */
  qty: number;
  /** The line's final price — the whole line, not a unit (PK9); `null` is its billed price × qty. */
  price: number | null;
  /** One unit's billed price — what a line without its own price comes to per unit. */
  listPrice: number;
  status: SuggestionStatus;
  /** Units invoiced so far (`invoiced_quantity`). */
  invoicedQty: number;
  /** Every unit invoiced (`is_fully_invoiced`): "✓ Invoiced", its controls gone. */
  fullyInvoiced: boolean;
  /** Its price is under the lowest price (`is_below_lowest_price`): the red edge — warns, not blocks. */
  belowLowest: boolean;
  /** Who suggested it: the 26px avatar and its tooltip ("Dr. Reenal · 24 Sep · Patient file"). */
  by: { initials: string; tone: Tone; label: string };
}

/** An idea the plan offers to add — the Sparkles rows. */
export interface SuggestionIdea {
  id: string;
  name: string;
  tone: Tone;
  /** "Why this idea" tooltip. */
  info: string;
  listPrice: number;
}

/** One thing the patient bought — "<first>’s last purchases" (`…/offerings`). */
export interface SuggestionPurchase {
  id: string;
  /** Already formatted for the member ("24 Sep"). */
  date: string;
  /** The offering's category pill; `null` when the offering is gone from the catalogue. */
  category: { label: string; tone: Tone } | null;
  name: string;
  /** A package's sessions: "<used> of <total> used" with a bar; `null` = "—". */
  sessions: { used: number; total: number } | null;
}

/** The colour of a message's status (H:4372): Read green, Not delivered red, Queued amber. */
export type SuggestionActivityStatusTone = 'success' | 'danger' | 'pending';

/** One contact-activity line — "Contact activity". */
export interface SuggestionActivityLine {
  id: string;
  /** Already formatted ("24 Sep, 4:10 PM"). */
  at: string;
  channel: { label: string; tone: Tone };
  direction: 'sent' | 'got';
  text: string;
  status: string;
  /** Muted when absent (Sent, Delivered, Received). */
  statusTone?: SuggestionActivityStatusTone;
}

/** A line's edit: its quantity (with its price scaled), its final price or its status. */
export interface SuggestionPatch {
  qty?: number;
  price?: number | null;
  status?: SuggestionStatus;
}
