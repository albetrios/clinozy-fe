import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';

import { fetchPatientFile } from './patient-file-api.ts';

const PATIENT_ID = 'pat_priya0000000000000000';
const CONTACT_ID = 'con_priya0000000000000000';

const patientWireRow = {
  id: PATIENT_ID,
  patient_number: 3508,
  contact_id: CONTACT_ID,
  home_branch_id: 'brn_main0000000000000000',
  types: ['aesthetic'],
  status: 'regular',
  conversion: 'converted',
  doctor_membership_id: null,
  follow_up_at: null,
  notes: null,
  lead_id: null,
  has_data_consent: true,
  has_photo_consent: true,
  allergies: [],
  contraindications: [],
  created_at: '2026-09-20T05:00:00.000Z',
  updated_at: '2026-10-01T08:00:00.000Z',
};

const contactWire = {
  id: CONTACT_ID,
  contact_number: 1188,
  first_name: 'Priya',
  last_name: 'Shah',
  primary_phone: '+919876543210',
  email: null,
  instagram_handles: ['priya.glow'],
  default_channel: 'whatsapp',
  preference_tags: ['evenings', 'gujarati', 'english'],
  patient_id: PATIENT_ID,
  open_lead_id: null,
  last_activity_at: null,
  last_received_at: '2026-10-02T09:00:00.000Z',
  is_awaiting_reply: true,
  updated_at: '2026-10-01T07:00:00.000Z',
  gender: 'female',
  date_of_birth: null,
  address: null,
  referral_source: null,
  referred_by_contact_id: null,
  referred_by_name: null,
  has_marketing_consent: false,
  patient_number: 3508,
  phones: [{ phone: '+919876543210', is_primary: true, is_on_whatsapp: true }],
};

/** Answer each read of the file by its path. */
function answer({
  next = null,
  checkIns = [] as unknown[],
  reviews = [] as unknown[],
}: {
  next?: unknown;
  checkIns?: unknown[];
  reviews?: unknown[];
} = {}) {
  vi.mocked(api.get).mockImplementation((async (path: string) => {
    if (path === '/app/patients/{patient_id}') return { data: patientWireRow };
    if (path === '/app/contacts/{contact_id}') return { data: contactWire };
    if (path === '/app/contacts/{contact_id}/preview')
      return { data: { next_appointment: next } };
    if (path === '/app/patients/{patient_id}/check-ins')
      return {
        data: checkIns,
        meta: { pagination: { estimated_total: checkIns.length * 2 } },
      };
    if (path === '/app/patients/{patient_id}/reviews')
      return { data: reviews, meta: { pagination: { estimated_total: reviews.length } } };
    throw new Error(`unexpected read ${path}`);
  }) as never);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchPatientFile', () => {
  it('reads the patient, their person, the next booking and the newest feedback', async () => {
    answer({
      next: {
        id: 'appt_next0000000000000000',
        appointment_date: '2026-10-10',
        start_time: '12:00:00',
        service_label: 'Consultation',
        status: 'confirmed',
      },
      checkIns: [{ feel: 'better', score: 7 }],
      reviews: [{ source: 'google', rating: 5 }],
    });

    const file = await fetchPatientFile(PATIENT_ID);

    expect(api.get).toHaveBeenCalledWith('/app/patients/{patient_id}/check-ins', {
      params: { patient_id: PATIENT_ID },
      query: { limit: 1, sort: 'check_in_date', order: 'desc' },
    });
    expect(file).toMatchObject({
      patient: { id: PATIENT_ID, name: 'Priya Shah', consents: ['data', 'photos'] },
      instagram: 'priya.glow',
      language: 'gujarati',
      nextVisit: {
        appointmentId: 'appt_next0000000000000000',
        date: '2026-10-10',
        startTime: '12:00',
        serviceLabel: 'Consultation',
      },
      feedback: {
        feel: 'better',
        score: 7,
        review: { source: 'google', rating: 5 },
        checkIns: 2,
        reviews: 1,
      },
      awaitingReply: true,
    });
  });

  it('answers no next visit and no feedback for a new patient', async () => {
    answer();

    const file = await fetchPatientFile(PATIENT_ID);

    expect(file.nextVisit).toBeNull();
    expect(file.feedback).toEqual({
      feel: null,
      score: null,
      review: null,
      checkIns: 0,
      reviews: 0,
    });
  });
});
