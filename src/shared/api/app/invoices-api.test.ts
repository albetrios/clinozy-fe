import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
}));
import { api } from '@/core/http/api.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { appInstant } from '@/shared/api/app/app-time.ts';
import { fetchTeamDirectory } from '@/shared/api/app/directory-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  invoiceRecord,
  invoiceWire,
  paymentWire,
  TEST_INVOICE_ID,
  TEST_MONEY_BRANCH_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  createInvoice,
  deleteInvoice,
  fetchAllInvoices,
  fetchInvoice,
  fetchInvoicePresets,
  fetchInvoiceTotals,
  listInvoices,
  listOpenInvoices,
  previewInvoice,
  previewInvoiceChange,
  restoreInvoice,
  updateInvoice,
} from './invoices-api.ts';
import { belowLowestPriceLines, type InvoiceInput } from './invoices-contracts.ts';

const TODAY = '2026-10-10';
const CONSULTATION = 'off_3f4nzxf53tfyf9k6hlna1';
const HYDRAFACIAL = 'off_hydra000000000000000';

/** A list page as the API answers it. */
const page = (
  data: unknown[],
  pagination: Record<string, unknown> = {},
  meta: Record<string, unknown> = {},
) => ({
  data,
  meta: {
    request_id: 'req',
    pagination: { per_page: 50, next: null, has_more: false, ...pagination },
    ...meta,
  },
});

/** One record as the API answers it. */
const one = (data: unknown) => ({ data, meta: { request_id: 'req' } });

/** Answer each GET by its path. */
function answer(byPath: Record<string, (query: Record<string, unknown>) => unknown>) {
  vi.mocked(api.get).mockImplementation(((path: string, init?: { query?: object }) => {
    const reply = byPath[path];
    if (!reply) throw new Error(`unexpected GET ${path}`);
    return Promise.resolve(reply((init?.query ?? {}) as Record<string, unknown>));
  }) as never);
}

/** Every query a GET to `path` was sent with. */
const queriesOf = (path: string) =>
  vi
    .mocked(api.get)
    .mock.calls.filter(([called]) => called === path)
    .map(([, init]) => (init as { query?: Record<string, unknown> } | undefined)?.query);

/** The clinic and the Adajan branch, as the sheet reads them. */
const SHEET_ANSWERS = {
  '/tenancy/organization': () =>
    one({ name: 'Glow Clinic', specialties: ['skin'], currency: 'INR' }),
  '/app/branches/my': () =>
    page([
      {
        id: TEST_MONEY_BRANCH_ID,
        name: 'Adajan',
        phone: '+912612345678',
        gst_number: '24ABCDE1234F1Z5',
        address_line_one: '12 Ring Road',
        address_line_two: null,
        area: 'Adajan',
        city: 'Surat',
        state: 'Gujarat',
        postal_code: '395009',
      },
    ]),
};

/** What the drawer holds for invoice #5, as an input. */
const invoiceInput = (patch: Partial<InvoiceInput> = {}): InvoiceInput => ({
  type: 'consultation',
  branchId: TEST_MONEY_BRANCH_ID,
  contactId: TEST_MONEY_CONTACT_ID,
  teamIds: [],
  items: [
    {
      id: 'iitm_7ocmisga5mzisg1w1uok1',
      offeringId: CONSULTATION,
      qty: 1,
      discountPct: 0,
      suggestionId: null,
      treatmentIds: [],
    },
  ],
  overallDiscount: 0,
  date: '2026-10-10',
  remark: 'Paid at the desk',
  prescriptionId: null,
  paidNow: [],
  ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
  queryClient.clear();
  signInTestMember();
  vi.mocked(fetchTeamDirectory).mockResolvedValue([]);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(appInstant(TODAY, '10:00')));
});
afterEach(() => {
  vi.useRealTimers();
  useOrganizationStore.getState().clearOrganization();
});

