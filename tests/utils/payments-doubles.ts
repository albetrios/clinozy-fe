/**
 * Test data for Payments and invoices as clinozy-be answers them (`/app/payments`,
 * `/app/invoices`, `/app/pending-credits`, `/app/day-closes`) — the wire rows as the API sends
 * them (read from the local stack: Kavya Mehta's consultation invoice #5, her receipt PAY-5 in
 * cash and UPI, her credit CR-1, a closed day at Vesu) and the rooms' rows they map to. Ids are
 * public ids (`<prefix>_<21 [a-z0-9]>`); money is rupees. Override what a test is about.
 */
import type { CreditRow } from '@/shared/api/app/credits-contracts.ts';
import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';

/** Kavya Mehta's contact. */
export const TEST_MONEY_CONTACT_ID = 'con_ebj92x3oamfu4qjwim3wq';

/** Kavya Mehta's patient file. */
export const TEST_MONEY_PATIENT_ID = 'pat_9e6j52vjb8uhvz44ebe94';

/** The Adajan branch. */
export const TEST_MONEY_BRANCH_ID = 'brn_53j4b7hz7nfb0otr2d920';

/** Invoice #5 (2026-27/0005). */
export const TEST_INVOICE_ID = 'invc_4ea44s81zsxncy705mp01';

/** Receipt PAY-5. */
export const TEST_PAYMENT_ID = 'pay_5vstwdmuz5fnklr2jy6aa';

/** Credit CR-1. */
export const TEST_CREDIT_ID = 'pcr_we40yt62z64ocgwqzv7ct';

/** The Vesu branch's close of 9 Oct. */
export const TEST_DAY_CLOSE_ID = 'dcl_7buduka338xg0nnknf75g';

/** The member who recorded them. */
export const TEST_MONEY_AUTHOR_ID = 'mem_yls33gz5jj66ful8q4ads';

const CREATED_AT = '2026-10-10T04:49:47.762Z';
const UPDATED_AT = '2026-10-10T04:49:53.855Z';

/** Kavya Mehta as an entry or an invoice embeds her. */
const contactWire = {
  id: TEST_MONEY_CONTACT_ID,
  name: 'Kavya Mehta',
  primary_phone: '+919825005865',
};

/**
 * A ledger entry as the API answers it — PAY-5, ₹150 received from Kavya Mehta in cash and UPI
 * against invoice #5, edited once (cash ₹100 → cash ₹100 + UPI ₹50).
 */
export const paymentWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_PAYMENT_ID,
  payment_number: 5,
  direction: 'received',
  kind: 'receipt',
  branch_id: TEST_MONEY_BRANCH_ID,
  amount: 150,
  splits: [
    { mode: 'cash', amount: 100 },
    { mode: 'upi', amount: 50 },
  ],
  paid_at: '2026-10-10T04:49:47.769Z',
  contact: contactWire,
  patient_id: TEST_MONEY_PATIENT_ID,
  invoice_id: TEST_INVOICE_ID,
  invoice: {
    invoice_sequence: 5,
    invoice_number: '2026-27/0005',
    type: 'consultation',
    due_amount: 100,
  },
  invoice_credit_note_id: null,
  invoice_credit_note_number: null,
  pending_credit_id: null,
  pending_credit_number: null,
  stock_purchase_id: null,
  stock_purchase: null,
  medical_purchase_order_id: null,
  medical_purchase_order: null,
  reverses_payment_id: null,
  reversed_by_payment_id: null,
  payee_name: null,
  expense_category: null,
  reference: 'REF9',
  note: 'At the desk',
  attachment_keys: [],
  is_settled: false,
  edit_count: 1,
  last_edit: {
    id: 'pedit_koemr3ulrnhby9q904rcb',
    changes: {
      splits: {
        from: [{ mode: 'cash', amount: 100 }],
        to: [
          { mode: 'cash', amount: 100 },
          { mode: 'upi', amount: 50 },
        ],
      },
      reference: { from: null, to: 'REF9' },
    },
    author_membership_id: TEST_MONEY_AUTHOR_ID,
    created_at: UPDATED_AT,
  },
  created_by_membership_id: TEST_MONEY_AUTHOR_ID,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
  ...patch,
});

