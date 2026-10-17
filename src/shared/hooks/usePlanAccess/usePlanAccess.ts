import { useMeContext } from '@/shared/hooks/useMeContext/index.ts';
import { ACTIVE_PLAN_ACCESS, type PlanAccess } from '@/shared/tenancy/me-context.ts';

/**
 * The active clinic's plan access (`active_organization.plan_access` on `GET /auth/me/context`):
 * `active`, `grace` (records turn read-only at `graceEndsAt`) or `read_only` (clinozy-be refuses
 * every clinic write with `403 organization_read_only`).
 *
 * @remarks
 * Read from the one me/context query — server state, never mirrored into a store. Anything not
 * yet known reads as {@link ACTIVE_PLAN_ACCESS}: while me/context loads, outside a clinic, or
 * from a backend that does not send the field. It drives advice only (the shell's notice); the
 * API is the boundary that refuses the write.
 */
export function usePlanAccess(): PlanAccess {
  const { data } = useMeContext();
  return data?.activeOrganization?.planAccess ?? ACTIVE_PLAN_ACCESS;
}
