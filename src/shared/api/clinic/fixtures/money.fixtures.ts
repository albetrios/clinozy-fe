import { seedCommon } from '@/shared/api/clinic/clinic-fixture-seed.ts';
import { invoiceTotals } from '@/shared/api/clinic/clinic-money.ts';
import type {
  CreditNote,
  DayClose,
  ExpenseCategory,
  Invoice,
  InvoiceItem,
  InvoiceType,
  Payment,
  PaymentMode,
  PendingCredit,
} from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';

import { medicineBySeq, SALE_ROWS } from './medical.fixtures.ts';
import { findOfferingByName, offeringBySeq } from './offerings.fixtures.ts';
import { branchRef, MAIN_BRANCH } from './organization.fixtures.ts';
import { PACKAGE_ROWS } from './patient-records.fixtures.ts';
import { patientRef } from './patients.fixtures.ts';
import { must, paise, readSeedLabel, ref, seedAt, seedDay } from './refs.fixtures.ts';
import { type StaffKey, staffRef } from './staff.fixtures.ts';

const INVOICE_TYPES: Record<string, InvoiceType> = {
  Clinic: 'clinic',
  Medical: 'medical',
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
  medicine?: number;
  batch?: string;
}

interface InvoiceRow {
  seq: number;
  type: string;
  patient: string | null;
  contact?: number;
  lines: readonly LineRow[];
  team: readonly StaffKey[];
  date: string;
  /** When it was raised, clinic time. */
  at: string;
  by: StaffKey;
  remark: string;
  sale?: number;
}

/**
 * `PY_INV` (H:3613–3622), verbatim. What was paid is not stored on an invoice —
 * it is the sum of the receipts below, which match each row's `paid`.
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
    seq: 785,
    type: 'Medical',
    patient: 'Rhea Shah',
    lines: [
      { name: 'Flubolt 400', qty: 8, rate: 120, disc: 0, gst: 12 },
      { name: 'Clonix-B Lotion', qty: 1, rate: 340, disc: 0, gst: 18 },
    ],
    team: ['DN'],
    date: 'Today',
    at: '10:10',
    by: 'FA',
    remark: '',
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
    seq: 779,
    type: 'Medical',
    patient: 'Pooja Nair',
    lines: [{ name: 'Sunscreen SPF 50', qty: 2, rate: 650, disc: 0, gst: 18 }],
    team: ['DD'],
    date: '26 Aug',
    at: '12:00',
    by: 'FA',
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

/** Every Medical sale owns its invoice (`Invoice.saleId`): the sold lines at MRP. */
const SALE_INVOICE_ROWS: readonly InvoiceRow[] = SALE_ROWS.map((sale) => {
  const sold = readSeedLabel(sale.at);
  return {
    seq: sale.invoice,
    type: 'Medical',
    patient: sale.patient,
    contact: sale.contact ?? undefined,
    lines: sale.lines.map(([medicine, qty, batch]) => {
      const row = medicineBySeq(medicine);
      return {
        name: row.name,
        qty,
        rate: row.mrp,
        disc: 0,
        gst: row.gst,
        medicine,
        batch,
      };
    }),
    team: [],
    date: sold.date,
    at: sold.time ?? '12:00',
    by: sale.by,
    remark: '',
    sale: sale.seq,
  };
});

const ALL_INVOICE_ROWS = [...INVOICE_ROWS, ...PACKAGE_INVOICE_ROWS, ...SALE_INVOICE_ROWS];

function invoiceItem(line: LineRow): InvoiceItem {
  const offering =
    line.medicine === undefined ? findOfferingByName(line.name) : undefined;
  return {
    offeringId: offering ? ref.offering(offering.seq) : null,
    medicineId: line.medicine === undefined ? null : ref.medicine(line.medicine),
    name: line.name,
    packSize: null,
    qty: line.qty,
    rate: paise(line.rate),
    discountPct: line.disc,
    gstPct: line.gst,
    batchNo: line.batch ?? null,
  };
}

export function invoiceSeed(today: string = clinicToday()): Invoice[] {
  return ALL_INVOICE_ROWS.map((row) => ({
    ...seedCommon(seedAt(`${row.date} · ${row.at}`, '12:00', today), staffRef(row.by)),
    id: ref.invoice(row.seq),
    seq: row.seq,
    type: must(INVOICE_TYPES[row.type], `invoice type ${row.type}`),
    branchId: branchRef(MAIN_BRANCH),
    patientId: row.patient ? patientRef(row.patient) : null,
    medicalContactId: row.contact === undefined ? null : ref.medicalContact(row.contact),
    teamIds: row.team.map(staffRef),
    items: row.lines.map(invoiceItem),
    overallDiscount: 0,
    date: seedDay(row.date, today),
    remark: row.remark || null,
    prescriptionId: null,
    saleId: row.sale === undefined ? null : ref.medicalSale(row.sale),
  }));
}

