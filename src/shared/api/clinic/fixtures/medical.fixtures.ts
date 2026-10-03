import { seedCommon } from '@/shared/api/clinic/clinic-fixture-seed.ts';
import type {
  Manufacturer,
  MedicalContact,
  MedicalPurchaseOrder,
  MedicalRep,
  MedicalSale,
  Medicine,
  MRVisit,
  PoStage,
  Supplier,
  Tone,
} from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';

import { patientRef } from './patients.fixtures.ts';
import {
  must,
  paise,
  ref,
  seedAt,
  seedDay,
  seedExpiry,
  seedMobile,
} from './refs.fixtures.ts';
import { type StaffKey, staffRef } from './staff.fixtures.ts';

/** When the medicine store's master data was set up (the seeds don't say). */
const STORE_OPENED = 'Aug 01, 2025 · 10:00';

const masterCommon = (today: string) =>
  seedCommon(seedAt(STORE_OPENED, '10:00', today), staffRef('FA'));

/** `MD_MFR` (H:3704), verbatim. */
const MANUFACTURER_ROWS: readonly { key: number; name: string; tone: Tone }[] = [
  { key: 1, name: 'ALVI', tone: 'lav' },
  { key: 2, name: 'DERM', tone: 'sky' },
  { key: 3, name: 'AVRI', tone: 'sage' },
  { key: 4, name: 'PHARM', tone: 'blush' },
  { key: 5, name: 'ETA', tone: 'butter' },
  { key: 6, name: 'BLA', tone: 'mint' },
];

export function manufacturerSeed(today: string = clinicToday()): Manufacturer[] {
  return MANUFACTURER_ROWS.map((row) => ({
    ...masterCommon(today),
    id: ref.manufacturer(row.key),
    name: row.name,
    tone: row.tone,
    isQuick: false,
  }));
}

/**
 * `MD_SUP0` (H:3705), verbatim — the prototype gives every supplier the same
 * GSTIN. What they owe and for how long is derived from the purchase orders.
 */
const SUPPLIER_ROWS: readonly {
  key: number;
  name: string;
  phone: string;
  makers: readonly number[];
}[] = [
  { key: 61, name: 'K R Medical Agency', phone: '99981 29429', makers: [1, 2, 3] },
  {
    key: 58,
    name: 'Shree Ramdev Medical Agency',
    phone: '88666 72532',
    makers: [2, 4, 5],
  },
  { key: 52, name: 'Akshar Medicines', phone: '99047 65865', makers: [1, 3, 6] },
  { key: 59, name: 'NH Pharma', phone: '98250 56546', makers: [4, 5, 6] },
];

export function supplierSeed(today: string = clinicToday()): Supplier[] {
  return SUPPLIER_ROWS.map((row) => ({
    ...masterCommon(today),
    id: ref.supplier(row.key),
    name: row.name,
    phone: seedMobile(row.phone),
    gstNumber: '24AJPPG5277K1ZR',
    manufacturerIds: row.makers.map((key) => ref.manufacturer(key)),
    isQuick: false,
  }));
}

/** `MD_MR0` (H:3706), verbatim; "last" and "samples" are the latest visit's. */
const REP_ROWS: readonly {
  key: number;
  name: string;
  phone: string;
  makers: readonly number[];
  lastVisit: string;
  nextVisit: string;
  samples: string;
}[] = [
  {
    key: 1,
    name: 'Alvio Pharma · Rakesh',
    phone: '81602 57460',
    makers: [1],
    lastVisit: '12 Sep',
    nextVisit: '2 Oct',
    samples: '5 samples',
  },
  {
    key: 2,
    name: 'Atopic Dermocare · Meet',
    phone: '84888 77725',
    makers: [2, 6],
    lastVisit: '20 Sep',
    nextVisit: '4 Oct',
    samples: '2 samples',
  },
  {
    key: 3,
    name: 'Avriva Skintech · Jay',
    phone: '93741 68875',
    makers: [3, 4],
    lastVisit: '2 Sep',
    nextVisit: '24 Sep',
    samples: '—',
  },
];

export function medicalRepSeed(today: string = clinicToday()): MedicalRep[] {
  return REP_ROWS.map((row) => ({
    ...masterCommon(today),
    id: ref.medicalRep(row.key),
    name: row.name,
    phone: seedMobile(row.phone),
    manufacturerIds: row.makers.map((key) => ref.manufacturer(key)),
    nextVisitOn: seedDay(row.nextVisit, today),
  }));
}

/** Each rep's last visit (`MD_MR0` last / samples) — the derived columns' source. */
export function mrVisitSeed(today: string = clinicToday()): MRVisit[] {
  return REP_ROWS.map((row) => ({
    ...seedCommon(seedAt(row.lastVisit, '12:00', today), staffRef('FA')),
    id: ref.mrVisit(row.key),
    mrId: ref.medicalRep(row.key),
    date: seedDay(row.lastVisit, today),
    samples: row.samples === '—' ? null : row.samples,
    notes: null,
  }));
}

