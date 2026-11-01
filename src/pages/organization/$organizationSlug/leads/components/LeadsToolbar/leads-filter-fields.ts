import { AGE_BANDS } from '@/shared/api/app/app-list-filters.ts';
import { LEAD_HOLD_FILTER_VALUES } from '@/shared/api/app/leads-contracts.ts';
import type { RoomFilterFields } from '@/shared/components/RoomToolbar/index.ts';

import { LEAD_SOURCE_ORDER, LEAD_STATUS_ORDER } from '../LeadFields/index.ts';

/**
 * The Leads Filters (`leads.md:180`; KICKOFF §6.3 Filters), in the popover's
 * order, keyed by the URL keys `leads.search.ts` parses: Status (one — tap
 * again to clear — in the pipeline's order) · Source (any) · Ownership (one; "Any" is no filter) · Team
 * (one member, matched as the owner or one of the involved — the API takes
 * one) · Age (one band — the person's age) · Created · Follow-up date (no "Not set": the API cannot filter by it).
 */
export const LEADS_FILTER_FIELDS = {
  status: { kind: 'options', values: LEAD_STATUS_ORDER, single: true },
  source: { kind: 'options', values: LEAD_SOURCE_ORDER },
  hold: { kind: 'options', values: LEAD_HOLD_FILTER_VALUES, single: true },
  member: { kind: 'people', single: true },
  age: { kind: 'options', values: AGE_BANDS, single: true },
  created: { kind: 'date', presets: 'created' },
  followUp: { kind: 'date', presets: 'followUp', without: ['not_set'] },
} as const satisfies RoomFilterFields;
