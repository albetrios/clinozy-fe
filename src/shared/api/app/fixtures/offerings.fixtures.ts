import { seedCommon } from '@/shared/api/app/app-fixture-seed.ts';
import type {
  OfferingCategory,
  OfferingSpecialty,
  Tone,
} from '@/shared/api/app/app-schema.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import type { OfferingRecord } from '@/shared/api/app/offerings-fixture-contracts.ts';

import { type BranchName, branchRef } from './organization.fixtures.ts';
import { must, paise, ref, seedAt } from './refs.fixtures.ts';
import { type StaffKey, staffRef } from './staff.fixtures.ts';

const CATEGORIES: Record<string, OfferingCategory> = {
  Consultation: 'consultation',
  Treatment: 'treatment',
  Package: 'package',
  LHR: 'lhr',
  Product: 'product',
};
const SPECIALTIES: Record<string, OfferingSpecialty> = {
  Skin: 'skin',
  Hair: 'hair',
  Dental: 'dental',
  Gynac: 'gynac',
  Physio: 'physio',
  General: 'general',
};

interface OfferingRow {
  seq: number;
  name: string;
  category: string;
  specialty: string;
  tone: Tone;
  /** List price, rupees. */
  price: number;
  minutes: number;
  sessions: number;
  validDays: number;
  updated: string;
  by: StaffKey;
}

/**
 * `OF_SEED` (H:3550–3562), verbatim but for the default doctor and room, which
 * clinozy-be has no field for (§6 #10, O6). The prototype's seventh column is
 * unused — it hard-codes GST 0 for every offering — and only #272 is inactive.
 * The offer price and branch availability are plan-only fields (Appendix F),
 * below.
 */
const OFFERING_ROWS: readonly OfferingRow[] = [
  {
    seq: 274,
    name: 'B1G1 D-Tan Facial',
    category: 'Treatment',
    specialty: 'Skin',
    tone: 'sage',
    price: 1500,
    minutes: 45,
    sessions: 2,
    validDays: 60,
    updated: 'Sep 25 · 11:44',
    by: 'DD',
  },
  {
    seq: 273,
    name: 'Underarm Peel · 6 sessions',
    category: 'Package',
    specialty: 'Skin',
    tone: 'lav',
    price: 9000,
    minutes: 60,
    sessions: 6,
    validDays: 180,
    updated: 'Sep 23 · 15:36',
    by: 'DD',
  },
  {
    seq: 272,
    name: 'Underarm Peel',
    category: 'Treatment',
    specialty: 'Skin',
    tone: 'blush',
    price: 1500,
    minutes: 30,
    sessions: 1,
    validDays: 0,
    updated: 'Sep 23 · 15:32',
    by: 'DD',
  },
  {
    seq: 271,
    name: 'Back Peeling',
    category: 'Treatment',
    specialty: 'Skin',
    tone: 'mint',
    price: 3000,
    minutes: 60,
    sessions: 1,
    validDays: 0,
    updated: 'Sep 21 · 12:36',
    by: 'DD',
  },
  {
    seq: 270,
    name: 'Corn Removal',
    category: 'Treatment',
    specialty: 'Skin',
    tone: 'butter',
    price: 1000,
    minutes: 20,
    sessions: 1,
    validDays: 0,
    updated: 'Sep 14 · 11:30',
    by: 'RS',
  },
  {
    seq: 268,
    name: 'LHR Full Face · B4G7',
    category: 'Package',
    specialty: 'Skin',
    tone: 'lav',
    price: 4800,
    minutes: 45,
    sessions: 7,
    validDays: 365,
    updated: 'Aug 25 · 17:22',
    by: 'DD',
  },
  {
    seq: 267,
    name: 'LHR Half Leg · 10 sessions',
    category: 'LHR',
    specialty: 'Skin',
    tone: 'blush',
    price: 8500,
    minutes: 60,
    sessions: 10,
    validDays: 365,
    updated: 'Aug 23 · 11:33',
    by: 'DD',
  },
  {
    seq: 266,
    name: 'LHR Half Leg',
    category: 'LHR',
    specialty: 'Skin',
    tone: 'blush',
    price: 850,
    minutes: 50,
    sessions: 1,
    validDays: 0,
    updated: 'Aug 23 · 11:32',
    by: 'DD',
  },
  {
    seq: 265,
    name: 'Consultation · New',
    category: 'Consultation',
    specialty: 'General',
    tone: 'sky',
    price: 300,
    minutes: 20,
    sessions: 1,
    validDays: 0,
    updated: 'Jul 18 · 16:33',
    by: 'DN',
  },
  {
    seq: 264,
    name: 'Scaling & Polishing',
    category: 'Treatment',
    specialty: 'Dental',
    tone: 'mint',
    price: 1800,
    minutes: 40,
    sessions: 1,
    validDays: 0,
    updated: 'Jul 12 · 10:02',
    by: 'DR',
  },
  {
    seq: 263,
    name: 'Knee Rehab · 8 sessions',
    category: 'Package',
    specialty: 'Physio',
    tone: 'sage',
    price: 6400,
    minutes: 45,
    sessions: 8,
    validDays: 60,
    updated: 'Jul 08 · 09:12',
    by: 'DD',
  },
];

