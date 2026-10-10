/**
 * Test data for the Offerings room and the rooms that read its catalogue, as clinozy-be answers
 * them (`/app/offerings`, `/app/offers`): wire rows from the local stack's own records, and the
 * domain records the rooms read. Money in rupees, ids public ids (`<prefix>_<21 [a-z0-9]>`).
 * Override what a test is about; the rest stays "Research Peel" (#5, ₹2,000, billed ₹1,800,
 * floor ₹1,500, at Vesu) and a live 15% offer on it.
 */
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';

/** Research Peel's offering id. */
export const TEST_OFFERING_ID = 'off_xh6ravxjcszcpta6taym0';

/** The offer's id. */
export const TEST_OFFER_ID = 'ofr_w28ixe5gwcf3crpeed4zu';

/** Vesu, where Research Peel is sold. */
export const TEST_OFFERING_BRANCH_ID = 'brn_thsaog1i8bv6m9rd9ucoy';

/** Research Peel as `GET /app/offerings` answers a row (and the by-id read the record). */
export const offeringWireRow = (patch: Record<string, unknown> = {}) => ({
  id: TEST_OFFERING_ID,
  offering_number: 5,
  name: 'Research Peel',
  category: 'treatment',
  specialty: 'skin',
  tone: 'sage',
  price: 2000,
  min_price: 1500,
  duration_minutes: 30,
  sessions: 1,
  validity_days: 0,
  gst_percent: 18,
  is_active: true,
  offering_group_id: null,
  offer_price: 1800,
  branch_ids: [TEST_OFFERING_BRANCH_ID],
  is_gst_inclusive: false,
  search_terms: ['chemical', 'glow'],
  description: 'Research row (offerings room brief)',
  created_at: '2026-10-10T04:50:29.931Z',
  updated_at: '2026-10-10T04:50:29.931Z',
  ...patch,
});

/** A live 15% offer on Research Peel, every branch, no dates, as `GET /app/offers` answers it. */
export const offerWireRow = (patch: Record<string, unknown> = {}) => ({
  id: TEST_OFFER_ID,
  name: 'Research Diwali glow',
  code: 'DIWALI25',
  kind: 'percent',
  value: 15,
  offering_ids: [TEST_OFFERING_ID],
  branch_ids: [],
  starts_on: null,
  ends_on: null,
  is_active: true,
  status: 'live',
  tone: 'blush',
  note: null,
  created_at: '2026-10-10T04:50:38.146Z',
  updated_at: '2026-10-10T04:51:04.269Z',
  ...patch,
});

/** Research Peel as the rooms read it. */
export function offeringRecord(overrides: Partial<OfferingRecord> = {}): OfferingRecord {
  return {
    id: TEST_OFFERING_ID,
    offeringNumber: 5,
    name: 'Research Peel',
    category: 'treatment',
    specialty: 'skin',
    tone: 'sage',
    price: 2000,
    offerPrice: 1800,
    minPrice: 1500,
    durationMin: 30,
    sessions: 1,
    validityDays: 0,
    gstPercent: 18,
    isGstInclusive: false,
    isActive: true,
    offeringGroupId: null,
    branchIds: [TEST_OFFERING_BRANCH_ID],
    searchTerms: ['chemical', 'glow'],
    description: 'Research row (offerings room brief)',
    createdAt: '2026-10-10T04:50:29.931Z',
    updatedAt: '2026-10-10T04:50:29.931Z',
    ...overrides,
  };
}

/** The live 15% offer as the rooms read it. */
export function offerRecord(overrides: Partial<OfferRecord> = {}): OfferRecord {
  return {
    id: TEST_OFFER_ID,
    name: 'Research Diwali glow',
    code: 'DIWALI25',
    kind: 'percent',
    value: 15,
    offeringIds: [TEST_OFFERING_ID],
    branchIds: [],
    startsOn: null,
    endsOn: null,
    isActive: true,
    status: 'live',
    tone: 'blush',
    note: null,
    createdAt: '2026-10-10T04:50:38.146Z',
    updatedAt: '2026-10-10T04:51:04.269Z',
    ...overrides,
  };
}
