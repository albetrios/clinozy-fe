import { seedCommon } from '@/shared/api/app/app-fixture-seed.ts';
import { invoiceTotals } from '@/shared/api/app/app-money.ts';
import type {
  ExpenseCategory,
  Invoice,
  InvoiceItem,
  InvoiceType,
  PaymentMode,
} from '@/shared/api/app/app-schema.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import type { PaymentRecord } from '@/shared/api/app/payments-fixture-contracts.ts';

import { findOfferingByName, offeringBySeq } from './offerings.fixtures.ts';
import { branchRef, MAIN_BRANCH } from './organization.fixtures.ts';
import { PACKAGE_ROWS } from './patient-records.fixtures.ts';
import { patientRef } from './patients.fixtures.ts';
import { must, paise, readSeedLabel, ref, seedAt, seedDay } from './refs.fixtures.ts';
import { type StaffKey, staffRef } from './staff.fixtures.ts';

/**
 * `PY_INV`'s types — Medical aside: a medical bill is the Medical room's sale on clinozy-be
 * (MD28), so the fixture world seeds none.
 */
const INVOICE_TYPES: Record<string, InvoiceType> = {
  Clinic: 'clinic',
  Consultation: 'consultation',
};
/** `PY_MODES` (H:3612). */
const MODES: Record<string, PaymentMode> = { Cash: 'cash', UPI: 'upi', Card: 'card' };
/** `EX_CATS` (H:3691). */
const EXPENSE_CATEGORIES: Record<string, ExpenseCategory> = {
  Medicines: 'medicines',
  Consumables: 'consumables',
  Salary: 'salary',
  Rent: 'rent',
  Marketing: 'marketing',
  Utilities: 'utilities',
  Maintenance: 'maintenance',
  Misc: 'misc',
};

interface LineRow {
  name: string;
  qty: number;
  /** Rupees. */
  rate: number;
  disc: number;
  gst: number;
}

interface InvoiceRow {
  seq: number;
  type: string;
  patient: string | null;
  lines: readonly LineRow[];
  team: readonly StaffKey[];
  date: string;
  /** When it was raised, clinic time. */
  at: string;
  by: StaffKey;
  remark: string;
}

/**
 * `PY_INV` (H:3613–3622), verbatim but for its Medical rows (#785, #779 — the Medical room's
 * sales, on clinozy-be). What was paid is not stored on an invoice — it is the sum of the
 * receipts below, which match each row's `paid`.
 */
const INVOICE_ROWS: readonly InvoiceRow[] = [
  {
    seq: 787,
    type: 'Clinic',
    patient: 'Dharti Galani',
    lines: [{ name: 'LHR Full Face · B4G7', qty: 1, rate: 4800, disc: 0, gst: 0 }],
    team: ['DD', 'KP'],
    date: '24 Sep',
    at: '15:30',
    by: 'RS',
    remark: '',
  },
  {
    seq: 786,
    type: 'Consultation',
    patient: 'Dharti Galani',
    lines: [{ name: 'Consultation · New', qty: 1, rate: 300, disc: 100, gst: 0 }],
    team: ['DD'],
    date: '24 Sep',
    at: '15:20',
    by: 'RS',
    remark: 'Free first visit',
  },
  {
    seq: 784,
    type: 'Clinic',
    patient: 'Kiran Desai',
    lines: [{ name: 'Underarm Peel · 6 sessions', qty: 1, rate: 9000, disc: 5, gst: 0 }],
    team: ['DD', 'KP'],
    date: '2 Sep',
    at: '12:10',
    by: 'RS',
    remark: '',
  },
  {
    seq: 783,
    type: 'Clinic',
    patient: 'Rohan Pillai',
    lines: [{ name: 'Back Peeling', qty: 4, rate: 3000, disc: 0, gst: 0 }],
    team: ['DN'],
    date: '1 Sep',
    at: '11:20',
    by: 'NK',
    remark: 'Pay after 2nd session',
  },
  {
    seq: 781,
    type: 'Clinic',
    patient: 'Dhruv Patel',
    lines: [{ name: 'LHR Half Leg · 10 sessions', qty: 1, rate: 8500, disc: 10, gst: 0 }],
    team: ['KP'],
    date: '28 Aug',
    at: '17:15',
    by: 'RS',
    remark: '',
  },
  {
    seq: 772,
    type: 'Clinic',
    patient: 'Tanvi Shah',
    lines: [{ name: 'Corn Removal', qty: 1, rate: 1000, disc: 0, gst: 0 }],
    team: ['DR'],
    date: '6 Jun',
    at: '13:05',
    by: 'AS',
    remark: '',
  },
  // Today's checkout card: "Chemical peel + consult · ₹3,717 to pay" (H:3457) —
  // the peel line of the prototype's checkout bill (H:3543), 10% off, 18% GST.
  {
    seq: 791,
    type: 'Clinic',
    patient: 'Ishita Vora',
    lines: [{ name: 'Chemical peel', qty: 1, rate: 3500, disc: 10, gst: 18 }],
    team: ['DN'],
    date: 'Today',
    at: '10:30',
    by: 'RS',
    remark: '',
  },
];

