import type { DenyMode } from '@/core/rbac/guards.ts';
import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import type { PageManifest } from '@/lib/routes/page-manifest.ts';

import type { Gate } from './gate.types.ts';
import { requireModuleGate } from './gates/require-module.ts';
import { requirePermissionGate } from './gates/require-permission.ts';
import { requireSession } from './gates/require-session.ts';

/**
 * The common security gateway — composes access gates into a single
 * `beforeLoad`-style runner. Gates run **sequentially, one by one**, and the
 * **first gate to throw short-circuits** the rest (a redirect / notFound /
 * unauthorized halts entry). This is the single, testable access pipeline that
 * replaces ad-hoc per-route guard calls (research/11 §3.7).
 *
 * @example
 *   beforeLoad: gateway(requireSession, hydrateContext, resolveActiveOrg,
 *                       requireOrgStatus, requirePermission)
 */
export function gateway<TCtx>(...gates: Array<Gate<TCtx>>) {
  return async (ctx: TCtx): Promise<void> => {
    for (const gate of gates) {
      await gate(ctx);
    }
  };
}

/** A route's declared access policy (from its manifest). */
export interface RoutePolicy {
  permission?: OrganizationPermission | null;
  module?: string;
  /** How an authorization denial surfaces (FE-52): 403 page vs hide-as-404. */
  onDeny?: DenyMode;
}

/**
 * Compose the gateway for a route from its declared policy. **Default-deny:**
 * every protected route requires a session even with no explicit
 * permission; the L5 (permission) gate is added only when the policy names it.
 * This keeps a "forgot to add a guard" route failing closed (still
 * authenticated) rather than open.
 */
export function gatewayFromPolicy(policy: RoutePolicy) {
  const gates: Gate[] = [requireSession];
  // Static, most-restrictive gate first: a deployment-disabled module 404s the
  // whole surface (build-time flag read), so short-circuit before the later
  // org-scoped permission read. Session stays first (default-deny invariant).
  if (policy.module) gates.push(requireModuleGate(policy.module));
  if (policy.permission) {
    gates.push(requirePermissionGate(policy.permission, policy.onDeny));
  }
  return gateway(...gates);
}

/**
 * Compose the gateway from a route island manifest — maps `permission`,
 * `module`, and `onDeny` into {@link gatewayFromPolicy}.
 */
export function gatewayFromManifest(
  manifest: Pick<PageManifest, 'permission' | 'module' | 'onDeny'>,
) {
  return gatewayFromPolicy({
    permission: manifest.permission ?? undefined,
    module: manifest.module,
    onDeny: manifest.onDeny,
  });
}
