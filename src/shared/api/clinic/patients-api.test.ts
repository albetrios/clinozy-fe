import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';

import { clinicInstant } from './clinic-time.ts';
import {
  createPatient,
  deletePatient,
  fetchPatient,
  listPatients,
  patientListQuery,
  restorePatient,
  updatePatient,
} from './patients-api.ts';
import type { PatientFields } from './patients-contracts.ts';

/** The clinic's day every range here is read on. */
const TODAY = '2026-10-03';
/** Midnight at the start of a clinic day, as the API's instant. */
const midnight = (date: string) => clinicInstant(date, '00:00');

const PATIENT_ID = 'pat_priya0000000000000000';
const CONTACT_ID = 'con_priya0000000000000000';
const BRANCH_ID = 'brn_main0000000000000000';

/** A patient as clinozy-be answers it. */
const patientWireRow = (patch: Record<string, unknown> = {}) => ({
  id: PATIENT_ID,
  patient_number: 3508,
  contact_id: CONTACT_ID,
  home_branch_id: BRANCH_ID,
  types: ['aesthetic'],
  status: 'new',
  conversion: 'not_converted',
  doctor_membership_id: null,
  follow_up_at: null,
  notes: null,
  lead_id: null,
  has_data_consent: true,
  has_photo_consent: false,
  allergies: [],
  contraindications: [],
  created_at: '2026-09-20T05:00:00.000Z',
  updated_at: '2026-10-01T08:00:00.000Z',
  ...patch,
});

/** The patient's person as `GET /app/contacts` answers a row. */
const contactWireRow = (patch: Record<string, unknown> = {}) => ({
  id: CONTACT_ID,
  contact_number: 1188,
  first_name: 'Priya',
  last_name: 'Shah',
  primary_phone: '+919876543210',
  email: null,
  instagram_handles: [],
  default_channel: 'whatsapp',
  preference_tags: [],
  patient_id: PATIENT_ID,
  open_lead_id: null,
  last_activity_at: null,
  last_received_at: null,
  is_awaiting_reply: false,
  updated_at: '2026-10-01T07:00:00.000Z',
  gender: 'female',
  date_of_birth: '1995-10-27',
  address: 'Adajan',
  referral_source: null,
  referred_by_contact_id: null,
  referred_by_name: null,
  has_marketing_consent: true,
  patient_number: 3508,
  ...patch,
});

/** The person with every number, as `GET /app/contacts/:contact_id` answers. */
const contactWithPhones = (patch: Record<string, unknown> = {}) => ({
  ...contactWireRow(),
  phones: [
    { phone: '+919876543210', is_primary: true, is_on_whatsapp: true },
    { phone: '+919876500000', is_primary: false, is_on_whatsapp: false },
  ],
  ...patch,
});

/** The drawer's fields for Priya, as read. */
const priyaFields = (patch: Partial<PatientFields> = {}): PatientFields => ({
  firstName: 'Priya',
  lastName: 'Shah',
  phone: '+919876543210',
  phone2: '+919876500000',
  gender: 'female',
  dateOfBirth: '1995-10-27',
  address: 'Adajan',
  referralSource: null,
  referredByName: null,
  homeBranchId: BRANCH_ID,
  types: ['aesthetic'],
  status: 'new',
  conversion: 'not_converted',
  followUpAt: null,
  notes: null,
  consents: ['data', 'marketing'],
  ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:00')));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('patientListQuery', () => {
  it('reads newest first, 50 a page, with nothing filtered', () => {
    expect(patientListQuery({ view: 'all' }, TODAY)).toEqual({
      limit: 50,
      q: undefined,
      types: undefined,
      status: undefined,
      conversion: undefined,
      created_from: undefined,
      created_to: undefined,
      follow_up_at_from: undefined,
      follow_up_at_to: undefined,
      sort: undefined,
      order: undefined,
    });
  });

  it('reads Follow-up due as every follow-up up to the end of today', () => {
    expect(patientListQuery({ view: 'follow' }, TODAY)).toMatchObject({
      follow_up_at_to: midnight('2026-10-04'),
    });
  });

  it('reads Recall as the inactive patients', () => {
    expect(patientListQuery({ view: 'recall', status: 'vip' }, TODAY)).toMatchObject({
      status: 'inactive',
    });
  });

  it('sends the filters and the column sort the API names', () => {
    expect(
      patientListQuery(
        {
          q: 'priya',
          types: ['aesthetic', 'lhr'],
          status: 'regular',
          conversion: 'converted',
          created: 'today',
          followUp: 'tomorrow',
          sort: 'followUp',
          order: 'asc',
        },
        TODAY,
      ),
    ).toMatchObject({
      q: 'priya',
      types: 'aesthetic,lhr',
      status: 'regular',
      conversion: 'converted',
      created_from: midnight(TODAY),
      created_to: midnight('2026-10-04'),
      follow_up_at_from: midnight('2026-10-04'),
      follow_up_at_to: midnight('2026-10-05'),
      sort: 'follow_up_at',
      order: 'asc',
    });
  });

  it('sends no search for an empty one', () => {
    expect(patientListQuery({ q: '' }, TODAY).q).toBeUndefined();
  });
});