/** No seed issues a credit note: the one refund (TX-5466) names CN-100 on INV-760, neither of which any seed defines. */
export function creditNoteSeed(): CreditNote[] {
  return [];
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
 * `PY_TX` (H:3623–3630), verbatim ("TX-5512" is PAY-5512). The refund's INV-760
 * is in no seed, so it stays unlinked.
 */
const RECEIPT_ROWS: readonly ReceiptRow[] = [
  {
    seq: 5512,
    at: 'Today 10:12',
    patient: 'Rhea Shah',
    invoice: 785,
    mode: 'UPI',
    amount: 600,
    by: 'FA',
    note: '',
  },
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
    seq: 5501,
    at: '26 Aug 12:05',
    patient: 'Pooja Nair',
    invoice: 779,
    mode: 'Cash',
    amount: 1534,
    by: 'FA',
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

/** Receipts for the invoices added above: the two package sales and the two paid Medical sales. */
const ADDED_RECEIPTS: readonly {
  seq: number;
  invoice: number;
  at: string;
  by: StaffKey;
}[] = [
  { seq: 5480, invoice: 780, at: '23 Aug · 12:35', by: 'RS' },
  { seq: 5505, invoice: 782, at: '24 Sep · 15:50', by: 'RS' },
  { seq: 5507, invoice: 789, at: '26 Sep · 11:55', by: 'FA' },
  { seq: 5513, invoice: 790, at: 'Today · 10:13', by: 'FA' },
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

interface CloseRow {
  date: string;
  by: StaffKey;
  /** Counted cash, rupees. */
  cash: number;
}

/** `DC_HIST` (H:3699), oldest first; each day opens on the last close's count. */
const CLOSE_ROWS: readonly CloseRow[] = [
  { date: '23 Sep', by: 'RS', cash: 6420 },
  { date: '24 Sep', by: 'AS', cash: 4980 },
  { date: '25 Sep', by: 'RS', cash: 7310 },
];

/** The first close opens on the default float (Appendix F: ₹2,000). */
const DEFAULT_FLOAT = 2000;

/** The close that locks a payment, when its day (main branch) was closed. */
function closeOf(label: string): string | null {
  const day = readSeedLabel(label).date;
  return CLOSE_ROWS.some((row) => readSeedLabel(row.date).date === day)
    ? ref.dayClose(day)
    : null;
}

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
    dayCloseId: closeOf(at),
  };
};

/** The ledger: receipts and the refund, the added receipts, then the expenses. */
export function paymentSeed(today: string = clinicToday()): Payment[] {
  const invoices = invoiceSeed(today);
  const receipts = RECEIPT_ROWS.map((row): Payment => {
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
  const added = ADDED_RECEIPTS.map((row): Payment => {
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
  const expenses = EXPENSE_ROWS.map((row): Payment => {
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

/**
 * `PY_CR0` (H:3683), verbatim: "them" is give (we owe them), "us" is take
 * (they owe us); "from" is the payment it came from.
 */
export function pendingCreditSeed(today: string = clinicToday()): PendingCredit[] {
  const rows = [
    {
      seq: 2,
      direction: 'give',
      party: 'Tanvi Shah',
      patient: 'Tanvi Shah',
      amount: 500,
      reason: 'Charged twice for corn removal',
      from: 5466,
      at: '4 Jun · 11:05',
    },
    {
      seq: 1,
      direction: 'take',
      party: 'Medline Surgicals',
      patient: null,
      amount: 800,
      reason: 'Returned a box of damaged gloves',
      from: 305,
      at: '24 Sep · 12:00',
    },
  ] as const;
  return rows.map((row) => ({
    ...seedCommon(seedAt(row.at, '12:00', today), staffRef('MJ')),
    id: ref.pendingCredit(row.seq),
    seq: row.seq,
    direction: row.direction,
    partyName: row.party,
    patientId: row.patient === null ? null : patientRef(row.patient),
    amount: paise(row.amount),
    reason: row.reason,
    sourcePaymentId: ref.payment(row.from),
    status: 'open',
    settledPaymentId: null,
  }));
}

/** The closed days, main branch: opening accepted at opening time, closed after hours. */
export function dayCloseSeed(today: string = clinicToday()): DayClose[] {
  return CLOSE_ROWS.map((row, index) => {
    const previous = CLOSE_ROWS[index - 1];
    const day = readSeedLabel(row.date).date;
    const closedAt = seedAt(`${row.date} · 20:10`, '20:10', today);
    return {
      ...seedCommon(
        seedAt(`${row.date} · 10:00`, '10:00', today),
        staffRef(row.by),
        closedAt,
      ),
      id: ref.dayClose(day),
      branchId: branchRef(MAIN_BRANCH),
      date: seedDay(row.date, today),
      openingCash: paise(previous ? previous.cash : DEFAULT_FLOAT),
      openingSource: previous ? 'carried' : 'default_float',
      openingAcceptedAt: seedAt(`${row.date} · 10:00`, '10:00', today),
      countedCash: paise(row.cash),
      closedAt,
      closedById: staffRef(row.by),
    };
  });
}
