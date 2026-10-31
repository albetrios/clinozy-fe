/**
 * Test data for the shared Invoice drawer on clinozy-be (`/app/invoices`, its previews, the
 * offerings it bills, the team it credits) — shaped as the live stack answered them: the
 * Adajan and Vesu branches, three offerings (Research Peel with its live ₹149.50-off offer and
 * a ₹1,500 lowest price, the LHR Full Face package of seven sessions, the Consultation), Kavya
 * Mehta's consultation invoice #5 (`payments-doubles.ts`) and the server's preview of a bill.
 * Ids are public ids; money is rupees. Override what a test is about.
 */
import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type {
  InvoiceDetail,
  InvoicePreview,
  InvoiceRecord,
} from '@/shared/api/app/invoices-contracts.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/app/offerings-contracts.ts';

import { offeringRecord, offerRecord } from './offering-doubles.ts';
import {
  invoiceRecord,
  TEST_MONEY_AUTHOR_ID,
  TEST_MONEY_BRANCH_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
} from './payments-doubles.ts';

/** The Vesu branch. */
export const TEST_VESU_BRANCH_ID = 'brn_thsaog1i8bv6m9rd9ucoy';

/** Research Peel — ₹2,000, offer price ₹1,800, lowest ₹1,500, 18% GST on top. */
export const TEST_PEEL_ID = 'off_xh6ravxjcszcpta6taym0';

/** LHR Full Face — a package of seven sessions, ₹4,800. */
export const TEST_LHR_ID = 'off_12y8j0m4ewq7zyr32dqvt';

/** The Consultation — ₹500, no GST. */
export const TEST_CONSULTATION_ID = 'off_3f4nzxf53tfyf9k6hlna1';

/** The ₹149.50-off offer on Research Peel. */
export const TEST_PEEL_OFFER_ID = 'ofr_dp2wl7idn8v6nsqob6ox2';

/** A second member of the team. */
export const TEST_DOCTOR_ID = 'mem_drashti00000000000000';

/** The member's two branches — Adajan the main one. */
export const INVOICE_TEST_BRANCHES: BranchOption[] = [
  {
    id: TEST_MONEY_BRANCH_ID,
    name: 'Adajan',
    tone: 'sky',
    isMain: true,
    opensAt: '10:00',
    closesAt: '19:00',
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    reviewLink: null,
  },
  {
    id: TEST_VESU_BRANCH_ID,
    name: 'Vesu',
    tone: 'mint',
    isMain: false,
    opensAt: '10:00',
    closesAt: '19:00',
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    reviewLink: null,
  },
];

/** The offerings the drawer lists: Research Peel and LHR Full Face everywhere, the Consultation. */
export const INVOICE_TEST_OFFERINGS: OfferingRecord[] = [
  offeringRecord({ id: TEST_PEEL_ID, branchIds: [] }),
  offeringRecord({
    id: TEST_LHR_ID,
    offeringNumber: 2,
    name: 'LHR Full Face',
    category: 'package',
    tone: 'lav',
    price: 4800,
    offerPrice: null,
    minPrice: 4000,
    sessions: 7,
    branchIds: [],
    searchTerms: ['laser'],
  }),
  offeringRecord({
    id: TEST_CONSULTATION_ID,
    offeringNumber: 1,
    name: 'Consultation',
    category: 'consultation',
    tone: 'sky',
    price: 500,
    offerPrice: null,
    minPrice: 0,
    gstPercent: 0,
    branchIds: [],
    searchTerms: [],
  }),
];

/** The live offers: ₹149.50 off Research Peel. */
export const INVOICE_TEST_OFFERS: OfferRecord[] = [
  offerRecord({
    id: TEST_PEEL_OFFER_ID,
    name: 'Peel week',
    kind: 'amount',
    value: 149.5,
    offeringIds: [TEST_PEEL_ID],
    branchIds: [],
    status: 'live',
  }),
];