/**
 * A package exists only through the invoice that sold it, and `PT_PK`'s
 * packages #2 and #3 have none in `PY_INV` — so each gets one: its offering at
 * list price, sold on the package's start date, paid in full the same day.
 */
const PACKAGE_INVOICE_ROWS: readonly InvoiceRow[] = PACKAGE_ROWS.filter(
  (pack) => !INVOICE_ROWS.some((row) => row.seq === pack.invoice),
).map((pack) => {
  const offering = offeringBySeq(pack.offering);
  const sold = readSeedLabel(pack.sold);
  return {
    seq: pack.invoice,
    type: 'Clinic',
    patient: pack.patient,
    lines: [{ name: offering.name, qty: 1, rate: offering.price, disc: 0, gst: 0 }],
    team: ['DD', 'KP'],
    date: sold.date,
    at: sold.time ?? '12:00',
    by: 'RS',
    remark: '',
  };
});

const ALL_INVOICE_ROWS = [...INVOICE_ROWS, ...PACKAGE_INVOICE_ROWS];

function invoiceItem(line: LineRow): InvoiceItem {
  const offering = findOfferingByName(line.name);
  return {
    offeringId: offering ? ref.offering(offering.seq) : null,
    medicineId: null,
    name: line.name,
    packSize: null,
    qty: line.qty,
    rate: paise(line.rate),
    discountPct: line.disc,
    gstPct: line.gst,
    batchNo: null,
  };
}

export function invoiceSeed(today: string = appToday()): Invoice[] {
  return ALL_INVOICE_ROWS.map((row) => ({
    ...seedCommon(seedAt(`${row.date} · ${row.at}`, '12:00', today), staffRef(row.by)),
    id: ref.invoice(row.seq),
    seq: row.seq,
    type: must(INVOICE_TYPES[row.type], `invoice type ${row.type}`),
    branchId: branchRef(MAIN_BRANCH),
    patientId: row.patient ? patientRef(row.patient) : null,
    medicalContactId: null,
    teamIds: row.team.map(staffRef),
    items: row.lines.map(invoiceItem),
    overallDiscount: 0,
    date: seedDay(row.date, today),
    remark: row.remark || null,
    prescriptionId: null,
    saleId: null,
  }));
}

interface ReceiptRow {
  seq: number;
  at: string;
  patient: string | null;
  invoice: number | null;
  mode: string;
  /** Rupees; negative is a refund. */
  amount: number;
  by: StaffKey;
  note: string;
}

/**
 * `PY_TX` (H:3623–3630), verbatim ("TX-5509" is PAY-5509) but for the receipts on its Medical
 * invoices (PAY-5512, PAY-5501). The refund's INV-760 is in no seed, so it stays unlinked.
 */
const RECEIPT_ROWS: readonly ReceiptRow[] = [
  {
    seq: 5509,
    at: '27 Sep 18:40',
    patient: 'Dhruv Patel',
    invoice: 781,
    mode: 'Card',
    amount: 3650,
    by: 'RS',
    note: '',
  },
  {
    seq: 5488,
    at: '28 Aug 17:22',
    patient: 'Dhruv Patel',
    invoice: 781,
    mode: 'UPI',
    amount: 4000,
    by: 'RS',
    note: '',
  },
  {
    seq: 5470,
    at: '6 Jun 13:10',
    patient: 'Tanvi Shah',
    invoice: 772,
    mode: 'Cash',
    amount: 400,
    by: 'AS',
    note: '',
  },
  {
    seq: 5466,
    at: '4 Jun 11:00',
    patient: 'Tanvi Shah',
    invoice: null,
    mode: 'UPI',
    amount: -500,
    by: 'MJ',
    note: 'Charged twice',
  },
];

/** Receipts for the invoices added above: the two package sales. */
const ADDED_RECEIPTS: readonly {
  seq: number;
  invoice: number;
  at: string;
  by: StaffKey;
}[] = [
  { seq: 5480, invoice: 780, at: '23 Aug · 12:35', by: 'RS' },
  { seq: 5505, invoice: 782, at: '24 Sep · 15:50', by: 'RS' },
];