interface MedicineRow {
  seq: number;
  name: string;
  composition: string;
  maker: number;
  /** MRP, rupees. */
  mrp: number;
  gst: number;
  min: number;
  max: number;
  /** [batch, expiry MM/YY, qty, purchase rate ₹]. */
  batches: readonly (readonly [string, string, number, number])[];
  /** [supplier, rate ₹, free, lead days]. */
  rates: readonly (readonly [number, number, number, number])[];
}

/** `MD_MED0` (H:3707–3717), verbatim. */
const MEDICINE_ROWS: readonly MedicineRow[] = [
  {
    seq: 458,
    name: 'Uncap Smooth Anti Acne PM Gel',
    composition: 'Adapalene 0.1% + Clindamycin',
    maker: 1,
    mrp: 650,
    gst: 18,
    min: 2,
    max: 10,
    batches: [['CSH26044', '03/29', 8, 440]],
    rates: [
      [61, 440, 0, 2],
      [52, 452, 1, 3],
    ],
  },
  {
    seq: 457,
    name: 'Arganlif Hair Serum 50 ml',
    composition: 'Argan oil + Biotin',
    maker: 2,
    mrp: 999,
    gst: 18,
    min: 2,
    max: 10,
    batches: [['A26013', '02/28', 2, 677]],
    rates: [
      [61, 677, 0, 2],
      [58, 690, 0, 1],
    ],
  },
  {
    seq: 456,
    name: 'Glycolac Cream',
    composition: 'Glycolic acid 6%',
    maker: 3,
    mrp: 162,
    gst: 12,
    min: 2,
    max: 10,
    batches: [['026-312', '11/26', 3, 123]],
    rates: [[52, 123, 0, 2]],
  },
  {
    seq: 455,
    name: 'Epriva Tab',
    composition: 'Tranexamic acid 500',
    maker: 3,
    mrp: 278,
    gst: 12,
    min: 2,
    max: 10,
    batches: [['DS-25045', '10/27', 5, 212]],
    rates: [
      [61, 212, 1, 2],
      [52, 208, 0, 4],
    ],
  },
  {
    seq: 454,
    name: 'Admosh UV Sunscreen 60g',
    composition: 'Zinc oxide SPF 50',
    maker: 4,
    mrp: 550,
    gst: 18,
    min: 2,
    max: 10,
    batches: [['ASC002', '07/28', 2, 182]],
    rates: [
      [58, 182, 0, 1],
      [59, 176, 0, 3],
    ],
  },
  {
    seq: 453,
    name: 'Beyolaic Cream',
    composition: 'Azelaic acid 20%',
    maker: 6,
    mrp: 239,
    gst: 12,
    min: 2,
    max: 10,
    batches: [['ADE25510', '10/26', 7, 227]],
    rates: [[52, 227, 0, 2]],
  },
  {
    seq: 452,
    name: 'Yorgain Pro Hair Choc Powder',
    composition: 'Protein + Biotin',
    maker: 5,
    mrp: 1175,
    gst: 5,
    min: 2,
    max: 10,
    batches: [['GH203', '01/28', 4, 559]],
    rates: [
      [58, 559, 0, 2],
      [59, 570, 1, 2],
    ],
  },
  {
    seq: 451,
    name: 'Trichospire Hair Kit',
    composition: 'Minoxidil 5% + Finasteride',
    maker: 5,
    mrp: 1111,
    gst: 12,
    min: 2,
    max: 10,
    batches: [['GB531', '12/26', 0, 529]],
    rates: [[59, 529, 0, 3]],
  },
  {
    seq: 450,
    name: 'Azelan 20% Cream',
    composition: 'Azelaic acid 20%',
    maker: 2,
    mrp: 285,
    gst: 12,
    min: 2,
    max: 10,
    batches: [['AZ771', '05/28', 6, 190]],
    rates: [[61, 190, 0, 2]],
  },
];

/** A medicine's catalogue row by its id (`#458`). */
export function medicineBySeq(seq: number): MedicineRow {
  return must(
    MEDICINE_ROWS.find((row) => row.seq === seq),
    `medicine #${seq}`,
  );
}

/** The store's medicines; batch expiries move with the seed day. */
export function medicineSeed(today: string = clinicToday()): Medicine[] {
  return MEDICINE_ROWS.map((row) => ({
    ...masterCommon(today),
    id: ref.medicine(row.seq),
    seq: row.seq,
    name: row.name,
    composition: row.composition,
    manufacturerId: ref.manufacturer(row.maker),
    mrp: paise(row.mrp),
    gstPct: row.gst,
    minStock: row.min,
    maxStock: row.max,
    batches: row.batches.map(([batchNo, expiry, qty, rate]) => ({
      batchNo,
      expiry: seedExpiry(expiry, today),
      qty,
      purchaseRate: paise(rate),
    })),
    supplierRates: row.rates.map(([supplier, rate, free, leadDays]) => ({
      supplierId: ref.supplier(supplier),
      rate: paise(rate),
      free,
      leadDays,
    })),
    isQuick: false,
  }));
}