describe('the lists', () => {
  it('reads a person’s page with what is due and paid over all of them', async () => {
    answer({
      '/app/invoices': () =>
        page(
          [invoiceWire()],
          { next: 'cur_2', has_more: true, estimated_total: 5 },
          { due_total: 14289.95, paid_total: 4004 },
        ),
    });

    const result = await listInvoices({ patientId: TEST_MONEY_PATIENT_ID }, 'cur_1');

    expect(queriesOf('/app/invoices')[0]).toEqual({
      patient_id: TEST_MONEY_PATIENT_ID,
      contact_id: undefined,
      payment_status: undefined,
      sort: undefined,
      order: undefined,
      limit: 50,
      after: 'cur_1',
    });
    expect(result).toEqual({
      rows: [invoiceRecord()],
      next: 'cur_2',
      total: 5,
      totals: { due: 14289.95, paid: 4004 },
    });
  });

  it('reads a patient’s invoices with a due oldest first, and the totals in one row', async () => {
    answer({
      '/app/invoices': () =>
        page([invoiceWire()], {}, { due_total: 100, paid_total: 400 }),
    });

    expect(await listOpenInvoices(TEST_MONEY_PATIENT_ID)).toEqual([invoiceRecord()]);
    expect(queriesOf('/app/invoices')[0]).toMatchObject({
      patient_id: TEST_MONEY_PATIENT_ID,
      payment_status: 'unpaid,partial',
      sort: 'invoice_date',
      order: 'asc',
      limit: 100,
    });

    expect(await fetchInvoiceTotals({ contactId: TEST_MONEY_CONTACT_ID })).toEqual({
      due: 100,
      paid: 400,
    });
    expect(queriesOf('/app/invoices')[1]).toMatchObject({
      contact_id: TEST_MONEY_CONTACT_ID,
      limit: 1,
    });

    answer({ '/app/invoices': () => page([]) });
    expect(await fetchInvoiceTotals({ patientId: TEST_MONEY_PATIENT_ID })).toBeNull();
  });

  it('counts a person’s invoices with their totals, from the same one-row read', async () => {
    answer({
      '/app/invoices': () =>
        page(
          [invoiceWire()],
          { has_more: true, estimated_total: 4 },
          { due_total: 4800, paid_total: 1200 },
        ),
    });

    expect(await fetchInvoiceTotals({ patientId: TEST_MONEY_PATIENT_ID })).toEqual({
      due: 4800,
      paid: 1200,
      count: 4,
    });
  });

  it('reads one day’s open invoices at the header’s branches (Today’s checkout)', async () => {
    answer({ '/app/invoices': () => page([invoiceWire()]) });

    expect(
      await fetchAllInvoices({
        status: ['unpaid', 'partial'],
        branchIds: [TEST_MONEY_BRANCH_ID, 'brn_thsaog1i8bv6m9rd9ucoy'],
        day: TODAY,
      }),
    ).toEqual([invoiceRecord()]);
    expect(queriesOf('/app/invoices')[0]).toMatchObject({
      payment_status: 'unpaid,partial',
      branch_id: `${TEST_MONEY_BRANCH_ID},brn_thsaog1i8bv6m9rd9ucoy`,
      invoice_date_from: TODAY,
      invoice_date_to: TODAY,
      limit: 100,
    });
  });
});

