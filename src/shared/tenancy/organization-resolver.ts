import { organizationHome, organizationPicker } from '@/lib/routes/index.ts';

import { resolveDeploymentMode } from './deployment-mode.ts';
import { type MeContext, needsOnboarding } from './me-context.ts';
import { ensureMyInvitations } from './my-invitations.ts';
import { ensureSessionContext } from './session-context.ts';

/**
 * Where `/` lands (research/11 §3.3, D-02/D-10): onboarding, the active
 * clinic's home, or the organization picker — decided from `me/context`.
 */
export type RootTarget =
  | { readonly to: '/onboarding' }
  | ReturnType<typeof organizationPicker>
  | ReturnType<typeof organizationHome>;

/**
 * The org home sends a member on to a clinic room, and every room gates on
 * `organization:read` (the room manifests). A member whose active org is a team
 * they can't read (a role without that grant, e.g. a mis-seeded org) would be
 * bounced from that room to `/unauthorized` — whose "Go Home" resolves right
 * back here, a dead-end loop. So land such a session on the **org picker**
 * instead: a gate-light surface they can always reach, where they pick a
 * workspace they can enter (or sign out). Members WITH the grant are unaffected.
 */
const HOME_LANDING_PERMISSION = 'organization:read';

function teamHomeOrPicker(ctx: MeContext, organizationSlug: string): RootTarget {
  if (!ctx.myPermissions.includes(HOME_LANDING_PERMISSION)) {
    return organizationPicker();
  }
  return organizationHome(organizationSlug);
}

/** What the `/` decision knows besides me/context: the person's pending invitations (D84). */
export interface RootTargetOptions {
  /** How many pending invitations the signed-in person has; none when unknown. */
  readonly pendingInvitations?: number;
}

/**
 * Whether the person could be sent to their invitations — a team deployment and no clinic to
 * enter. Only then is reading the invitations worth a request.
 */
function mayLandOnInvitations(ctx: MeContext): boolean {
  return (
    resolveDeploymentMode(ctx.deploymentFlags) !== 'personal-only' &&
    ctx.activeOrganization?.type !== 'TEAM'
  );
}

/**
 * The `/` decision. A person with no clinic to enter who has been invited lands
 * on the picker, which lists their invitations above "Create organization" —
 * BEFORE onboarding, whose team-only finish would otherwise create a second,
 * empty clinic for someone who was invited into one (D84). After an accept the
 * clinic is active, so the next decision runs onboarding (profile only) or
 * lands at home as usual.
 *
 * Otherwise onboarding is the first gate for EVERY deployment mode: a fresh user
 * goes through the wizard once before any workspace — even in personal modes,
 * where a personal org is auto-provisioned at signup. Only the wizard steps
 * differ by mode, not whether onboarding runs. Driven by the backend
 * `onboarding_completed` flag.
 *
 * Then the active team organization's home. Everything else — no active org, a
 * personal active workspace, a personal-only deployment — lands on the picker:
 * personal workspaces have no clinic of their own (D44), and the picker's list
 * and "Create organization" are the way into one, so it is never a dead end.
 */
export function resolveRootTarget(
  ctx: MeContext,
  options: RootTargetOptions = {},
): RootTarget {
  if ((options.pendingInvitations ?? 0) > 0 && mayLandOnInvitations(ctx)) {
    return organizationPicker();
  }
  if (needsOnboarding(ctx)) return { to: '/onboarding' } as const;

  const active = ctx.activeOrganization;
  if (
    resolveDeploymentMode(ctx.deploymentFlags) !== 'personal-only' &&
    active?.type === 'TEAM' &&
    active.slug
  ) {
    return teamHomeOrPicker(ctx, active.slug);
  }
  return organizationPicker();
}

/**
 * Team slug routes and the picker require a provisioned workspace. Only
 * onboarding redirects: when the URL targets a **specific** `$organizationSlug`,
 * the slug chain ({@link requireOrganizationContext}) owns membership validation
 * (404 for non-members) and switch-on-navigation — redirecting on the CURRENT
 * active org here would trap personal-active (or no-active) sessions out of
 * every team workspace they belong to, which is the exact org switch the
 * navigation is asking for. The bare `/organization` picker is where those
 * sessions land, so it never redirects them either.
 */
export function workspaceRedirectForTeamEntry(
  ctx: MeContext,
  options: RootTargetOptions = {},
): RootTarget | null {
  const target = resolveRootTarget(ctx, options);
  return target.to === '/onboarding' ? target : null;
}

/**
 * How many pending invitations could change where the person lands — read only when they could
 * (no clinic to enter), else 0. A failed read counts as none: an invitation must never stand
 * between someone and the app.
 */
export async function countLandingInvitations(ctx: MeContext): Promise<number> {
  if (!mayLandOnInvitations(ctx)) return 0;
  const invitations = await ensureMyInvitations().catch(() => []);
  return invitations.length;
}

/** {@link resolveRootTarget} with the person's pending invitations ({@link countLandingInvitations}). */
export async function resolveRootTargetWithInvitations(
  ctx: MeContext,
): Promise<RootTarget> {
  return resolveRootTarget(ctx, {
    pendingInvitations: await countLandingInvitations(ctx),
  });
}

/**
 * `/` resolver (dual-URL, research/11 §3.3): reads deployment mode + active org
 * from `me/context` (JWT-backed session context), and the pending invitations
 * when there is no clinic to enter.
 */
export async function resolveRootRedirect(): Promise<RootTarget> {
  return resolveRootTargetWithInvitations(await ensureSessionContext());
}
