import { type APIRequestContext, expect, test } from '@playwright/test';

import {
  type DeploymentFlags,
  type DeploymentMode,
  parseDeploymentFlagsFromUserWire,
  resolveDeploymentMode,
} from '@/shared/tenancy/deployment-mode.ts';

import { bearerHeaders } from './e2e-tenancy.ts';

const API = '/api/v1';

export type MeContextWire = {
  user: {
    capabilities?: {
      personal_organizations?: boolean;
      personal_organization?: boolean;
      team_organizations?: boolean;
    };
    personal_organizations?: boolean;
    team_organizations?: boolean;
    personal_organization_id?: string | null;
  };
  active_organization: { type: 'PERSONAL' | 'TEAM'; id: string } | null;
  /** The caller's membership in the active organization (`mem_…`); `null` without one. */
  membership_id: string | null;
};

/** One workspace of `GET /users/me/organizations`. */
export type MyOrganizationWire = {
  id: string;
  type: 'PERSONAL' | 'TEAM';
  slug: string | null;
};

/** Fetch `GET /auth/me/context` wire `data` for an authenticated session. */
export async function fetchMeContextWire(
  api: APIRequestContext,
  token: string,
): Promise<MeContextWire> {
  const res = await api.get(`${API}/auth/me/context`, {
    headers: bearerHeaders(token),
  });
  expect(res.status()).toBe(200);
  return (await res.json()).data as MeContextWire;
}

/**
 * Every workspace the caller belongs to — `GET /users/me/organizations`, the list
 * the app's switcher reads (me/context no longer carries one).
 */
export async function fetchMyOrganizationsWire(
  api: APIRequestContext,
  token: string,
): Promise<MyOrganizationWire[]> {
  const res = await api.get(`${API}/users/me/organizations`, {
    headers: bearerHeaders(token),
  });
  expect(res.status()).toBe(200);
  return (await res.json()).data as MyOrganizationWire[];
}

export interface ProbedDeployment {
  mode: DeploymentMode;
  flags: DeploymentFlags;
  personalOrganizationId: string | null;
}

/**
 * Resolve deployment mode from a live clinozy-be session (via me/context).
 *
 * clinozy-be stopped sending the deployment flags on me/context (`user.capabilities`
 * went in 2026-10), so the wire alone now always reads as the defaults. Without
 * them the probe reads the deployment from what it did to this fresh account: it
 * got a personal workspace only if the deployment has them. Team organizations
 * are assumed on — a personal-only deployment answers a create with 403.
 */
export async function probeLiveDeployment(
  api: APIRequestContext,
  token: string,
): Promise<ProbedDeployment> {
  const data = await fetchMeContextWire(api, token);
  const { user } = data;
  const wireHasFlags =
    user.capabilities !== undefined ||
    user.personal_organizations !== undefined ||
    user.team_organizations !== undefined;
  const flags = wireHasFlags
    ? parseDeploymentFlagsFromUserWire(user)
    : {
        personalOrganizations: Boolean(user.personal_organization_id),
        teamOrganizations: true,
      };
  return {
    mode: resolveDeploymentMode(flags),
    flags,
    personalOrganizationId: data.user.personal_organization_id ?? null,
  };
}

/** Skip the current test when the live clinozy-be deployment is not the required mode. */
export function skipUnlessDeploymentMode(
  live: ProbedDeployment | null,
  required: DeploymentMode,
): void {
  if (!live) {
    test.skip(
      true,
      'could not probe live deployment mode (DATABASE_URL / clinozy-be required)',
    );
    return;
  }
  if (live.mode !== required) {
    test.skip(
      true,
      `requires ${deploymentEnvHint(required)} — live server is ${live.mode}`,
    );
  }
}

function deploymentEnvHint(mode: DeploymentMode): string {
  switch (mode) {
    case 'personal-only':
      return 'PERSONAL_ORGANIZATION_ENABLED=true and TEAM_ORGANIZATION_ENABLED=false';
    case 'team-only':
      return 'PERSONAL_ORGANIZATION_ENABLED=false and TEAM_ORGANIZATION_ENABLED=true';
    case 'personal-and-team':
      return 'PERSONAL_ORGANIZATION_ENABLED=true and TEAM_ORGANIZATION_ENABLED=true';
  }
}