describe('fetchInvoice', () => {
  it('reads the invoice with its ledger entries and the sheet’s clinic and branch, once', async () => {
    answer({
      '/app/invoices/{invoice_id}': () => one(invoiceWire()),
      '/app/payments': () => page([paymentWire()]),
      ...SHEET_ANSWERS,
    });

    const detail = await fetchInvoice(TEST_INVOICE_ID);
    await fetchInvoice(TEST_INVOICE_ID);

    expect(detail.invoice).toEqual(invoiceRecord());
    expect(detail.party).toEqual({
      contactId: TEST_MONEY_CONTACT_ID,
      patientId: TEST_MONEY_PATIENT_ID,
      name: 'Kavya Mehta',
      phone: '+919825005865',
    });
    expect(detail.payments.map((row) => row.seq)).toEqual([5]);
    expect(queriesOf('/app/payments')[0]).toMatchObject({ invoice_id: TEST_INVOICE_ID });
    expect(detail.sheet).toEqual({
      organization: { name: 'Glow Clinic', specialties: ['skin'], currency: 'INR' },
      branch: {
        id: TEST_MONEY_BRANCH_ID,
        name: 'Adajan',
        phone: '+912612345678',
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
    });
    expect(queriesOf('/tenancy/organization')).toHaveLength(1);
    expect(queriesOf('/app/branches/my')).toHaveLength(1);
  });
});

describe('fetchInvoicePresets', () => {
  it('reads the packages with sessions left, the last invoice of each type and its team', async () => {
    answer({
      '/app/patients/{patient_id}/offerings': () =>
        page([
          {
            id: 'pof_peel0000000000000000',
            offering_id: HYDRAFACIAL,
            offering_name: 'Hydrafacial',
            sessions_total: 6,
            sessions_used: 2,
            sessions_left: 4,
            is_package: true,
            status: 'active',
            valid_until: null,
            invoice_id: TEST_INVOICE_ID,
            created_at: '2026-10-01T05:00:00.000Z',
            updated_at: '2026-10-01T05:00:00.000Z',
          },
        ]),
      '/app/invoices': (query) =>
        query.type === 'clinic'
          ? page([
              invoiceWire({
                id: 'invc_clinic0000000000000',
                invoice_sequence: 4,
                type: 'clinic',
                member_ids: ['mem_therapist000000000000'],
              }),
            ])
          : page([invoiceWire({ member_ids: ['mem_doctor0000000000000000'] })]),
    });

    const presets = await fetchInvoicePresets(TEST_MONEY_PATIENT_ID);

    expect(presets.packages).toEqual([{ offeringId: HYDRAFACIAL }]);
    expect(presets.lastByType.clinic).toMatchObject({ seq: 4, type: 'clinic' });
    expect(presets.lastByType.consultation).toMatchObject({ seq: 5 });
    expect(presets.recentTeamIds).toEqual(['mem_doctor0000000000000000']);
    expect(queriesOf('/app/invoices')).toEqual([
      { patient_id: TEST_MONEY_PATIENT_ID, type: 'clinic', limit: 1 },
      { patient_id: TEST_MONEY_PATIENT_ID, type: 'consultation', limit: 1 },
    ]);
  });
});

/** The preview as the API answers it. */
const previewWire = {
  type: 'clinic',
  invoice_date: TODAY,
  items: [
    {
      id: null,
      line_number: 1,
      offering_id: HYDRAFACIAL,
      medicine_id: null,
      name: 'Hydrafacial',
      pack_size: null,
      hsn_code: null,
      quantity: 1,
      rate: 3500,
      discount_percent: 0,
      discount_amount: 0,
      gst_percent: 18,
      is_gst_inclusive: false,
      taxable_amount: 3500,
      gst_amount: 630,
      amount: 4130,
      patient_offering_suggestion_id: null,
      batch_number: null,
      offer_ids: ['ofr_diwali00000000000000'],
      sessions_total: null,
    },
  ],
  overall_discount: 0,
  subtotal: 3500,
  discount_total: 0,
  taxable_total: 3500,
  gst_total: 630,
  total: 4130,
  paid_amount: 0,
  refunded_amount: 0,
  due_amount: 4130,
};

describe('the previews', () => {
  it('previews a bill — no "Paid now", the person once picked — as the server prices it', async () => {
    vi.mocked(api.post).mockResolvedValue(one(previewWire) as never);
    const input = invoiceInput({
      type: 'clinic',
      contactId: null,
      items: [
        {
          id: null,
          offeringId: HYDRAFACIAL,
          qty: 1,
          discountPct: 12.345,
          suggestionId: null,
          treatmentIds: [],
        },
      ],
      paidNow: [{ mode: 'cash', amount: 100 }],
    });

    const preview = await previewInvoice(input);

    expect(api.post).toHaveBeenCalledWith('/app/invoices/preview', {
      body: {
        branch_id: TEST_MONEY_BRANCH_ID,
        type: 'clinic',
        invoice_date: '2026-10-10',
        member_ids: [],
        items: [
          {
            offering_id: HYDRAFACIAL,
            quantity: 1,
            discount_percent: 12.35,
            patient_offering_suggestion_id: null,
            patient_treatment_ids: [],
          },
        ],
        overall_discount: 0,
        remark: 'Paid at the desk',
        patient_prescription_id: null,
      },
    });
    expect(preview).toMatchObject({
      total: 4130,
      due: 4130,
      items: [{ id: null, rate: 3500, offerIds: ['ofr_diwali00000000000000'] }],
    });
  });

  it('previews a change with only what differs', async () => {
    vi.mocked(api.post).mockResolvedValue(one(previewWire) as never);

    await previewInvoiceChange({
      invoice: invoiceRecord(),
      input: invoiceInput({ overallDiscount: 50 }),
    });

    expect(api.post).toHaveBeenCalledWith('/app/invoices/{invoice_id}/preview', {
      params: { invoice_id: TEST_INVOICE_ID },
      body: { overall_discount: 50 },
    });
  });
});

describe('the writes', () => {
  it('bills with the lines by offering, the discount to two places and "Paid now"', async () => {
    answer({ '/app/payments': () => page([]), ...SHEET_ANSWERS });
    vi.mocked(api.post).mockResolvedValue(
      one(
        invoiceWire({
          items: [
            {
              ...invoiceWire().items[0],
              patient_offering_suggestion_id: 'psug_peel00000000000000000',
            },
          ],
        }),
      ) as never,
    );

    const result = await createInvoice({
      input: invoiceInput({
        items: [
          {
            id: null,
            offeringId: CONSULTATION,
            qty: 1,
            discountPct: 0,
            suggestionId: 'psug_peel00000000000000000',
            treatmentIds: ['ptrt_peel0000000000000000'],
          },
        ],
        paidNow: [{ mode: 'upi', amount: 400 }],
      }),
      idempotencyKey: 'key-bill',
    });

    expect(api.post).toHaveBeenCalledWith('/app/invoices', {
      body: {
        branch_id: TEST_MONEY_BRANCH_ID,
        contact_id: TEST_MONEY_CONTACT_ID,
        type: 'consultation',
        invoice_date: '2026-10-10',
        member_ids: [],
        items: [
          {
            offering_id: CONSULTATION,
            quantity: 1,
            discount_percent: 0,
            patient_offering_suggestion_id: 'psug_peel00000000000000000',
            patient_treatment_ids: ['ptrt_peel0000000000000000'],
          },
        ],
        overall_discount: 0,
        remark: 'Paid at the desk',
        patient_prescription_id: null,
        payment: { splits: [{ mode: 'upi', amount: 400 }] },
      },
      idempotencyKey: 'key-bill',
    });
    expect(result.planLinked).toBe(1);
    expect(result.detail.invoice.seq).toBe(5);
  });

  it('changes only what differs — every line, the kept ones by id, when one moved', async () => {
    answer({ '/app/payments': () => page([]), ...SHEET_ANSWERS });
    vi.mocked(api.patch).mockResolvedValue(one(invoiceWire()) as never);
    const invoice = invoiceRecord();

    await updateInvoice({
      invoice,
      input: invoiceInput({
        teamIds: ['mem_doctor0000000000000000'],
        items: [
          {
            id: 'iitm_7ocmisga5mzisg1w1uok1',
            offeringId: CONSULTATION,
            qty: 2,
            discountPct: 0,
            suggestionId: null,
            treatmentIds: [],
          },
          {
            id: null,
            offeringId: HYDRAFACIAL,
            qty: 1,
            discountPct: 10,
            suggestionId: null,
            treatmentIds: [],
          },
        ],
        remark: ' ',
      }),
      idempotencyKey: 'key-change',
    });

    expect(api.patch).toHaveBeenCalledWith('/app/invoices/{invoice_id}', {
      params: { invoice_id: TEST_INVOICE_ID },
      body: {
        member_ids: ['mem_doctor0000000000000000'],
        items: [
          {
            id: 'iitm_7ocmisga5mzisg1w1uok1',
            offering_id: CONSULTATION,
            quantity: 2,
            discount_percent: 0,
            patient_offering_suggestion_id: null,
            patient_treatment_ids: [],
          },
          {
            offering_id: HYDRAFACIAL,
            quantity: 1,
            discount_percent: 10,
            patient_offering_suggestion_id: null,
            patient_treatment_ids: [],
          },
        ],
        remark: null,
        expected_updated_at: invoice.updatedAt,
      },
      idempotencyKey: 'key-change',
    });
  });

  it('sends nothing when nothing changed', async () => {
    answer({ '/app/payments': () => page([]), ...SHEET_ANSWERS });

    const result = await updateInvoice({
      invoice: invoiceRecord(),
      input: invoiceInput(),
      idempotencyKey: 'key-none',
    });

    expect(api.patch).not.toHaveBeenCalled();
    expect(result.detail.invoice).toEqual(invoiceRecord());
  });

  it('deletes with the reason and note, restores with the action’s key', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: undefined } as never);
    vi.mocked(api.post).mockResolvedValue(one(invoiceWire()) as never);

    await deleteInvoice({
      invoiceId: TEST_INVOICE_ID,
      reason: 'mistake',
      note: 'Billed twice',
    });
    expect(api.delete).toHaveBeenCalledWith('/app/invoices/{invoice_id}', {
      params: { invoice_id: TEST_INVOICE_ID },
      reason: 'mistake',
      note: 'Billed twice',
    });

    expect(await restoreInvoice(TEST_INVOICE_ID, 'key-restore')).toEqual(invoiceRecord());
    expect(api.post).toHaveBeenCalledWith('/app/invoices/{invoice_id}/restore', {
      params: { invoice_id: TEST_INVOICE_ID },
      idempotencyKey: 'key-restore',
    });
  });
});

describe('belowLowestPriceLines', () => {
  const refusal = (reason: string, fields: string[]) =>
    new HttpError('Bad Request', 400, '/api/v1/app/invoices', 'POST', {
      error: {
        reason,
        errors: fields.map((field) => ({ field, message: 'Below its lowest price' })),
      },
    });

  it('names the lines a bill was refused for, by index', () => {
    expect(
      belowLowestPriceLines(refusal('below_lowest_price', ['items/0', 'body.items/2'])),
    ).toEqual([0, 2]);
  });

  it('is empty for any other refusal', () => {
    expect(belowLowestPriceLines(refusal('validation_failed', ['items/0']))).toEqual([]);
    expect(belowLowestPriceLines(new Error('offline'))).toEqual([]);
  });
});
