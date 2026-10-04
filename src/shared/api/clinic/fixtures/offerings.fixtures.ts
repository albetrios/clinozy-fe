import { seedCommon } from '@/shared/api/clinic/clinic-fixture-seed.ts';
import type {
  OfferingCategory,
  OfferingSpecialty,
  OfferKind,
  Room,
  Tone,
} from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';

import { type BranchName, branchRef } from './organization.fixtures.ts';
import { must, paise, ref, seedAt, seedDay } from './refs.fixtures.ts';
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
/** `OF_ROOMS` (H:3549). */
const ROOMS: Record<string, Room> = {
  'Room 1': 'room_1',
  'Room 2': 'room_2',
  'Laser room': 'laser_room',
  'Any room': 'any',
};
/** `OFX_KINDS` (H:3580). */
const OFFER_KINDS: Record<string, OfferKind> = {
  pct: 'percent',
  amt: 'amount',
  fixed: 'fixed',
  extra: 'extra',
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
  doctor: StaffKey;
  room: string;
  updated: string;
  by: StaffKey;
}

/**
 * `OF_SEED` (H:3550–3562), verbatim. The prototype's seventh column is unused —
 * it hard-codes GST 0 for every offering — and only #272 is inactive. The offer
 * price and branch availability are plan-only fields (Appendix F), below.
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
    doctor: 'DN',
    room: 'Room 2',
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
    doctor: 'DD',
    room: 'Room 1',
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
    doctor: 'DD',
    room: 'Room 1',
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
    doctor: 'DN',
    room: 'Room 2',
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
    doctor: 'DR',
    room: 'Room 1',
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
    doctor: 'KP',
    room: 'Laser room',
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
    doctor: 'KP',
    room: 'Laser room',
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
    doctor: 'KP',
    room: 'Laser room',
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
    doctor: 'DN',
    room: 'Any room',
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
    doctor: 'DR',
    room: 'Room 2',
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
    doctor: 'KS',
    room: 'Room 1',
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
export function offeringSeed(today: string = clinicToday()): OfferingRecord[] {
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
    defaultDoctorId: staffRef(row.doctor),
    room: must(ROOMS[row.room], `room ${row.room}`),
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

interface OfferRow {
  key: number;
  name: string;
  code: string;
  kind: string;
  /** Percent, rupees or sessions, by kind. */
  value: number;
  offerings: readonly number[];
  /** Empty = every branch. */
  branches: readonly BranchName[];
  from: string;
  to: string;
  tone: Tone;
  paused: boolean;
  note: string;
  by: StaffKey;
  updated: string;
}

/** `OFX_SEED` (H:3583–3587), verbatim. */
const OFFER_ROWS: readonly OfferRow[] = [
  {
    key: 31,
    name: 'Navratri glow',
    code: 'GLOW20',
    kind: 'pct',
    value: 20,
    offerings: [274, 271, 272],
    branches: ['Adajan', 'Vesu'],
    from: '22 Sep 2026',
    to: '2 Oct 2026',
    tone: 'blush',
    paused: false,
    note: 'Festival offer on peels and facials',
    by: 'RS',
    updated: 'Sep 21 · 18:10',
  },
  {
    key: 30,
    name: 'LHR launch · Vesu',
    code: '',
    kind: 'fixed',
    value: 3999,
    offerings: [268],
    branches: ['Vesu'],
    from: '1 Sep 2026',
    to: '31 Oct 2026',
    tone: 'lav',
    paused: false,
    note: 'Opening price for the new laser room',
    by: 'DD',
    updated: 'Aug 30 · 12:02',
  },
  {
    key: 29,
    name: 'Peel pack + 1 free',
    code: '',
    kind: 'extra',
    value: 1,
    offerings: [273],
    branches: [],
    from: '1 Oct 2026',
    to: '31 Oct 2026',
    tone: 'sage',
    paused: false,
    note: '',
    by: 'RS',
    updated: 'Sep 26 · 10:40',
  },
  {
    key: 28,
    name: 'Monsoon ₹500 off',
    code: 'RAIN500',
    kind: 'amt',
    value: 500,
    offerings: [271, 264],
    branches: [],
    from: '1 Jul 2026',
    to: '31 Aug 2026',
    tone: 'sky',
    paused: false,
    note: '',
    by: 'DN',
    updated: 'Jun 28 · 16:22',
  },
];

/**
 * The offers; money values (₹ off, fixed price) in paise, percent and extra
 * sessions as-is. No branches stays no branches — every branch, shown "All
 * branches" — as the plan keeps it (Appendix F; the contract stores them all).
 */
export function offerSeed(today: string = clinicToday()): OfferRecord[] {
  return OFFER_ROWS.map((row) => {
    const kind = must(OFFER_KINDS[row.kind], `offer kind ${row.kind}`);
    return {
      ...seedCommon(seedAt(row.updated, '10:00', today), staffRef(row.by)),
      id: ref.offer(row.key),
      name: row.name,
      code: row.code || null,
      kind,
      value: kind === 'amount' || kind === 'fixed' ? paise(row.value) : row.value,
      offeringIds: row.offerings.map((seq) => ref.offering(seq)),
      branchIds: row.branches.map(branchRef),
      startsOn: seedDay(row.from, today),
      endsOn: seedDay(row.to, today),
      paused: row.paused,
      tone: row.tone,
      note: row.note || null,
      updatedById: staffRef(row.by),
    };
  });
}
