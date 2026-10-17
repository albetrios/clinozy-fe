import { z } from 'zod';

import { API_BASE_PATH } from '@/core/config/constants.ts';
import { apiClient } from '@/core/http/fetch-client.ts';
import { isoDateString, publicId } from '@/core/types/wire.ts';

import {
  type DeploymentFlags,
  mergeDeploymentFlags,
  parseDeploymentFlagsFromUserWire,
  userDeploymentFlagsWire,
} from './deployment-mode.ts';

// ── Wire schemas (snake_case — mirror the clinozy-be serializers) ──────────────

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

// clinozy-be #795 removed the per-org `capabilities` object. The app gates UI by
// `my_permissions` (RBAC) + an explicit team-org guard (useCan teamOrganizationOnly).
export const organizationWire = z.object({
  id: publicId('org'),
  name: z.string(),
  slug: z.string().nullable(),
  type: z.enum(['PERSONAL', 'TEAM']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
  logo_url: z.string().nullable(),
  brand_color: z.string().nullable().optional(),
  /**
   * The plan's hold on the clinic's records (me/context's active organization). Optional:
   * an older backend omits it, and so may the other reads of this shape — absent is
   * `active`. A value this app cannot read (a state added later) is also `active` rather
   * than a failed me/context: the banner it drives is advice, and clinozy-be refuses the
   * write either way.
   */
  plan_access: planAccessWire.optional().catch(undefined),
  created_at: isoDateString,
  updated_at: isoDateString,
});

const userWire = z.object({
  id: publicId('usr'),
  email: z.string(),
  is_email_verified: z.boolean(),
  is_mfa_enabled: z.boolean(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  job_title: z.string().nullable().optional(),
  avatar_url: z.string().nullable(),
  status: z.enum(['ACTIVE', 'LOCKED', 'SUSPENDED']),
  /** Whether the user has finished the onboarding wizard. Optional for
   * backward-compat with an older backend — absent is treated as onboarded so a
   * version skew never traps existing users in onboarding. */
  onboarding_completed: z.boolean().optional(),
  created_at: isoDateString,
  updated_at: isoDateString,
  /** Deployment flags — NOT per-org capabilities (those are ignored on org wire). */
  capabilities: userDeploymentFlagsWire,
  personal_organization_id: publicId('org').nullable().optional(),
  personal_organizations: z.boolean().optional(),
  team_organizations: z.boolean().optional(),
});

/** One of the caller's roles as me/context names it (any member may read their own). */
const myRoleWire = z.object({
  id: z.string(),
  name: z.string(),
  tone: z.string(),
  is_system: z.boolean(),
});

/** Wire shape of the `GET /auth/me/context` response `data` (snake_case). */
export const meContextWire = z.object({
  user: userWire,
  active_organization: organizationWire.nullable(),
  /** The caller's own membership in the active organization; null without one (N10). */
  membership_id: z.string().nullable().optional(),
  // Permission codes are kept as plain strings — forward-compatible with new
  // codes the FE enum may not yet know (RBAC matches by string membership).
  my_permissions: z.array(z.string()),
  /** The caller's roles in the active organization, the main role first, each named. */
  my_roles: z.array(myRoleWire).optional(),
  global_role: z.enum(['super_admin', 'user']).nullable(),
});
export type MeContextWire = z.infer<typeof meContextWire>;

// ── Camel-cased domain types (what the app consumes) ────────────────────────
export type OrganizationType = 'PERSONAL' | 'TEAM';
export type OrganizationStatusValue = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type GlobalRole = 'super_admin' | 'user';

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string | null;
  type: OrganizationType;
  status: OrganizationStatusValue;
  logoUrl: string | null;
  /** Optional per-org accent (hex/oklch) → `--color-brand` (FE-57); absent until the backend sends it. */
  brandColor?: string | null;
  /** The plan's hold on the clinic's records; {@link ACTIVE_PLAN_ACCESS} when the wire omits it. */
  planAccess?: PlanAccess;
  createdAt: string;
  updatedAt: string;
}
export interface MeUser {
  id: string;
  email: string;
  isEmailVerified: boolean;
  isMfaEnabled: boolean;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'LOCKED' | 'SUSPENDED';
  /** Whether the user has finished the onboarding wizard (drives post-login routing). */
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}
/** One of the caller's roles in the active organization. */
export interface MyRole {
  id: string;
  name: string;
  tone: string;
  /** A preset the clinic was provisioned with — its name never changes. */
  isSystem: boolean;
}

export interface MeContext {
  user: MeUser;
  activeOrganization: OrganizationSummary | null;
  /** The caller's own membership (`mem_…`) in the active organization; null without one. */
  membershipId: string | null;
  myPermissions: string[];
  /** The caller's roles in the active organization, the main role first; `[]` without one. */
  myRoles: MyRole[];
  globalRole: GlobalRole | null;
  /** Deployment-wide toggles (personal / team orgs enabled for this install). */
  deploymentFlags: DeploymentFlags;
  /** User's personal workspace id when personal orgs are enabled. */
  personalOrganizationId: string | null;
}

export function toOrganization(w: z.infer<typeof organizationWire>): OrganizationSummary {
  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    type: w.type,
    status: w.status,
    logoUrl: w.logo_url,
    brandColor: w.brand_color ?? null,
    planAccess: w.plan_access
      ? { state: w.plan_access.state, graceEndsAt: w.plan_access.grace_ends_at }
      : ACTIVE_PLAN_ACCESS,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

/** Map the validated wire payload to the camel-cased {@link MeContext}. */
export function toMeContext(wire: MeContextWire): MeContext {
  const deploymentFlags = mergeDeploymentFlags(
    parseDeploymentFlagsFromUserWire(wire.user),
  );
  return {
    user: {
      id: wire.user.id,
      email: wire.user.email,
      isEmailVerified: wire.user.is_email_verified,
      isMfaEnabled: wire.user.is_mfa_enabled,
      firstName: wire.user.first_name,
      lastName: wire.user.last_name,
      jobTitle: wire.user.job_title ?? null,
      avatarUrl: wire.user.avatar_url,
      status: wire.user.status,
      // Absent (older backend) → treat as onboarded so a version skew can't trap
      // an existing user in the wizard.
      onboardingCompleted: wire.user.onboarding_completed ?? true,
      createdAt: wire.user.created_at,
      updatedAt: wire.user.updated_at,
    },
    activeOrganization: wire.active_organization
      ? toOrganization(wire.active_organization)
      : null,
    membershipId: wire.membership_id ?? null,
    myPermissions: wire.my_permissions,
    myRoles: (wire.my_roles ?? []).map((role) => ({
      id: role.id,
      name: role.name,
      tone: role.tone,
      isSystem: role.is_system,
    })),
    globalRole: wire.global_role,
    deploymentFlags,
    personalOrganizationId: wire.user.personal_organization_id ?? null,
  };
}

/**
 * True until the user finishes the onboarding wizard. Driven by the backend
 * `onboarding_completed` flag (not workspace presence) so EVERY fresh user is
 * routed through onboarding once — personal deployments auto-provision a personal
 * org at signup, which previously made those users skip onboarding entirely. Only
 * the wizard *steps* differ by deployment mode; whether onboarding happens does not.
 */
export function needsOnboarding(ctx: MeContext): boolean {
  return !ctx.user.onboardingCompleted;
}

/** React Query key for the caller's session context (`GET /auth/me/context`). */
export const meContextQueryKey = ['auth', 'me-context'] as const;

/**
 * The single authoritative read of the caller's session context: user, active
 * organization (+ status), resolved permissions, global role, and
 * the org-switcher list. Powers boot hydration, the post-auth resolver, RBAC,
 * and nav visibility. Re-fetch on cold boot; after an org switch the switch
 * endpoint already returns the active-org delta (no extra call needed).
 */
export async function fetchMeContext(): Promise<MeContext> {
  const res = await apiClient.get<unknown>(`${API_BASE_PATH}/auth/me/context`);
  return toMeContext(meContextWire.parse(res.data));
}