/** A ledger row as the rooms read it — PAY-5 (see {@link paymentWire}), by Nisha. */
export function ledgerRow(overrides: Partial<LedgerRow> = {}): LedgerRow {
  return {
    id: TEST_PAYMENT_ID,
    seq: 5,
    direction: 'received',
    kind: 'receipt',
    branchId: TEST_MONEY_BRANCH_ID,
    amount: 150,
    splits: [
      { mode: 'cash', amount: 100 },
      { mode: 'upi', amount: 50 },
    ],
    paidAt: '2026-10-10T04:49:47.769Z',
    contactId: TEST_MONEY_CONTACT_ID,
    contact: { id: TEST_MONEY_CONTACT_ID, name: 'Kavya Mehta', phone: '+919825005865' },
    partyName: 'Kavya Mehta',
    patientId: TEST_MONEY_PATIENT_ID,
    invoiceId: TEST_INVOICE_ID,
    creditNoteId: null,
    pendingCreditId: null,
    stockPurchaseId: null,
    medicalPurchaseOrderId: null,
    reversesPaymentId: null,
    reversedByPaymentId: null,
    payeeName: null,
    expenseCategory: null,
    reference: 'REF9',
    note: 'At the desk',
    attachmentKeys: [],
    isSettled: false,
    editCount: 1,
    lastEdit: {
      id: 'pedit_koemr3ulrnhby9q904rcb',
      at: UPDATED_AT,
      authorId: TEST_MONEY_AUTHOR_ID,
      changes: {
        splits: {
          from: [{ mode: 'cash', amount: 100 }],
          to: [
            { mode: 'cash', amount: 100 },
            { mode: 'upi', amount: 50 },
          ],
        },
        reference: { from: null, to: 'REF9' },
      },
    },
    createdById: TEST_MONEY_AUTHOR_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    invoice: { seq: 5, number: '2026-27/0005', type: 'consultation', due: 100 },
    creditNoteSeq: null,
    pendingCreditSeq: null,
    bill: null,
    by: { id: TEST_MONEY_AUTHOR_ID, name: 'Nisha Shah', initials: 'NS', tone: 'sage' },
    ...overrides,
  };
}

/** An invoice as the API answers it — #5, a ₹500 consultation, ₹400 paid. */
export const invoiceWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_INVOICE_ID,
  invoice_sequence: 5,
  invoice_number: '2026-27/0005',
  financial_year: '2026-27',
  type: 'consultation',
  branch_id: TEST_MONEY_BRANCH_ID,
  contact: contactWire,
  patient_id: TEST_MONEY_PATIENT_ID,
  member_ids: [],
  items: [
    {
      id: 'iitm_7ocmisga5mzisg1w1uok1',
      line_number: 1,
      offering_id: 'off_3f4nzxf53tfyf9k6hlna1',
      medicine_id: null,
      name: 'Consultation',
      pack_size: null,
      hsn_code: null,
      quantity: 1,
      rate: 500,
      discount_percent: 0,
      discount_amount: 0,
      gst_percent: 0,
      is_gst_inclusive: false,
      taxable_amount: 500,
      gst_amount: 0,
      amount: 500,
      patient_offering_suggestion_id: null,
      patient_offering_id: null,
      patient_treatment_ids: [],
      batch_number: null,
      description: null,
    },
  ],
  overall_discount: 0,
  subtotal: 500,
  discount_total: 0,
  taxable_total: 500,
  gst_total: 0,
  total: 500,
  paid_amount: 400,
  refunded_amount: 0,
  due_amount: 100,
  payment_status: 'partial',
  is_settled: false,
  invoice_date: '2026-10-10',
  remark: 'Paid at the desk',
  patient_prescription_id: null,
  created_by_membership_id: TEST_MONEY_AUTHOR_ID,
  created_at: '2026-10-10T04:49:40.481Z',
  updated_at: '2026-10-10T04:58:06.910Z',
  ...patch,
});

/** An invoice as the rooms read it — #5 (see {@link invoiceWire}). */
export function invoiceRecord(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: TEST_INVOICE_ID,
    seq: 5,
    number: '2026-27/0005',
    financialYear: '2026-27',
    type: 'consultation',
    branchId: TEST_MONEY_BRANCH_ID,
    contactId: TEST_MONEY_CONTACT_ID,
    contact: { id: TEST_MONEY_CONTACT_ID, name: 'Kavya Mehta', phone: '+919825005865' },
    patientId: TEST_MONEY_PATIENT_ID,
    teamIds: [],
    items: [
      {
        id: 'iitm_7ocmisga5mzisg1w1uok1',
        lineNumber: 1,
        offeringId: 'off_3f4nzxf53tfyf9k6hlna1',
        medicineId: null,
        name: 'Consultation',
        description: null,
        packSize: null,
        hsnCode: null,
        qty: 1,
        rate: 500,
        discountPct: 0,
        discountAmount: 0,
        gstPct: 0,
        isGstInclusive: false,
        taxableAmount: 500,
        gstAmount: 0,
        amount: 500,
        suggestionId: null,
        patientOfferingId: null,
        treatmentIds: [],
        batchNo: null,
      },
    ],
    overallDiscount: 0,
    subtotal: 500,
    discountTotal: 0,
    taxableTotal: 500,
    gstTotal: 0,
    total: 500,
    paid: 400,
    refunded: 0,
    due: 100,
    status: 'partial',
    isSettled: false,
    date: '2026-10-10',
    remark: 'Paid at the desk',
    prescriptionId: null,
    createdById: TEST_MONEY_AUTHOR_ID,
    createdAt: '2026-10-10T04:49:40.481Z',
    updatedAt: '2026-10-10T04:58:06.910Z',
    ...overrides,
  };
}