interface ExpenseRow {
  seq: number;
  at: string;
  category: string;
  to: string;
  /** Rupees. */
  amount: number;
  mode: string;
  by: StaffKey;
  note: string;
}

/** `EX_SEED` (H:3692–3698), verbatim ("EX-306" is PAY-306). */
const EXPENSE_ROWS: readonly ExpenseRow[] = [
  {
    seq: 306,
    at: '26 Sep 19:10',
    category: 'Misc',
    to: 'Courier',
    amount: 180,
    mode: 'Cash',
    by: 'RS',
    note: 'Report pickup',
  },
  {
    seq: 311,
    at: 'Today 09:40',
    category: 'Consumables',
    to: 'Medline Surgicals',
    amount: 3200,
    mode: 'UPI',
    by: 'MJ',
    note: 'Gloves, gauze, alcohol swabs',
  },
  {
    seq: 310,
    at: 'Today 11:05',
    category: 'Misc',
    to: 'Tea & snacks',
    amount: 260,
    mode: 'Cash',
    by: 'RS',
    note: '',
  },
  {
    seq: 309,
    at: '27 Sep 18:10',
    category: 'Marketing',
    to: 'Meta ads',
    amount: 5000,
    mode: 'Card',
    by: 'MJ',
    note: 'Monsoon skin campaign',
  },
  {
    seq: 305,
    at: '25 Sep 12:00',
    category: 'Maintenance',
    to: 'Soprano service',
    amount: 8500,
    mode: 'UPI',
    by: 'MJ',
    note: 'Quarterly service',
  },
  {
    seq: 301,
    at: '1 Sep 10:00',
    category: 'Rent',
    to: 'Landlord · Adajan',
    amount: 65000,
    mode: 'UPI',
    by: 'MJ',
    note: '',
  },
];

const paymentBase = (seq: number, at: string, by: StaffKey, today: string) => {
  const paidAt = seedAt(at, '12:00', today);
  return {
    ...seedCommon(paidAt, staffRef(by)),
    id: ref.payment(seq),
    seq,
    branchId: branchRef(MAIN_BRANCH),
    billRef: null,
    creditNoteId: null,
    pendingCreditId: null,
    paidAt,
    // The fixture world closes no day: Day close is clinozy-be's.
    dayCloseId: null,
    // The plan's fields (Appendix F): no seed carries a reference, an edit or a photo.
    reference: null,
    edits: [],
    attachmentKeys: [],
  };
};

/** The ledger: receipts and the refund, the added receipts, then the expenses. */
export function paymentSeed(today: string = appToday()): PaymentRecord[] {
  const invoices = invoiceSeed(today);
  const receipts = RECEIPT_ROWS.map((row): PaymentRecord => {
    const amount = paise(Math.abs(row.amount));
    const refund = row.amount < 0;
    return {
      ...paymentBase(row.seq, row.at, row.by, today),
      direction: refund ? 'paid' : 'received',
      kind: refund ? 'refund' : 'receipt',
      amount,
      splits: [{ mode: must(MODES[row.mode], `mode ${row.mode}`), amount }],
      patientId: row.patient ? patientRef(row.patient) : null,
      invoiceId: row.invoice === null ? null : ref.invoice(row.invoice),
      payeeName: null,
      expenseCategory: null,
      note: row.note || null,
    };
  });
  const added = ADDED_RECEIPTS.map((row): PaymentRecord => {
    const invoice = must(
      invoices.find((candidate) => candidate.seq === row.invoice),
      `invoice #${row.invoice}`,
    );
    const amount = invoiceTotals(invoice).bill;
    return {
      ...paymentBase(row.seq, row.at, row.by, today),
      direction: 'received',
      kind: 'receipt',
      amount,
      splits: [{ mode: 'upi', amount }],
      patientId: invoice.patientId,
      invoiceId: invoice.id,
      payeeName: null,
      expenseCategory: null,
      note: null,
    };
  });
  const expenses = EXPENSE_ROWS.map((row): PaymentRecord => {
    const amount = paise(row.amount);
    return {
      ...paymentBase(row.seq, row.at, row.by, today),
      direction: 'paid',
      kind: 'expense',
      amount,
      splits: [{ mode: must(MODES[row.mode], `mode ${row.mode}`), amount }],
      patientId: null,
      invoiceId: null,
      payeeName: row.to,
      expenseCategory: must(EXPENSE_CATEGORIES[row.category], `category ${row.category}`),
      note: row.note || null,
    };
  });
  return [...receipts, ...added, ...expenses];
}