/** The lowest price the prototype derives for an offering (H:3562): 75% rounded to ₹50 from ₹1,000 up. */
const floorPrice = (price: number) =>
  price >= 1000 ? Math.round((price * 0.75) / 50) * 50 : price;

/**
 * Offer prices, rupees (H:3562 `offer`) — plan-only (Appendix F,
 * REPLACE_WITH_API). Every other offering bills its list price.
 */
const OFFER_PRICES: Readonly<Record<number, number>> = {
  274: 1200,
  273: 7500,
  268: 4200,
  267: 7200,
  264: 1500,
};

/**
 * Where an offering is sold (H:3562 `brs`) — plan-only (Appendix F,
 * REPLACE_WITH_API). Every other offering is sold at every branch.
 */
const AVAILABILITY: Readonly<Record<number, readonly BranchName[]>> = {
  268: ['Vesu'],
  267: ['Adajan', 'Vesu'],
  266: ['Adajan', 'Vesu'],
  264: ['Varachha'],
  263: ['Varachha'],
};

/** An offering's offer price in paise, or `null` when it bills its list price. */
function offerPriceOf(seq: number): number | null {
  const rupees = OFFER_PRICES[seq];
  return rupees === undefined ? null : paise(rupees);
}

/** An offering's row by its name, when the name is an offering (invoice lines name them). */
export function findOfferingByName(name: string): OfferingRow | undefined {
  return OFFERING_ROWS.find((row) => row.name === name);
}

/** An offering's row by its id (`#274`). */
export function offeringBySeq(seq: number): OfferingRow {
  return must(
    OFFERING_ROWS.find((row) => row.seq === seq),
    `offering #${seq}`,
  );
}

/**
 * The offerings, as last saved (`upd` / `by`, also who saved them), with the
 * plan's fields: the offer price, where each is sold, GST exclusive, and no
 * search terms or description (the prototype seeds none).
 */
export function offeringSeed(today: string = appToday()): OfferingRecord[] {
  return OFFERING_ROWS.map((row) => ({
    ...seedCommon(seedAt(row.updated, '10:00', today), staffRef(row.by)),
    id: ref.offering(row.seq),
    seq: row.seq,
    name: row.name,
    category: must(CATEGORIES[row.category], `category ${row.category}`),
    specialty: must(SPECIALTIES[row.specialty], `specialty ${row.specialty}`),
    tone: row.tone,
    price: paise(row.price),
    minPrice: paise(floorPrice(row.price)),
    durationMin: row.minutes,
    sessions: row.sessions,
    validityDays: row.validDays,
    gstPct: 0,
    active: row.seq !== 272,
    offerPrice: offerPriceOf(row.seq),
    branchIds: (AVAILABILITY[row.seq] ?? []).map(branchRef),
    gstInclusive: false,
    searchTerms: [],
    description: null,
    updatedById: staffRef(row.by),
  }));
}
