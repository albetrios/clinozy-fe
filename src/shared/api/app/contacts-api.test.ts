import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';

import {
  createContact,
  fetchContact,
  fetchContactsByIds,
  fetchRecentContacts,
  findContactByPhone,
  isContactSearchable,
  searchContacts,
  updateContact,
} from './contacts-api.ts';

const CONTACT_ID = 'con_anaya0000000000000000';
const LEAD_ID = 'lead_anaya0000000000000000';

/** A contact list row as clinozy-be answers it — the primary number only. */
const contactRow = (patch: Record<string, unknown> = {}) => ({
  id: CONTACT_ID,
  contact_number: 10234,
  first_name: 'Anaya',
  last_name: 'Desai',
  primary_phone: '+919879521034',
  email: 'anaya@example.test',
  instagram_handles: ['anaya.d'],
  default_channel: 'whatsapp',
  preference_tags: ['no_calls', 'gujarati'],
  patient_id: null,
  open_lead_id: LEAD_ID,
  last_activity_at: '2026-10-02T04:30:00.000Z',
  last_received_at: '2026-10-02T04:00:00.000Z',
  is_awaiting_reply: true,
  updated_at: '2026-10-02T04:30:00.000Z',
  gender: 'female',
  date_of_birth: '1994-03-12',
  address: null,
  referral_source: 'instagram',
  referred_by_contact_id: null,
  referred_by_name: null,
  has_marketing_consent: false,
  patient_number: null,
  ...patch,
});

/** One contact as clinozy-be answers it — with every number. */
const contactWithPhones = (patch: Record<string, unknown> = {}) => ({
  ...contactRow(),
  phones: [
    { phone: '+919879521034', is_primary: true, is_on_whatsapp: true },
    { phone: '+919879521035', is_primary: false, is_on_whatsapp: false },
  ],
  ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchContact', () => {
  it('reads one person with every number', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: contactWithPhones() } as never);

    const contact = await fetchContact(CONTACT_ID);

    expect(api.get).toHaveBeenCalledWith('/app/contacts/{contact_id}', {
      params: { contact_id: CONTACT_ID },
    });
    expect(contact).toEqual({
      id: CONTACT_ID,
      contactNumber: 10234,
      firstName: 'Anaya',
      lastName: 'Desai',
      name: 'Anaya Desai',
      primaryPhone: '+919879521034',
      email: 'anaya@example.test',
      instagramHandles: ['anaya.d'],
      defaultChannel: 'whatsapp',
      preferenceTags: ['no_calls', 'gujarati'],
      patientId: null,
      openLeadId: LEAD_ID,
      lastActivityAt: '2026-10-02T04:30:00.000Z',
      lastReceivedAt: '2026-10-02T04:00:00.000Z',
      isAwaitingReply: true,
      updatedAt: '2026-10-02T04:30:00.000Z',
      gender: 'female',
      dateOfBirth: '1994-03-12',
      address: null,
      referralSource: 'instagram',
      referredByContactId: null,
      referredByName: null,
      hasMarketingConsent: false,
      patientNumber: null,
      phones: [
        { phone: '+919879521034', isPrimary: true, isOnWhatsapp: true },
        { phone: '+919879521035', isPrimary: false, isOnWhatsapp: false },
      ],
    });
  });

  it('names a person without a last name by their first', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: contactWithPhones({ last_name: null }),
    } as never);
    expect((await fetchContact(CONTACT_ID)).name).toBe('Anaya');
  });
});

describe('isContactSearchable — what the API takes as a search (CT9)', () => {
  it('takes text from 3 characters and a whole contact number at any length', () => {
    expect(['ana', '  anaya ', 'C-12', 'c7', '#45'].map(isContactSearchable)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(['an', ' a '].map(isContactSearchable)).toEqual([false, false]);
  });

  it('takes a typed number only from 4 digits of its own — a +91 prefix is not its own', () => {
    expect(['9879', '98 79', '(98) 7-9'].map(isContactSearchable)).toEqual([
      true,
      true,
      true,
    ]);
    expect(['987', '98 7', '+91 98', '+919'].map(isContactSearchable)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('searchContacts', () => {
  it.each(['', '  ', 'an', ' an ', '98'])(
    'asks nothing for "%s" — under 3 letters and 4 digits',
    async (typed) => {
      expect(await searchContacts(typed)).toEqual([]);
      expect(api.get).not.toHaveBeenCalled();
    },
  );

  it('searches from 3 letters, trimmed, at most 8 people', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [contactRow()] } as never);

    const hits = await searchContacts('  ana ');

    expect(api.get).toHaveBeenCalledWith('/app/contacts', {
      query: { q: 'ana', limit: 8 },
    });
    expect(hits).toEqual([
      expect.objectContaining({
        id: CONTACT_ID,
        name: 'Anaya Desai',
        openLeadId: LEAD_ID,
        patientId: null,
      }),
    ]);
    expect(hits[0]).not.toHaveProperty('phones');
  });

  it('searches from 4 digits of a number, however they are spaced', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] } as never);
    expect(await searchContacts('98 79')).toEqual([]);
    expect(api.get).toHaveBeenCalledWith('/app/contacts', {
      query: { q: '98 79', limit: 8 },
    });
  });

  it('reads an answer without rows as nobody', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: undefined } as never);
    expect(await searchContacts('anaya')).toEqual([]);
  });

  it('searches only patients for the patients scope, each with their file’s number', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [contactRow({ patient_id: 'pat_anaya00000000000000', patient_number: 3441 })],
    } as never);
    const hits = await searchContacts('anaya', 'patients');
    expect(api.get).toHaveBeenCalledWith('/app/contacts', {
      query: { q: 'anaya', limit: 8, is_patient: 'true' },
    });
    expect(hits).toEqual([
      expect.objectContaining({
        patientId: 'pat_anaya00000000000000',
        patientNumber: 3441,
      }),
    ]);
  });
});

