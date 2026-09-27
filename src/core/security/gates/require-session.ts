import { requireAuth } from '@/core/rbac/guards.ts';
import type { Gate } from '@/core/security/gate.types.ts';

/**
 * **L1 — authenticated session.** Bounces an unauthenticated caller to
 * `/login`, carrying the attempted path as the `returnTo` (`redirect`) search
 * param so login can send them back. Delegates to the proven `requireAuth`
 * guard; throwing the redirect short-circuits the gateway.
 */
export const requireSession: Gate = async (ctx) => {
  await requireAuth(`${ctx.location.pathname}${ctx.location.search}`);
};
