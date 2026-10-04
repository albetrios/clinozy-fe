import { lineFloor } from '@/shared/api/clinic/clinic-money.ts';
import type { InvoiceType, OfferingCategory } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { medicineStock } from '@/shared/api/clinic/medicine-stock.ts';
import type { MedicineRecord } from '@/shared/api/clinic/medicines-contracts.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';
import {
  effectivePrice,
  invoiceLineRate,
} from '@/shared/api/clinic/offerings-pricing.ts';

import type { InvoiceLineForm } from './invoice-form.ts';
import type { QuickLineSearchable } from './quick-line-match.ts';

/*
 * What the Invoice drawer can bill (KICKOFF §6.9 Items): the offerings of the
 * invoice's type — active, sold at its branch, Consultation's alone for a
 * consultation invoice — at their effective price (`effectivePrice`, Q-O2;
 * GST-inclusive ones back-computed, Q-O3), or the medicines at their MRP with
 * GST included (D45) and the near-expiry discount (Q-M3). Each entry knows
 * the line a pick fills, its Browse group, its sessions and its floor.
 */

/** A medicine's Browse group (H:5058): applied on the skin, or taken. */
export type MedicineForm = 'oral' | 'topical';

const TOPICAL = /lotion|shampoo|cream|gel|serum|sunscreen|spf|wash|soap|oil/i;

/** Topical when the name says it is put on (H:5058), oral otherwise. */
export function medicineForm(name: string): MedicineForm {
  return TOPICAL.test(name) ? 'topical' : 'oral';
}

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
  /** The price the list shows: the effective price, or the MRP. */
  price: number;
  /** Sessions a unit covers — a package's, plus a live extra-sessions offer's. */
  sessions: number;
  /** A medicine's stock; null for an offering. */
  stock: number | null;
  /** The live price offer that set the price ("Navratri glow"), if any. */
  promo: string | null;
  /** The offering's category, or the medicine's composition — the sub line's words. */
  detail: string | null;
}

/**
 * The offerings an invoice of `type` lists at `branchId` (`payments.md:142`):
 * active, available there (an offering for every branch is), and of the type —
 * a consultation invoice lists consultations only, a clinic one everything
 * else.
 */
export function offeringsFor(
  offerings: readonly OfferingRecord[],
  type: InvoiceType,
  branchId: string | null,
): OfferingRecord[] {
  return offerings.filter((offering) => {
    if (!offering.active || offering.deletedAt !== null) return false;
    const atBranch =
      branchId === null ||
      offering.branchIds.length === 0 ||
      offering.branchIds.includes(branchId);
    const consultation = offering.category === 'consultation';
    return atBranch && consultation === (type === 'consultation');
  });
}

/** One offering as the drawer bills it: its effective price, back-computed when inclusive. */
export function offeringCatalogItem(
  offering: OfferingRecord,
  branchId: string | null,
  offers: readonly OfferRecord[],
  today: string = clinicToday(),
): InvoiceCatalogItem {
  const effective = effectivePrice(offering, branchId, offers, today);
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
      rate: invoiceLineRate(effective.final, offering.gstPct, offering.gstInclusive),
      gstPct: offering.gstPct,
      discountPct: 0,
    },
    price: effective.final,
    sessions: offering.sessions + effective.extraSessions,
    stock: null,
    promo: effective.priceOffer?.name ?? null,
    detail: offering.category,
  };
}

/** One medicine as a sale bills it (D45, Q-M3): its MRP, GST 0%, the near-expiry discount. */
export function medicineCatalogItem(medicine: MedicineRecord): InvoiceCatalogItem {
  const stock = medicineStock(medicine.batches);
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
      rate: medicine.mrp,
      gstPct: 0,
      discountPct: medicine.nearExpiryDiscountPct,
    },
    price: medicine.mrp,
    sessions: 1,
    stock,
    promo: null,
    detail: medicine.composition,
  };
}

/** A row filled from a catalogue entry, with the quick line's quantity, rate and discount. */
export function lineFromCatalog(
  item: InvoiceCatalogItem,
  values: { qty?: number; rate?: number; discountPct?: number } = {},
): InvoiceLineForm {
  return {
    ...item.line,
    packSize: null,
    qty: values.qty ?? 1,
    rate: values.rate ?? item.line.rate,
    discountPct: values.discountPct ?? item.line.discountPct,
    batchNo: null,
  };
}

/** The ability that lets a role discount past the offer price (`disc`, Q-U8). */
export interface FloorAccess {
  /** Past the offer price, down to the lowest price. */
  disc: boolean;
}

/**
 * The lowest Final a row may come to (H:5059; Q-U8): the offering's lowest
 * price for a role with `disc`, else its effective price — no discount past
 * the offer — times the quantity, GST on top unless included. A medicine
 * row and a free row have none.
 */
export function rowFloor(
  row: Pick<InvoiceLineForm, 'offeringId' | 'qty' | 'gstPct'>,
  offerings: ReadonlyMap<string, OfferingRecord>,
  catalog: ReadonlyMap<string, InvoiceCatalogItem>,
  access: FloorAccess,
): number | null {
  const offering = row.offeringId ? offerings.get(row.offeringId) : undefined;
  if (!offering) return null;
  const effective = catalog.get(offering.id)?.price ?? offering.price;
  const perUnit = access.disc
    ? offering.minPrice
    : Math.max(offering.minPrice, effective);
  return lineFloor(row, perUnit, offering.gstInclusive);
}

/** The sessions the invoice's package rows cover — "Covers 6 sessions" (H:5068). */
export function coveredSessions(
  items: readonly Pick<InvoiceLineForm, 'offeringId' | 'qty' | 'name'>[],
  offerings: ReadonlyMap<string, OfferingRecord>,
): number {
  return items.reduce((sum, item) => {
    const offering = item.offeringId ? offerings.get(item.offeringId) : undefined;
    return offering && offering.sessions > 1 ? sum + offering.sessions * item.qty : sum;
  }, 0);
}

/** How many entries "Often billed" offers (H:5058). */
const OFTEN_BILLED_LIMIT = 5;

/**
 * "Often billed" (H:5058): the ranked names as catalogue entries — the first
 * the name is, or starts, in catalogue order — those the catalogue lacks
 * skipped, five kept.
 */
export function oftenBilledItems(
  names: readonly string[],
  catalog: readonly InvoiceCatalogItem[],
): InvoiceCatalogItem[] {
  return names
    .map((name) =>
      catalog.find((item) => item.label === name || item.label.startsWith(name)),
    )
    .filter((item): item is InvoiceCatalogItem => item !== undefined)
    .slice(0, OFTEN_BILLED_LIMIT);
}
