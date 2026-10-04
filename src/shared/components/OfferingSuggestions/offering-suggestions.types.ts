import type { SuggestionStatus, Tone } from '@/shared/api/clinic/clinic-schema.ts';

/**
 * One suggested offering as the card shows it (`OfferingSuggestion`, `S:480–499`,
 * joined with its offering and who suggested it). Money is in paise.
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
  /** The line's final price — the whole line, not a unit (`S:490`); `null` is list × qty. */
  price: number | null;
  /** The offering's list price for one unit. */
  listPrice: number;
  /** The offering's lowest price for one unit; the line is red under it × qty. `null` = no floor. */
  floorPrice: number | null;
  status: SuggestionStatus;
  /** Units invoiced so far — Σ the invoice links' qty: "✓ Invoiced" once it reaches `qty`. */
  invoicedQty: number;
  /** What the linked invoice lines come to — the header's "<₹> invoiced". */
  invoicedAmount: number;
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

/** One past purchase — "<first>’s last purchases". */
export interface SuggestionPurchase {
  id: string;
  /** Already formatted for the member ("24 Sep"). */
  date: string;
  category: { label: string; tone: Tone };
  name: string;
  qty: number;
  /** The line's amount, in paise. */
  paid: number;
  /** A package's sessions: "<used> of <total> used" with a bar; `null` = "—". */
  sessions: { used: number; total: number } | null;
  /** The invoice's display id ("#1042"), which opens it, and its status pill. */
  invoice: { label: string; status: string; tone: Tone };
  onOpenInvoice?: () => void;
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