describe('listPatients', () => {
  it('reads a page and its people in one more call, by id', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        data: [patientWireRow()],
        meta: { pagination: { has_more: true, next: 'cur_2', estimated_total: 61 } },
      } as never)
      .mockResolvedValueOnce({ data: [contactWireRow()] } as never);

    const page = await listPatients({ view: 'all' }, 'cur_1');

    expect(api.get).toHaveBeenNthCalledWith(1, '/app/patients', {
      query: expect.objectContaining({ limit: 50, after: 'cur_1' }),
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/app/contacts', {
      query: { ids: CONTACT_ID, limit: 1 },
    });
    expect(page.next).toBe('cur_2');
    expect(page.total).toBe(61);
    expect(page.rows[0]).toMatchObject({
      id: PATIENT_ID,
      seq: 3508,
      contactId: CONTACT_ID,
      name: 'Priya Shah',
      phone: '+919876543210',
      gender: 'female',
      dateOfBirth: '1995-10-27',
      consents: ['data', 'marketing'],
      contactUpdatedAt: '2026-10-01T07:00:00.000Z',
      updatedAt: '2026-10-01T08:00:00.000Z',
    });
  });

  it('keeps a row whose person could not be read, nameless', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: [patientWireRow()] } as never)
      .mockResolvedValueOnce({ data: [] } as never);

    const page = await listPatients({});

    expect(page.next).toBeNull();
    expect(page.rows[0]).toMatchObject({ seq: 3508, name: '', phone: '' });
  });
});

describe('fetchPatient', () => {
  it('reads the file and its person, every number with it', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: patientWireRow() } as never)
      .mockResolvedValueOnce({ data: contactWithPhones() } as never);

    const patient = await fetchPatient(PATIENT_ID);

    expect(api.get).toHaveBeenNthCalledWith(1, '/app/patients/{patient_id}', {
      params: { patient_id: PATIENT_ID },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/app/contacts/{contact_id}', {
      params: { contact_id: CONTACT_ID },
    });
    expect(patient.phone2).toBe('+919876500000');
    expect(patient.phones).toHaveLength(2);
  });
});

describe('createPatient', () => {
  it('creates a new person with the file — the first number the primary', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: patientWireRow() } as never);
    vi.mocked(api.get).mockResolvedValueOnce({ data: contactWithPhones() } as never);

    await createPatient({
      fields: priyaFields(),
      person: 'new',
      idempotencyKey: 'key-1',
    });

    expect(api.post).toHaveBeenCalledWith('/app/patients', {
      body: {
        contact: {
          first_name: 'Priya',
          last_name: 'Shah',
          phones: [
            { phone: '+919876543210', is_primary: true, is_on_whatsapp: true },
            { phone: '+919876500000', is_primary: false, is_on_whatsapp: true },
          ],
          gender: 'female',
          date_of_birth: '1995-10-27',
          address: 'Adajan',
          referral_source: null,
          referred_by_name: null,
          has_marketing_consent: true,
        },
        home_branch_id: BRANCH_ID,
        types: ['aesthetic'],
        status: 'new',
        conversion: 'not_converted',
        follow_up_at: null,
        notes: null,
        has_data_consent: true,
        has_photo_consent: false,
      },
      idempotencyKey: 'key-1',
    });
  });

  it('opens the file on a person the clinic knows, and a cleared conversion as Not converted', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: patientWireRow() } as never);
    vi.mocked(api.get).mockResolvedValueOnce({ data: contactWithPhones() } as never);

    await createPatient({
      fields: priyaFields({ conversion: null }),
      person: { contactId: CONTACT_ID },
      idempotencyKey: 'key-2',
    });

    const [, init] = vi.mocked(api.post).mock.calls[0] ?? [];
    expect(init).toMatchObject({
      body: { contact_id: CONTACT_ID, conversion: 'not_converted' },
    });
    expect((init as { body: Record<string, unknown> }).body).not.toHaveProperty(
      'contact',
    );
  });
});

