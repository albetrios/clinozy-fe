import { seedCommon } from '@/shared/api/clinic/clinic-fixture-seed.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';

/** 10:00 on 3 Oct 2026, clinic time — every Leads test's "now". */
export const NOW = new Date(clinicInstant('2026-10-03', '10:00'));

/** An instant `days` before {@link NOW}. */
export const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();

/** A staff profile with the fields the Leads room reads. */
export function staffProfile(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    ...seedCommon(daysAgo(400)),
    id: '00000000-0000-4000-8000-000000000012',
    seq: 12,
    firstName: 'Riya',
    lastName: 'Shah',
    initials: 'RS',
    email: 'riya@cresence.skin',
    phone: '+919825044120',
    roles: ['front_desk'],
    roleKeys: ['front_desk'],
    branchIds: [],
    tone: 'blush',
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    startsAt: '10:00',
    endsAt: '19:00',
    commissionPct: 0,
    active: true,
    presence: 'online',
    lastActiveAt: null,
    membershipId: null,
    ...overrides,
  };
}

/** Riya Shah, Front desk — "me" in the Leads tests. */
export const RIYA = staffProfile();

/** Nidhi Kapoor, Counsellor. */
export const NIDHI = staffProfile({
  id: '00000000-0000-4000-8000-000000000013',
  seq: 13,
  firstName: 'Nidhi',
  lastName: 'Kapoor',
  initials: 'NK',
  email: 'nidhi@cresence.skin',
  roles: ['counsellor'],
  roleKeys: ['counsellor'],
  tone: 'sage',
});

/** Asha Mehta, Front desk — she has left the clinic. */
export const ASHA = staffProfile({
  id: '00000000-0000-4000-8000-000000000016',
  seq: 16,
  firstName: 'Asha',
  lastName: 'Mehta',
  initials: 'AM',
  email: 'asha@cresence.skin',
  tone: 'blush',
  active: false,
  presence: 'away',
});

/** A pipeline lead: New, WhatsApp, Clinical, Nidhi's, touched yesterday. */
export function leadRecord(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    ...seedCommon(daysAgo(1)),
    id: '00000000-0000-4000-8000-000000002363',
    seq: 2363,
    name: 'Anaya Desai',
    phone: '+919879521034',
    email: null,
    status: 'new',
    source: 'whatsapp',
    interests: ['clinical'],
    ownerId: NIDHI.id,
    involvedIds: [],
    followUpAt: null,
    branchId: null,
    patientId: null,
    isContactThread: false,
    kind: 'enquiry',
    retargetReason: null,
    notes: null,
    customInterests: [],
    touchedAt: daysAgo(1),
    releasedAt: null,
    unreadCount: 0,
    ...overrides,
  };
}