describe('fetchRecentContacts', () => {
  it('reads the five people with the newest activity', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [contactRow()] } as never);
    const people = await fetchRecentContacts();
    expect(api.get).toHaveBeenCalledWith('/app/contacts', {
      query: { sort: 'last_activity_at', order: 'desc', limit: 5 },
    });
    expect(people).toEqual([
      expect.objectContaining({ id: CONTACT_ID, name: 'Anaya Desai' }),
    ]);
  });

  it('reads only patients for the patients scope', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] } as never);
    await fetchRecentContacts('patients');
    expect(api.get).toHaveBeenCalledWith('/app/contacts', {
      query: { sort: 'last_activity_at', order: 'desc', limit: 5, is_patient: 'true' },
    });
  });
});

describe('createContact', () => {
  it('creates a person the API’s way — the first number the primary — with the action’s key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: contactWithPhones({
        id: 'con_meera0000000000000000',
        contact_number: 10301,
        first_name: 'Meera',
        last_name: null,
        email: null,
        instagram_handles: [],
        preference_tags: [],
        open_lead_id: null,
        phones: [{ phone: '+919825011241', is_primary: true, is_on_whatsapp: true }],
      }),
    } as never);

    const created = await createContact({
      fields: {
        firstName: 'Meera',
        lastName: null,
        phones: [{ phone: '+919825011241', isOnWhatsapp: true }],
        instagramHandles: [],
        defaultChannel: 'whatsapp',
        preferenceTags: [],
      },
      idempotencyKey: 'key-new-contact',
    });

    expect(api.post).toHaveBeenCalledWith('/app/contacts', {
      body: {
        first_name: 'Meera',
        last_name: null,
        phones: [{ phone: '+919825011241', is_primary: true, is_on_whatsapp: true }],
        instagram_handles: [],
        default_channel: 'whatsapp',
        preference_tags: [],
      },
      idempotencyKey: 'key-new-contact',
    });
    expect(created).toMatchObject({
      id: 'con_meera0000000000000000',
      contactNumber: 10301,
      name: 'Meera',
      openLeadId: null,
      phones: [{ phone: '+919825011241', isPrimary: true, isOnWhatsapp: true }],
    });
  });
});

describe('updateContact', () => {
  it('sends the editor’s fields the API’s way, with the read’s updated_at and the key', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: contactWithPhones({ first_name: 'Anaya K' }),
    } as never);

    const saved = await updateContact({
      contactId: CONTACT_ID,
      fields: {
        firstName: 'Anaya K',
        lastName: 'Desai',
        phones: [
          { phone: '+919879521035', isOnWhatsapp: false },
          { phone: '+919879521034', isOnWhatsapp: true },
        ],
        instagramHandles: [],
        defaultChannel: 'call',
        preferenceTags: ['evenings'],
      },
      expectedUpdatedAt: '2026-10-02T04:30:00.000Z',
      idempotencyKey: 'key-contact',
    });

    expect(api.patch).toHaveBeenCalledWith('/app/contacts/{contact_id}', {
      params: { contact_id: CONTACT_ID },
      body: {
        first_name: 'Anaya K',
        last_name: 'Desai',
        phones: [
          { phone: '+919879521035', is_primary: true, is_on_whatsapp: false },
          { phone: '+919879521034', is_primary: false, is_on_whatsapp: true },
        ],
        instagram_handles: [],
        default_channel: 'call',
        preference_tags: ['evenings'],
        expected_updated_at: '2026-10-02T04:30:00.000Z',
      },
      idempotencyKey: 'key-contact',
    });
    expect(saved).toMatchObject({ firstName: 'Anaya K', name: 'Anaya K Desai' });
    expect(saved.phones).toHaveLength(2);
  });
});

describe('fetchContactsByIds', () => {
  it('reads each id once, 100 at most per call, keyed by id with the profile', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `con_${String(index).padStart(21, 'a')}`,
    );
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: [contactRow({ id: ids[0] })] } as never)
      .mockResolvedValueOnce({ data: [contactRow({ id: ids[100] })] } as never);

    const people = await fetchContactsByIds([...ids, ids[0] ?? '']);

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenNthCalledWith(1, '/app/contacts', {
      query: { ids: ids.slice(0, 100).join(','), limit: 100 },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/app/contacts', {
      query: { ids: ids[100], limit: 1 },
    });
    expect(people.get(ids[0] ?? '')).toMatchObject({
      name: 'Anaya Desai',
      gender: 'female',
      dateOfBirth: '1994-03-12',
    });
    expect(people.size).toBe(2);
  });
});

describe('findContactByPhone', () => {
  it('answers the person on a number, with their file number, or none', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: [contactRow({ patient_number: 3508 })] } as never)
      .mockResolvedValueOnce({ data: [] } as never);

    await expect(findContactByPhone('+919879521034')).resolves.toMatchObject({
      id: CONTACT_ID,
      patientNumber: 3508,
    });
    expect(api.get).toHaveBeenCalledWith('/app/contacts', {
      query: { phone: '+919879521034', limit: 1 },
    });
    await expect(findContactByPhone('+919800000000')).resolves.toBeNull();
  });
});
