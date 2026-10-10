import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';
import {
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';

import { searchPatientPicker } from './patient-search-api.ts';

/** A contact row of `GET /app/contacts` — Kavya Mehta, patient #2. */
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

/** A page of contacts as the API answers it. */
const page = (data: unknown[], next: string | null = null) => ({
  data,
  meta: {
    request_id: 'req',
    pagination: { per_page: 30, next, has_more: next !== null },
  },
});

/** The query the contacts read was sent with (the last one). */
const lastQuery = () =>
  (
    vi.mocked(api.get).mock.lastCall?.[1] as
      { query?: Record<string, unknown> } | undefined
  )?.query;

beforeEach(() => vi.resetAllMocks());

describe('searchPatientPicker', () => {
  it('lists the patients A–Z for an empty search, a page at a time', async () => {
    vi.mocked(api.get).mockResolvedValue(page([contactRow()], 'cur_2') as never);

    const result = await searchPatientPicker('', 'cur_1');

    expect(api.get).toHaveBeenCalledWith('/app/contacts', {
      query: {
        is_patient: 'true',
        q: undefined,
        sort: 'name',
        order: 'asc',
        limit: 30,
        after: 'cur_1',
      },
    });
    expect(result).toEqual({
      items: [
        {
          kind: 'patient',
          id: TEST_MONEY_PATIENT_ID,
          contactId: TEST_MONEY_CONTACT_ID,
          seq: 2,
          name: 'Kavya Mehta',
          phone: '+919825005865',
          due: null,
        },
      ],
      nextCursor: 'cur_2',
    });
  });

  it('searches by name, number or contact number, best match first', async () => {
    vi.mocked(api.get).mockResolvedValue(page([contactRow()]) as never);

    await searchPatientPicker(' Kavya ');
    expect(lastQuery()).toMatchObject({ q: 'Kavya', sort: undefined, order: undefined });
    await searchPatientPicker('C-1188');
    expect(lastQuery()).toMatchObject({ q: 'C-1188' });
  });

  it('finds nothing for a search too short to send, unasked', async () => {
    expect(await searchPatientPicker('Ka')).toEqual({ items: [], nextCursor: null });
    expect(api.get).not.toHaveBeenCalled();
  });

  it('keeps out a contact the answer carries without a patient file', async () => {
    vi.mocked(api.get).mockResolvedValue(
      page([contactRow({ patient_id: null, patient_number: null })]) as never,
    );
    expect((await searchPatientPicker('Kavya')).items).toEqual([]);
  });
});