const PO_STAGES: Record<string, PoStage> = {
  Ordered: 'ordered',
  Received: 'received',
  Paid: 'paid',
  Cancelled: 'cancelled',
};

/** `MD_PO0` (H:3718), verbatim — items are [medicine, qty, free, rate ₹]. */
const PURCHASE_ORDER_ROWS: readonly {
  seq: number;
  bill: string;
  supplier: number;
  date: string;
  stage: string;
  /** Rupees. */
  paid: number;
  items: readonly (readonly [number, number, number, number])[];
}[] = [
  {
    seq: 431,
    bill: '1631',
    supplier: 58,
    date: '25 Sep',
    stage: 'Received',
    paid: 0,
    items: [
      [454, 5, 0, 182],
      [457, 3, 1, 690],
    ],
  },
  {
    seq: 430,
    bill: 'T-82370',
    supplier: 61,
    date: '24 Sep',
    stage: 'Ordered',
    paid: 0,
    items: [
      [451, 4, 0, 529],
      [455, 10, 2, 212],
    ],
  },
  {
    seq: 428,
    bill: '25420',
    supplier: 52,
    date: '22 Sep',
    stage: 'Paid',
    paid: 1200,
    items: [
      [456, 5, 0, 123],
      [453, 3, 0, 227],
    ],
  },
];

export function purchaseOrderSeed(today: string = clinicToday()): MedicalPurchaseOrder[] {
  return PURCHASE_ORDER_ROWS.map((row) => {
    const stage = must(PO_STAGES[row.stage], `PO stage ${row.stage}`);
    return {
      ...seedCommon(seedAt(row.date, '11:00', today), staffRef('FA')),
      id: ref.purchaseOrder(row.seq),
      seq: row.seq,
      supplierId: ref.supplier(row.supplier),
      supplierBillNo: row.bill,
      date: seedDay(row.date, today),
      stage,
      items: row.items.map(([medicine, qty, free, rate]) => ({
        medicineId: ref.medicine(medicine),
        qty,
        free,
        rate: paise(rate),
        batchNo: null,
        expiry: null,
        received: stage === 'received' || stage === 'paid',
      })),
      paid: paise(row.paid),
      cancelReason: null,
    };
  });
}

/** `CT_SEED` (H:3682): the store's walk-in customers. */
export function medicalContactSeed(today: string = clinicToday()): MedicalContact[] {
  return [
    {
      ...seedCommon(seedAt('26 Sep · 11:50', '11:50', today), staffRef('FA')),
      id: ref.medicalContact(1),
      name: 'Viral Sheth',
      phone: seedMobile('98250 77120'),
    },
  ];
}

/** One medicine sale line: [medicine, qty, batch]. */
type SaleLine = readonly [medicine: number, qty: number, batch: string];

export interface SaleRow {
  seq: number;
  /** The invoice every sale owns (`Invoice.saleId`); the prototype seeds none, so they follow #787. */
  invoice: number;
  patient: string | null;
  contact: number | null;
  at: string;
  lines: readonly SaleLine[];
  paid: boolean;
  by: StaffKey;
}

/** `MD_SALE0` (H:3719), verbatim. */
export const SALE_ROWS: readonly SaleRow[] = [
  {
    seq: 983,
    invoice: 790,
    patient: 'Rhea Shah',
    contact: null,
    at: 'Today 10:12',
    lines: [
      [454, 1, 'ASC002'],
      [458, 1, 'CSH26044'],
    ],
    paid: true,
    by: 'FA',
  },
  {
    seq: 982,
    invoice: 789,
    patient: null,
    contact: 1,
    at: '26 Sep 11:53',
    lines: [[450, 1, 'AZ771']],
    paid: true,
    by: 'FA',
  },
  {
    seq: 978,
    invoice: 788,
    patient: 'Dharti Galani',
    contact: null,
    at: '25 Sep 10:52',
    lines: [
      [453, 1, 'ADE25510'],
      [456, 2, '026-312'],
    ],
    paid: false,
    by: 'DR',
  },
];

export function medicalSaleSeed(today: string = clinicToday()): MedicalSale[] {
  return SALE_ROWS.map((row) => {
    const soldAt = seedAt(row.at, '12:00', today);
    return {
      ...seedCommon(soldAt, staffRef(row.by)),
      id: ref.medicalSale(row.seq),
      seq: row.seq,
      invoiceId: ref.invoice(row.invoice),
      patientId: row.patient ? patientRef(row.patient) : null,
      medicalContactId: row.contact === null ? null : ref.medicalContact(row.contact),
      prescriptionId: null,
      soldAt,
      voidedAt: null,
      returns: [],
    };
  });
}