describe('updatePatient', () => {
  async function readPriya() {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: patientWireRow() } as never)
      .mockResolvedValueOnce({ data: contactWithPhones() } as never);
    const record = await fetchPatient(PATIENT_ID);
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: patientWireRow() } as never)
      .mockResolvedValueOnce({ data: contactWithPhones() } as never);
    return record;
  }

  it('writes only the person when only the person changed, with its read and its own key', async () => {
    const record = await readPriya();

    await updatePatient({
      record,
      fields: priyaFields({ firstName: 'Priyanka' }),
      idempotencyKey: 'key-3',
    });

    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.patch).toHaveBeenCalledWith('/app/contacts/{contact_id}', {
      params: { contact_id: CONTACT_ID },
      body: expect.objectContaining({
        first_name: 'Priyanka',
        expected_updated_at: '2026-10-01T07:00:00.000Z',
      }),
      idempotencyKey: 'key-3:contact',
    });
  });

  it('writes only the file when only the file changed', async () => {
    const record = await readPriya();

    await updatePatient({
      record,
      fields: priyaFields({ status: 'vip', consents: ['data', 'photos', 'marketing'] }),
      idempotencyKey: 'key-4',
    });

    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.patch).toHaveBeenCalledWith('/app/patients/{patient_id}', {
      params: { patient_id: PATIENT_ID },
      body: expect.objectContaining({
        status: 'vip',
        has_photo_consent: true,
        expected_updated_at: '2026-10-01T08:00:00.000Z',
      }),
      idempotencyKey: 'key-4:patient',
    });
  });

  it('keeps the numbers past the second, after the two the drawer edits', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: patientWireRow() } as never)
      .mockResolvedValueOnce({
        data: contactWithPhones({
          phones: [
            { phone: '+919876543210', is_primary: true, is_on_whatsapp: true },
            { phone: '+919876500000', is_primary: false, is_on_whatsapp: false },
            { phone: '+919800000003', is_primary: false, is_on_whatsapp: false },
          ],
        }),
      } as never);
    const record = await fetchPatient(PATIENT_ID);
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: patientWireRow() } as never)
      .mockResolvedValueOnce({ data: contactWithPhones() } as never);

    await updatePatient({
      record,
      fields: priyaFields({ phone2: '+919811111111' }),
      idempotencyKey: 'key-5',
    });

    expect(api.patch).toHaveBeenCalledWith(
      '/app/contacts/{contact_id}',
      expect.objectContaining({
        body: expect.objectContaining({
          phones: [
            { phone: '+919876543210', is_primary: true, is_on_whatsapp: true },
            { phone: '+919811111111', is_primary: false, is_on_whatsapp: true },
            { phone: '+919800000003', is_primary: false, is_on_whatsapp: false },
          ],
        }),
      }),
    );
  });

  it('writes nothing when nothing changed, and answers the patient as read again', async () => {
    const record = await readPriya();

    const saved = await updatePatient({
      record,
      fields: priyaFields(),
      idempotencyKey: 'key-6',
    });

    expect(api.patch).not.toHaveBeenCalled();
    expect(saved.id).toBe(PATIENT_ID);
  });
});

describe('deletePatient and restorePatient', () => {
  it('deletes with the reason and note the confirm picked', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined } as never);

    await deletePatient({ patientId: PATIENT_ID, reason: 'other', note: 'Moved city' });

    expect(api.delete).toHaveBeenCalledWith('/app/patients/{patient_id}', {
      params: { patient_id: PATIENT_ID },
      reason: 'other',
      note: 'Moved city',
    });
  });

  it('restores with the action key and reads the person back', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: patientWireRow() } as never);
    vi.mocked(api.get).mockResolvedValueOnce({ data: contactWithPhones() } as never);

    const patient = await restorePatient(PATIENT_ID, 'key-7');

    expect(api.post).toHaveBeenCalledWith('/app/patients/{patient_id}/restore', {
      params: { patient_id: PATIENT_ID },
      idempotencyKey: 'key-7',
    });
    expect(patient.name).toBe('Priya Shah');
  });
});
