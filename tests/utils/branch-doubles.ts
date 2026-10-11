/**
 * Test data for Users › Branches, as clinozy-be answers it (`/app/branches`): a wire row and the
 * branch the room reads. Ids are public ids (`<prefix>_<21 [a-z0-9]>`). Override what a test is
 * about; the rest stays Vesu — open, not main, Mon–Sat 10:00–19:00, nobody by default.
 */
import type { AppBranch } from '@/shared/api/app/branches-contracts.ts';

/** Vesu's branch id. */
export const TEST_BRANCH_ID = 'brn_vesu00000000000000000';

/** Vesu as `GET /app/branches` answers a row. */
export const branchWireRow = (patch: Record<string, unknown> = {}) => ({
  id: TEST_BRANCH_ID,
  name: 'Vesu',
  tone: 'lav',
  is_main: false,
  is_active: true,
  address_line_one: '12, Ocean Arcade',
  address_line_two: null,
  area: 'Vesu',
  city: 'Surat',
  state: 'Gujarat',
  postal_code: '395007',
  phone: '+919876543210',
  email: 'vesu@clinic.com',
  gst_number: null,
  maps_link: null,
  review_link: null,
  opens_at: '10:00',
  closes_at: '19:00',
  working_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  default_doctor_membership_id: null,
  default_front_desk_membership_id: null,
  default_therapist_membership_id: null,
  default_pharmacist_membership_id: null,
  created_at: '2026-09-02T05:00:00.000Z',
  updated_at: '2026-09-02T05:00:00.000Z',
  ...patch,
});

/** Vesu as the room reads it. */
export const appBranch = (patch: Partial<AppBranch> = {}): AppBranch => ({
  id: TEST_BRANCH_ID,
  name: 'Vesu',
  tone: 'lav',
  isMain: false,
  active: true,
  addressLine1: '12, Ocean Arcade',
  addressLine2: null,
  area: 'Vesu',
  city: 'Surat',
  state: 'Gujarat',
  pin: '395007',
  phone: '+919876543210',
  email: 'vesu@clinic.com',
  gstNumber: null,
  opensAt: '10:00',
  closesAt: '19:00',
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  defaultDoctorId: null,
  defaultDeskId: null,
  defaultTherapistId: null,
  defaultPharmacistId: null,
  createdAt: '2026-09-02T05:00:00.000Z',
  updatedAt: '2026-09-02T05:00:00.000Z',
  ...patch,
});
