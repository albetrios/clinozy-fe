import type { RoomFilterFields } from '@/shared/components/RoomToolbar/index.ts';

import { PENDING_FILTER_VALUES } from './pending.search.ts';

/**
 * Pending's Filters by URL key, in the popover's order (`payments.md:55`):
 * Which way, State, then Created. Page-only, so it stays out of
 * `pending.search.ts`, which rides the entry chunk. The copy is the room's
 * (`PAYMENTS_KEYS` in `../payments.constants.ts`).
 */
export const PENDING_FILTER_FIELDS = {
  direction: { kind: 'options', values: PENDING_FILTER_VALUES.direction },
  status: { kind: 'options', values: PENDING_FILTER_VALUES.status },
  created: { kind: 'date', presets: 'created' },
} as const satisfies RoomFilterFields;
