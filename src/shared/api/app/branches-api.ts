import { z } from 'zod';

import { api, type ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import {
  clockTimeSchema,
  type Tone,
  toneSchema,
  type Weekday,
  weekdaySchema,
} from './app-schema.ts';

/** TanStack Query keys for the clinic's branches. */
export const branchQueryKeys = {
  all: ['app', 'branches'] as const,
  /** The member's branches in one organization. */
  active: (organizationId: string | null) =>
    [...branchQueryKeys.all, 'active', organizationId] as const,
};

/** One row of `GET /app/branches/my`, as the API types it. */
type ApiMyBranch = NonNullable<ApiData<'/app/branches/my', 'get'>>[number];

const myBranchWire = wireSchema<ApiMyBranch>()(
  z.object({
    id: z.string(),
    name: z.string(),
    tone: toneSchema,
    is_main: z.boolean(),
    opens_at: clockTimeSchema,
    closes_at: clockTimeSchema,
    working_days: z.array(weekdaySchema),
  }),
);

/** A branch the member can pick: the header picker, the Filters popovers, the booking rules. */
export interface BranchOption {
  /** `brn_…`. */
  id: string;
  name: string;
  tone: Tone;
  isMain: boolean;
  /** `HH:mm`, clinic-local. */
  opensAt: string;
  closesAt: string;
  workingDays: Weekday[];
}

/** A wire row as the rooms read it. */
function toBranchOption(row: z.output<typeof myBranchWire>): BranchOption {
  return {
    id: row.id,
    name: row.name,
    tone: row.tone,
    isMain: row.is_main,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    workingDays: row.working_days,
  };
}

/**
 * The active branches the member works in — every active branch for a member holding
 * `branch:read` — the main branch first, then by name (`GET /app/branches/my`, any member; the
 * server orders them).
 */
export async function fetchActiveBranches(): Promise<BranchOption[]> {
  const response = await api.get('/app/branches/my');
  return z
    .array(myBranchWire)
    .parse(response.data ?? [])
    .map(toBranchOption);
}
