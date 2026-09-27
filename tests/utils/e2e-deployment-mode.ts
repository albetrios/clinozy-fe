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
  organizations: Array<{ type: 'PERSONAL' | 'TEAM'; id: string }>;
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

export interface ProbedDeployment {
  mode: DeploymentMode;
  flags: DeploymentFlags;
  personalOrganizationId: string | null;
}

/** Resolve deployment mode from a live clinozy-be session (via me/context). */
export async function probeLiveDeployment(
  api: APIRequestContext,
  token: string,
): Promise<ProbedDeployment> {
  const data = await fetchMeContextWire(api, token);
  const flags = parseDeploymentFlagsFromUserWire(data.user);
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
