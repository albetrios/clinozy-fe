import { paiseOfRupees } from '@/lib/number-text.ts';
import type { InvoiceType, OfferingCategory, Tone } from '@/shared/api/app/app-schema.ts';
import {
  type MedicineForm,
  medicineForm,
  type MedicineRow,
} from '@/shared/api/app/medicines-contracts.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/app/offerings-contracts.ts';
import { effectivePrice } from '@/shared/api/app/offerings-pricing.ts';
import type { QuickLineSearchable } from '@/shared/components/QuickLine/index.ts';

import type { InvoiceLineForm } from './invoice-form.ts';

/*
 * What the Invoice drawer can bill (KICKOFF §6.9 Items): a clinic or consultation invoice the
 * clinic's offerings of its type — active and sold at its branch, Consultation's alone for a
 * consultation invoice — each listed at the price the Offerings room shows as "Billed today"
 * (the line itself is priced by the server); a Medical sale clinozy-be's medicines at MRP with
 * GST included (D45), their stock and the near-expiry discount (Q-M3) — a guide: the server
 * prices the sale from the batches it draws. Each entry knows the line a pick
 * fills, its Browse group and its sessions.
 */

/** One thing the drawer can bill. */
export interface InvoiceCatalogItem extends QuickLineSearchable {
  /** The offering's or the medicine's id. */
  key: string;
  kind: 'offering' | 'medicine';
  /** Browse's group: an offering's category, a medicine's form. */
  group: OfferingCategory | MedicineForm;
  /** What picking it fills on a row. */
  line: Pick<
    InvoiceLineForm,
    'offeringId' | 'medicineId' | 'name' | 'rate' | 'gstPct' | 'discountPct'
  >;
  /** The price the list shows, in paise: the offering's "Billed today", or the MRP. */
  price: number;
  /** Sessions a unit covers — a package's, plus a live extra-sessions offer's. */
  sessions: number;
  /** A medicine's stock; null for an offering. */
  stock: number | null;
  /** The live price offer the list names ("Navratri glow"), if any. */
  promo: string | null;
  /** The offering's category, or the medicine's composition — the sub line's words. */
  detail: string | null;
  /** The offering's own tone — its Package preset's chip. */
  tone: Tone | null;
}

/**
 * The offerings an invoice of `type` lists at `branchId` (`payments.md:142`): active, sold there
 * (an offering for every branch is), and of the type — a consultation invoice lists
 * consultations only, a clinic one everything else.
 */
export function offeringsFor(
  offerings: readonly OfferingRecord[],
  type: InvoiceType,
  branchId: string | null,
): OfferingRecord[] {
  return offerings.filter((offering) => {
    if (!offering.isActive) return false;
    const atBranch =
      branchId === null ||
      offering.branchIds.length === 0 ||
      offering.branchIds.includes(branchId);
    const consultation = offering.category === 'consultation';
    return atBranch && consultation === (type === 'consultation');
  });
}

/**
 * One offering as the drawer lists it: the price billed today at the branch, as the Offerings
 * room works it out from the live offers — a guide; the line's rate is the server's preview.
 */
export function offeringCatalogItem(
  offering: OfferingRecord,
  branchId: string | null,
  offers: readonly OfferRecord[],
): InvoiceCatalogItem {
  const billed = effectivePrice(offering, branchId, offers);
  return {
    key: offering.id,
    kind: 'offering',
    label: offering.name,
    keywords: [offering.category, ...offering.searchTerms].join(' '),
    group: offering.category,
    line: {
      offeringId: offering.id,
      medicineId: null,
      name: offering.name,
      rate: 0,
      gstPct: 0,
      discountPct: 0,
    },
    price: paiseOfRupees(billed.final),
    sessions: offering.sessions + billed.extraSessions,
    stock: null,
    promo: billed.priceOffer?.name ?? null,
    detail: offering.category,
    tone: offering.tone,
  };
}

/**
 * One medicine as a sale bills it (D45, Q-M3): its MRP (the API's rupees, in paise here), GST
 * 0% on top, the near-expiry discount, and the stock the server counts.
 */
export function medicineCatalogItem(medicine: MedicineRow): InvoiceCatalogItem {
  const mrp = paiseOfRupees(medicine.mrp);
  return {
    key: medicine.id,
    kind: 'medicine',
    label: medicine.name,
    keywords: medicine.composition ?? '',
    group: medicineForm(medicine.name),
    line: {
      offeringId: null,
      medicineId: medicine.id,
      name: medicine.name,
      rate: mrp,
      gstPct: 0,
      discountPct: medicine.nearExpiryDiscountPct,
    },
    price: mrp,
    sessions: 1,
    stock: medicine.stock,
    promo: null,
    detail: medicine.composition,
    tone: null,
  };
}

/** A row filled from a catalogue entry, with the quick line's quantity, rate and discount. */
export function lineFromCatalog(
  item: InvoiceCatalogItem,
  values: { qty?: number; rate?: number; discountPct?: number } = {},
): InvoiceLineForm {
  return {
    ...item.line,
    id: null,
    packSize: null,
    qty: values.qty ?? 1,
    rate: values.rate ?? item.line.rate,
    discountPct: values.discountPct ?? item.line.discountPct,
    batchNo: null,
    suggestionId: null,
    treatmentIds: [],
  };
}

/**
 * The sessions the invoice's package lines buy — "Covers 6 sessions" (H:5068): each line the
 * server priced as more than one session (a package, or an extra-sessions offer), its sessions
 * as the preview counts them.
 */
export function coveredSessions(
  lines: readonly { qty: number; sessionsTotal: number | null }[],
): number {
  return lines.reduce((sum, line) => {
    const sessions = line.sessionsTotal ?? 0;
    return sessions > line.qty ? sum + sessions : sum;
  }, 0);
}
