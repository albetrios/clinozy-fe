import { z } from 'zod';

import { isoDateString } from '@/core/types/wire.ts';

/**
 * Whether the active clinic's records can be changed, by its plan: `active` (paid, or
 * enforcement off), `grace` (no paid plan — records turn read-only at `grace_ends_at`) or
 * `read_only` (every write to `/api/v1/app/*` answers `403 organization_read_only`).
 */
export const PLAN_ACCESS_STATES = ['active', 'grace', 'read_only'] as const;
/** One of {@link PLAN_ACCESS_STATES}. */
export type PlanAccessState = (typeof PLAN_ACCESS_STATES)[number];

const planAccessWire = z.object({
  state: z.enum(PLAN_ACCESS_STATES),
  /** When a `grace` period ends (ISO 8601); null when active. */
  grace_ends_at: isoDateString.nullable(),
});

/** The active clinic's plan access, camel-cased (what the app consumes). */
export interface PlanAccess {
  state: PlanAccessState;
  /** When records turn read-only (ISO 8601) — set during `grace`; null otherwise. */
  graceEndsAt: string | null;
}

/** What a clinic with a paid plan — or a backend that sends no `plan_access` — has. */
export const ACTIVE_PLAN_ACCESS: PlanAccess = { state: 'active', graceEndsAt: null };

/**
 * Reads me/context's `active_organization.plan_access` (kept unparsed on
 * `OrganizationSummary.planAccessWire`).
 *
 * @remarks
 * Absent (an older backend) or a value this app cannot read (a state added later) is
 * {@link ACTIVE_PLAN_ACCESS}, never an error: the notice it drives is advice, and clinozy-be
 * refuses the write either way. It lives here, not in `me-context.ts`, because me/context is
 * parsed on first paint and only the clinic shell's notice needs this schema.
 */
export function parsePlanAccess(wire: unknown): PlanAccess {
  const parsed = planAccessWire.safeParse(wire);
  return parsed.success
    ? { state: parsed.data.state, graceEndsAt: parsed.data.grace_ends_at }
    : ACTIVE_PLAN_ACCESS;
}