/** A pending credit as the API answers it — CR-1: give Kavya ₹80, ₹50 used on invoice #5. */
export const creditWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_CREDIT_ID,
  pending_credit_number: 1,
  direction: 'give',
  contact: contactWire,
  patient_id: TEST_MONEY_PATIENT_ID,
  party_name: null,
  amount: 80,
  settled_amount: 50,
  left_amount: 30,
  status: 'open',
  reason: 'overpaid',
  note: 'Paid twice at the desk',
  invoice_id: TEST_INVOICE_ID,
  source_payment_id: null,
  settle_by: '2026-10-20',
  payment_ids: ['pay_92c7hxmos9ecucof9tzhg'],
  created_by_membership_id: TEST_MONEY_AUTHOR_ID,
  created_at: '2026-10-10T04:50:01.147Z',
  updated_at: '2026-10-10T04:50:01.303Z',
  ...patch,
});

/** A Pending row as the rooms read it — CR-1 (see {@link creditWire}). */
export function creditRow(overrides: Partial<CreditRow> = {}): CreditRow {
  return {
    id: TEST_CREDIT_ID,
    seq: 1,
    direction: 'give',
    contactId: TEST_MONEY_CONTACT_ID,
    contact: { id: TEST_MONEY_CONTACT_ID, name: 'Kavya Mehta', phone: '+919825005865' },
    patientId: TEST_MONEY_PATIENT_ID,
    partyName: 'Kavya Mehta',
    amount: 80,
    settled: 50,
    left: 30,
    status: 'open',
    reason: 'overpaid',
    reasonKey: 'overpaid',
    note: 'Paid twice at the desk',
    invoiceId: TEST_INVOICE_ID,
    sourcePaymentId: null,
    settleBy: '2026-10-20',
    paymentIds: ['pay_92c7hxmos9ecucof9tzhg'],
    settledAt: null,
    createdById: TEST_MONEY_AUTHOR_ID,
    createdAt: '2026-10-10T04:50:01.147Z',
    updatedAt: '2026-10-10T04:50:01.303Z',
    by: { id: TEST_MONEY_AUTHOR_ID, name: 'Nisha Shah', initials: 'NS', tone: 'sage' },
    ...overrides,
  };
}

/** A day close as the API answers it — Vesu, 9 Oct, counted ₹280 against ₹300 expected. */
export const dayCloseWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_DAY_CLOSE_ID,
  branch_id: TEST_MONEY_BRANCH_ID,
  close_date: '2026-10-09',
  status: 'closed',
  opening_cash: 0,
  opening_source: 'carried',
  opening_accepted_at: '2026-10-10T04:51:52.117Z',
  opening_accepted_by_membership_id: TEST_MONEY_AUTHOR_ID,
  cash_in: 300,
  cash_out: 0,
  expected_cash: 300,
  counted_cash: 280,
  difference: -20,
  difference_reason: 'Short by twenty',
  close_kind: 'manual',
  closed_at: '2026-10-10T04:52:00.281Z',
  closed_by_membership_id: TEST_MONEY_AUTHOR_ID,
  net_by_mode: { cash: 300, upi: 0, card: 0, credit: 0 },
  by_member: [{ membership_id: TEST_MONEY_AUTHOR_ID, count: 1, amount: 300 }],
  entry_count: 1,
  events: [
    {
      id: 'dce_quxa4sqm7l6dvk6s6wngo',
      kind: 'opened',
      text: 'Opening cash ₹0.00',
      membership_id: TEST_MONEY_AUTHOR_ID,
      occurred_at: '2026-10-10T04:51:52.117Z',
    },
    {
      id: 'dce_4e2tmkn2mgme4dtkj6fp4',
      kind: 'closed',
      text: 'Counted ₹280.00, expected ₹300.00',
      membership_id: TEST_MONEY_AUTHOR_ID,
      occurred_at: '2026-10-10T04:52:00.277Z',
    },
  ],
  created_at: '2026-10-10T04:51:52.117Z',
  updated_at: '2026-10-10T04:52:00.277Z',
  ...patch,
});