/** The team the drawer credits: Nisha (the member) and Dr. Drashti. */
export const INVOICE_TEST_TEAM: DirectoryMember[] = [
  {
    id: TEST_MONEY_AUTHOR_ID,
    userId: 'usr_test',
    name: 'Nisha Shah',
    initials: 'NS',
    tone: 'sage',
    roleIds: [],
    branchIds: [],
  },
  {
    id: TEST_DOCTOR_ID,
    userId: 'usr_drashti',
    name: 'Dr. Drashti Patel',
    initials: 'DP',
    tone: 'lav',
    roleIds: [],
    branchIds: [],
  },
];

/** One preview line as the server prices it: a new line, no offer, GST on top. */
type PreviewLineSpec = Partial<InvoicePreview['items'][number]> &
  Pick<InvoicePreview['items'][number], 'offeringId' | 'name' | 'qty' | 'rate'>;

/**
 * The server's preview of a bill — each line's figures as `computeInvoiceAmounts` works them
 * (gross, the line's discount, GST on top), the totals their sums. Pass what a test needs; the
 * rest follows the server's rule for exclusive GST without an overall discount.
 */
export function invoicePreview(
  lines: readonly PreviewLineSpec[],
  overrides: Partial<InvoicePreview> = {},
): InvoicePreview {
  const items = lines.map((spec, index) => {
    const gross = spec.rate * spec.qty;
    const discountPct = spec.discountPct ?? 0;
    const discountAmount = Math.round(gross * discountPct) / 100;
    const gstPct = spec.gstPct ?? 18;
    const taxableAmount = gross - discountAmount;
    const gstAmount = Math.round(taxableAmount * gstPct) / 100;
    return {
      id: null,
      lineNumber: index + 1,
      medicineId: null,
      packSize: null,
      hsnCode: null,
      discountPct,
      discountAmount,
      gstPct,
      isGstInclusive: false,
      taxableAmount,
      gstAmount,
      amount: taxableAmount + gstAmount,
      suggestionId: null,
      batchNo: null,
      offerIds: [],
      sessionsTotal: spec.qty,
      ...spec,
    };
  });
  const sum = (pick: (line: (typeof items)[number]) => number) =>
    Math.round(items.reduce((total, line) => total + pick(line), 0) * 100) / 100;
  const total = sum((line) => line.amount);
  return {
    type: 'clinic',
    date: '2026-10-10',
    items,
    overallDiscount: 0,
    subtotal: sum((line) => line.rate * line.qty),
    discountTotal: sum((line) => line.discountAmount),
    taxableTotal: sum((line) => line.taxableAmount),
    gstTotal: sum((line) => line.gstAmount),
    total,
    paid: 0,
    refunded: 0,
    due: total,
    ...overrides,
  };
}

/**
 * One invoice with what reads beside it (`fetchInvoice`) — invoice #5 by default, billing Kavya
 * Mehta, nothing on the ledger, the Adajan branch's sheet.
 */
export function invoiceDetail(invoice: InvoiceRecord = invoiceRecord()): InvoiceDetail {
  return {
    invoice,
    party: {
      contactId: invoice.contactId ?? TEST_MONEY_CONTACT_ID,
      patientId: invoice.patientId ?? TEST_MONEY_PATIENT_ID,
      name: invoice.contact?.name ?? 'Kavya Mehta',
      phone: invoice.contact?.phone ?? '+919825005865',
    },
    payments: [],
    sheet: {
      organization: { name: 'Demo Organization', specialties: ['skin'], currency: 'INR' },
      branch: {
        id: invoice.branchId,
        name: 'Adajan',
        phone: '+919800000000',
        gstNumber: '24ABCDE1234F1Z5',
        address: {
          lineOne: '12 Ring Road',
          lineTwo: null,
          area: 'Adajan',
          city: 'Surat',
          state: 'Gujarat',
          postalCode: '395009',
        },
      },
    },
  };
}
