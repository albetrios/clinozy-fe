import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({ api: { get: vi.fn() } }));
import { api } from '@/core/http/api.ts';

import {
  COMMAND_SEARCH_LIMIT,
  isCommandSearchQuery,
  searchAppCommands,
} from './command-search-api.ts';

/** A contact list row as clinozy-be answers it. */
const contactRow = (patch: Record<string, unknown> = {}) => ({
  id: 'con_dharti0000000000000000',
  contact_number: 1204,
  first_name: 'Dharti',
  last_name: 'Galani',
  primary_phone: '+919825043212',
  email: null,
  instagram_handles: [],
  default_channel: 'whatsapp',
  preference_tags: [],
  patient_id: 'pat_dharti0000000000000000',
  open_lead_id: null,
  last_activity_at: null,
  last_received_at: null,
  is_awaiting_reply: false,
  updated_at: '2026-10-02T04:30:00.000Z',
  gender: 'female',
  date_of_birth: null,
  date_of_birth_is_approximate: false,
  age: null,
  address: null,
  referral_source: null,
  referred_by_contact_id: null,
  referred_by_name: null,
  has_marketing_consent: false,
  patient_number: 3508,
  ...patch,
});

beforeEach(() => {
  vi.mocked(api.get).mockReset();
});

describe('isCommandSearchQuery — the contacts search’s rule (CT9)', () => {
  it('takes 3+ letters, 4+ digits of a number, or a whole contact number', () => {
    expect(
      ['dha', '9825', '+91 9825', 'C-12', '#3508'].map(isCommandSearchQuery),
    ).toEqual([true, true, true, true, true]);
    expect(['', 'dh', '982', '  d '].map(isCommandSearchQuery)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('searchAppCommands', () => {
  it('reads the people GET /app/contacts?q= finds, with their patient file and open lead', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        contactRow(),
        contactRow({
          id: 'con_ravi000000000000000000',
          contact_number: 1310,
          first_name: 'Ravi',
          last_name: null,
          patient_id: null,
          patient_number: null,
          open_lead_id: 'lead_ravi00000000000000000',
        }),
      ],
    } as never);
    const result = await searchAppCommands(' dha ');
    expect(api.get).toHaveBeenCalledWith('/app/contacts', {
      query: { q: 'dha', limit: COMMAND_SEARCH_LIMIT },
    });
    expect(result.people).toEqual([
      {
        id: 'con_dharti0000000000000000',
        name: 'Dharti Galani',
        contactNumber: 1204,
        phone: '+919825043212',
        patientId: 'pat_dharti0000000000000000',
        patientNumber: 3508,
        openLeadId: null,
      },
      {
        id: 'con_ravi000000000000000000',
        name: 'Ravi',
        contactNumber: 1310,
        phone: '+919825043212',
        patientId: null,
        patientNumber: null,
        openLeadId: 'lead_ravi00000000000000000',
      },
    ]);
  });

  it('asks nothing for a query the contacts search would refuse', async () => {
    expect(await searchAppCommands('dh')).toEqual({ people: [] });
    expect(api.get).not.toHaveBeenCalled();
  });
});
