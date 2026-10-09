import { LEAD_STATUS_VALUES } from '@/shared/api/clinic/clinic-schema.ts';
import { LEAD_HOLD_FILTER_VALUES } from '@/shared/api/clinic/leads-contracts.ts';
import type { RoomFilterFields } from '@/shared/components/RoomToolbar/index.ts';

import { LEAD_SOURCE_ORDER } from '../LeadFields/index.ts';

/**
 * The Leads Filters (`leads.md:180`; KICKOFF §6.3 Filters), in the popover's
 * order, keyed by the URL keys `leads.search.ts` parses: Status (one — tap
 * again to clear) · Source (any) · Ownership (one; "Any" is no filter) · Team
 * (one member, matched as the owner or one of the involved — the API takes
 * one) · Created · Follow-up date (no "Not set": the API cannot filter by it).
 */
export const LEADS_FILTER_FIELDS = {
  status: { kind: 'options', values: LEAD_STATUS_VALUES, single: true },
  source: { kind: 'options', values: LEAD_SOURCE_ORDER },
  hold: { kind: 'options', values: LEAD_HOLD_FILTER_VALUES, single: true },
  member: { kind: 'people', single: true },
  created: { kind: 'date', presets: 'created' },
  followUp: { kind: 'date', presets: 'followUp', without: ['not_set'] },
} as const satisfies RoomFilterFields;
