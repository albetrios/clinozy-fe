import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
}));
import { api } from '@/core/http/api.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { fetchTeamDirectory } from '@/shared/api/clinic/directory-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import {
  creditRow,
  creditWire,
  paymentWire,
  TEST_CREDIT_ID,
  TEST_INVOICE_ID,
  TEST_MONEY_AUTHOR_ID,
  TEST_MONEY_BRANCH_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  createCredit,
  creditListQuery,
  deleteCredit,
  fetchCredit,
  listPendingCredits,
  restoreCredit,
  searchCreditParties,
  settleCredit,
  updateCredit,
} from './credits-api.ts';
import type { CreditInput } from './credits-contracts.ts';

const TODAY = '2026-10-10';

/** A list page as the API answers it. */
const page = (data: unknown[], pagination: Record<string, unknown> = {}) => ({
  data,
  meta: {
    request_id: 'req',
    pagination: { per_page: 50, next: null, has_more: false, ...pagination },
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

/** The query a GET to `path` was sent with (the last one). */
function queryOf(path: string) {
  const call = vi
    .mocked(api.get)
    .mock.calls.filter(([called]) => called === path)
    .at(-1);
  return (call?.[1] as { query?: Record<string, unknown> } | undefined)?.query;
}

/** A contact row of `GET /app/contacts`. */
const contactRow = (patch: Record<string, unknown> = {}) => ({
  id: TEST_MONEY_CONTACT_ID,
  contact_number: 1188,
  first_name: 'Kavya',
  last_name: 'Mehta',
  primary_phone: '+919825005865',
  email: null,
  instagram_handles: [],
  default_channel: 'whatsapp',
  preference_tags: [],
  patient_id: TEST_MONEY_PATIENT_ID,
  open_lead_id: null,
  last_activity_at: null,
  last_received_at: null,
  is_awaiting_reply: false,
  updated_at: '2026-10-01T07:00:00.000Z',
  gender: null,
  date_of_birth: null,
  address: null,
  referral_source: null,
  referred_by_contact_id: null,
  referred_by_name: null,
  has_marketing_consent: false,
  patient_number: 2,
  ...patch,
});

/** What Add pending holds for CR-1, as an input. */
const creditInput = (patch: Partial<CreditInput> = {}): CreditInput => ({
  direction: 'give',
  contactId: TEST_MONEY_CONTACT_ID,
  partyName: 'Kavya Mehta',
  amount: 80,
  reasonKey: 'overpaid',
  invoiceId: TEST_INVOICE_ID,
  settleBy: '2026-10-20',
  note: 'Paid twice at the desk',
  ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
  queryClient.clear();
  signInTestMember();
  vi.mocked(fetchTeamDirectory).mockResolvedValue([
    {
      id: TEST_MONEY_AUTHOR_ID,
      userId: 'usr_nisha',
      name: 'Nisha Shah',
      initials: 'NS',
      tone: 'sage',
      roleIds: [],
      branchIds: [],
    },
  ]);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:00')));
});
afterEach(() => {
  vi.useRealTimers();
  useOrganizationStore.getState().clearOrganization();
});

describe('the Pending reads', () => {
  it('sends one way (both is none), the states, the search and Created', () => {
    expect(
      creditListQuery(
        { direction: ['give'], status: ['open', 'used'], q: ' Kavya ', created: 'today' },
        TODAY,
      ),
    ).toEqual({
      limit: 50,
      direction: 'give',
      status: 'open,used',
      q: 'Kavya',
      contact_id: undefined,
      invoice_id: undefined,
      created_from: clinicInstant(TODAY, '00:00'),
      created_to: clinicInstant('2026-10-11', '00:00'),
    });
    expect(
      creditListQuery({ direction: ['give', 'take'] }, TODAY).direction,
    ).toBeUndefined();
  });

  it('reads a page and one credit, each with who added it', async () => {
    answer({
      '/app/pending-credits': () => page([creditWire()], { estimated_total: 1 }),
      '/app/pending-credits/{pending_credit_id}': () => one(creditWire()),
    });

    expect(await listPendingCredits({})).toEqual({
      rows: [creditRow()],
      next: null,
      total: 1,
    });
    expect(await fetchCredit(TEST_CREDIT_ID)).toEqual(creditRow());
  });

  it('reads a supplier’s credit by name, an "Other" reason as its text, a settled one’s day', async () => {
    answer({
      '/app/pending-credits/{pending_credit_id}': () =>
        one(
          creditWire({
            contact: null,
            patient_id: null,
            party_name: 'Ankur Pharma',
            reason: 'Returned two cartons',
            status: 'got_back',
            updated_at: '2026-10-11T05:00:00.000Z',
          }),
        ),
    });

    expect(await fetchCredit(TEST_CREDIT_ID)).toMatchObject({
      contactId: null,
      partyName: 'Ankur Pharma',
      reasonKey: 'other',
      reason: 'Returned two cartons',
      settledAt: '2026-10-11T05:00:00.000Z',
    });
  });
});

describe('searchCreditParties', () => {
  it('finds the people, then on their last page the stock vendors and Medical suppliers', async () => {
    answer({
      '/app/contacts': () =>
        page([
          contactRow(),
          contactRow({
            id: 'con_viral000000000000000000',
            patient_id: null,
            first_name: 'Viral',
          }),
        ]),
      '/app/stock-vendors': () =>
        page([{ id: 'svnd_ankur0000000000000000', name: 'Ankur Pharma' }]),
      '/app/suppliers': () =>
        page([
          { id: 'sup_ankur00000000000000000', name: 'ankur pharma' },
          { id: 'sup_ramdev000000000000000', name: 'Shree Ramdev' },
        ]),
    });

    const result = await searchCreditParties(' Kav ');

    expect(queryOf('/app/contacts')).toMatchObject({ q: 'Kav', limit: 30 });
    expect(queryOf('/app/suppliers')).toMatchObject({ q: 'Kav', limit: 10 });
    expect(result).toEqual({
      items: [
        {
          kind: 'patient',
          contactId: TEST_MONEY_CONTACT_ID,
          patientId: TEST_MONEY_PATIENT_ID,
          seq: 2,
          name: 'Kavya Mehta',
          phone: '+919825005865',
        },
        {
          kind: 'contact',
          contactId: 'con_viral000000000000000000',
          name: 'Viral Mehta',
          phone: '+919825005865',
        },
        { kind: 'vendor', id: 'svnd_ankur0000000000000000', name: 'Ankur Pharma' },
        { kind: 'supplier', id: 'sup_ramdev000000000000000', name: 'Shree Ramdev' },
      ],
      nextCursor: null,
    });
  });

  it('lists everyone by name for an empty search, suppliers on the last page only', async () => {
    answer({
      '/app/contacts': () => page([contactRow()], { next: 'cur_2', has_more: true }),
    });

    const result = await searchCreditParties('');

    expect(queryOf('/app/contacts')).toMatchObject({ q: undefined, sort: 'name' });
    expect(result.nextCursor).toBe('cur_2');
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('skips a list the member may not read, and asks no person for two letters', async () => {
    vi.mocked(api.get).mockImplementation(((path: string) => {
      if (path === '/app/suppliers') {
        return Promise.reject(new HttpError('Forbidden', 403, path, 'GET'));
      }
      return Promise.resolve(
        page(
          path === '/app/stock-vendors'
            ? [{ id: 'svnd_x0000000000000000000', name: 'Ka' }]
            : [],
        ),
      );
    }) as never);

    expect((await searchCreditParties('Ka')).items).toEqual([
      { kind: 'vendor', id: 'svnd_x0000000000000000000', name: 'Ka' },
    ]);
    expect(queryOf('/app/contacts')).toBeUndefined();
  });
});

describe('the writes', () => {
  it('adds a credit: the chip’s key as the reason, the contact — or a supplier by name', async () => {
    vi.mocked(api.post).mockResolvedValue(one(creditWire()) as never);

    expect(
      await createCredit({ input: creditInput(), idempotencyKey: 'key-add' }),
    ).toEqual(creditRow());
    expect(api.post).toHaveBeenCalledWith('/app/pending-credits', {
      body: {
        direction: 'give',
        amount: 80,
        reason: 'overpaid',
        contact_id: TEST_MONEY_CONTACT_ID,
        invoice_id: TEST_INVOICE_ID,
        settle_by: '2026-10-20',
        note: 'Paid twice at the desk',
      },
      idempotencyKey: 'key-add',
    });

    await createCredit({
      input: creditInput({
        direction: 'take',
        contactId: null,
        partyName: ' Ankur Pharma ',
        reasonKey: 'other',
        invoiceId: null,
        settleBy: null,
        note: ' Returned two cartons ',
      }),
      idempotencyKey: 'key-supplier',
    });
    expect(vi.mocked(api.post).mock.calls.at(-1)?.[1]).toEqual({
      body: {
        direction: 'take',
        amount: 80,
        reason: 'Returned two cartons',
        party_name: 'Ankur Pharma',
        invoice_id: null,
        settle_by: null,
        note: 'Returned two cartons',
      },
      idempotencyKey: 'key-supplier',
    });
  });

  it('changes only what differs with the read’s updated_at; nothing changed sends nothing', async () => {
    vi.mocked(api.patch).mockResolvedValue(one(creditWire()) as never);
    const credit = creditRow();

    expect(
      await updateCredit({ credit, input: creditInput(), idempotencyKey: 'key-none' }),
    ).toBe(credit);
    expect(api.patch).not.toHaveBeenCalled();

    await updateCredit({
      credit,
      input: creditInput({ amount: 90, reasonKey: 'charged_twice', note: null }),
      idempotencyKey: 'key-edit',
    });
    expect(api.patch).toHaveBeenCalledWith('/app/pending-credits/{pending_credit_id}', {
      params: { pending_credit_id: TEST_CREDIT_ID },
      body: {
        amount: 90,
        reason: 'charged_twice',
        note: null,
        expected_updated_at: credit.updatedAt,
      },
      idempotencyKey: 'key-edit',
    });
  });

  it('deletes with the reason, restores with the action’s key', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: undefined } as never);
    vi.mocked(api.post).mockResolvedValue(one(creditWire()) as never);

    await deleteCredit({ creditId: TEST_CREDIT_ID, reason: 'duplicate', note: null });
    expect(api.delete).toHaveBeenCalledWith('/app/pending-credits/{pending_credit_id}', {
      params: { pending_credit_id: TEST_CREDIT_ID },
      reason: 'duplicate',
      note: undefined,
    });
    await restoreCredit(TEST_CREDIT_ID, 'key-restore');
    expect(api.post).toHaveBeenCalledWith(
      '/app/pending-credits/{pending_credit_id}/restore',
      {
        params: { pending_credit_id: TEST_CREDIT_ID },
        idempotencyKey: 'key-restore',
      },
    );
  });

  it('gives money back at a branch — the amount the splits’ sum — then reads the entry for the toast', async () => {
    vi.mocked(api.post).mockResolvedValue(
      one(
        creditWire({
          settled_amount: 80,
          left_amount: 0,
          status: 'given_back',
          payment_ids: ['pay_92c7hxmos9ecucof9tzhg', 'pay_refund0000000000000000'],
        }),
      ) as never,
    );
    answer({
      '/app/payments/{payment_id}': () =>
        one(
          paymentWire({
            id: 'pay_refund0000000000000000',
            payment_number: 7,
            direction: 'paid',
            kind: 'refund',
            invoice_credit_note_number: 3,
          }),
        ),
    });

    const result = await settleCredit({
      credit: creditRow(),
      settlement: {
        action: 'give_back',
        branchId: TEST_MONEY_BRANCH_ID,
        splits: [
          { mode: 'cash', amount: 10.1 },
          { mode: 'upi', amount: 19.9 },
        ],
      },
      idempotencyKey: 'key-settle',
    });

    expect(api.post).toHaveBeenCalledWith(
      '/app/pending-credits/{pending_credit_id}/settle',
      {
        params: { pending_credit_id: TEST_CREDIT_ID },
        body: {
          method: 'money',
          amount: 30,
          branch_id: TEST_MONEY_BRANCH_ID,
          splits: [
            { mode: 'cash', amount: 10.1 },
            { mode: 'upi', amount: 19.9 },
          ],
        },
        idempotencyKey: 'key-settle',
      },
    );
    expect(result).toMatchObject({
      amount: 30,
      paymentSeq: 7,
      creditNoteSeq: 3,
      invoiceSeq: 5,
      credit: { status: 'given_back', left: 0 },
    });
  });

  it('keeps a written settlement when the read of its entry fails — the toast just has no numbers', async () => {
    vi.mocked(api.post).mockResolvedValue(
      one(
        creditWire({
          settled_amount: 80,
          left_amount: 0,
          status: 'given_back',
          payment_ids: ['pay_92c7hxmos9ecucof9tzhg', 'pay_refund0000000000000000'],
        }),
      ) as never,
    );
    vi.mocked(api.get).mockRejectedValue(
      new HttpError('Server error', 500, '/app/payments/{payment_id}', 'GET'),
    );

    const result = await settleCredit({
      credit: creditRow(),
      settlement: {
        action: 'give_back',
        branchId: TEST_MONEY_BRANCH_ID,
        splits: [{ mode: 'cash', amount: 30 }],
      },
      idempotencyKey: 'key-settle',
    });

    expect(result).toMatchObject({
      amount: 30,
      paymentSeq: null,
      creditNoteSeq: null,
      credit: { status: 'given_back' },
    });
  });

  it('uses a credit on a bill with the invoice and amount only — no branch, splits or day', async () => {
    vi.mocked(api.post).mockResolvedValue(
      one(creditWire({ settled_amount: 80, left_amount: 0, status: 'used' })) as never,
    );

    const result = await settleCredit({
      credit: creditRow(),
      settlement: { action: 'use_on_bill', invoiceId: TEST_INVOICE_ID, amount: 30 },
      idempotencyKey: 'key-use',
    });

    expect(vi.mocked(api.post).mock.calls[0]?.[1]).toEqual({
      params: { pending_credit_id: TEST_CREDIT_ID },
      body: { method: 'use_on_bill', amount: 30, invoice_id: TEST_INVOICE_ID },
      idempotencyKey: 'key-use',
    });
    expect(result).toMatchObject({ amount: 30, paymentSeq: null });
    expect(api.get).not.toHaveBeenCalled();
  });
});
