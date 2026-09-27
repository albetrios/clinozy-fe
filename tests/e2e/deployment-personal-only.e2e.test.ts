import { type APIRequestContext, expect, test } from '@playwright/test';

import {
  fetchMeContextWire,
  type ProbedDeployment,
  probeLiveDeployment,
  skipUnlessDeploymentMode,
} from '@/tests/utils/e2e-deployment-mode.ts';
import { e2eTeamOrgProfile } from '@/tests/utils/e2e-faker.ts';
import {
  createSessionViaEmailCode,
  verifyDatabaseConnection,
} from '@/tests/utils/e2e-session.ts';
import { bearerHeaders } from '@/tests/utils/e2e-tenancy.ts';

/**
 * Personal-only deployment contract (clinozy-be env):
 * `PERSONAL_ORGANIZATION_ENABLED=true`, `TEAM_ORGANIZATION_ENABLED=false`.
 *
 * Skips automatically when the live server is not in this mode.
 */
const API = '/api/v1';
const REQUIRED_MODE = 'personal-only' as const;

let api: APIRequestContext;
let liveDeployment: ProbedDeployment | null = null;

test.beforeAll(async ({ playwright }) => {
  test.skip(!(await verifyDatabaseConnection()), 'Postgres mail_outbox required');
  api = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  const { accessToken } = await createSessionViaEmailCode(api);
  liveDeployment = await probeLiveDeployment(api, accessToken);
});

test.afterAll(async () => {
  await api?.dispose();
});

test.beforeEach(() => {
  skipUnlessDeploymentMode(liveDeployment, REQUIRED_MODE);
});

test.describe('deployment — personal-only', () => {
  test('me/context advertises personal orgs enabled and team orgs disabled', async () => {
    const { accessToken } = await createSessionViaEmailCode(api);
    const probed = await probeLiveDeployment(api, accessToken);
    expect(probed.flags).toEqual({
      personalOrganizations: true,
      teamOrganizations: false,
    });
    expect(probed.mode).toBe(REQUIRED_MODE);
  });

  test('new user lands on a PERSONAL active organization', async () => {
    const { accessToken } = await createSessionViaEmailCode(api);
    const ctx = await fetchMeContextWire(api, accessToken);
    expect(ctx.active_organization).not.toBeNull();
    expect(ctx.active_organization?.type).toBe('PERSONAL');
    expect(ctx.user.personal_organization_id).toBeTruthy();
    expect(ctx.organizations.every((o) => o.type === 'PERSONAL')).toBe(true);
  });

  test('POST /tenancy/organizations is rejected (team orgs disabled)', async () => {
    const { accessToken } = await createSessionViaEmailCode(api);
    const { name, slug } = e2eTeamOrgProfile({ label: 'personal-only-blocked' });
    const res = await api.post(`${API}/tenancy/organizations`, {
      headers: bearerHeaders(accessToken, true),
      data: { name, slug },
    });
    expect(res.status()).toBe(403);
  });

  test('billing subscriptions are forbidden on the personal workspace token', async () => {
    const { accessToken } = await createSessionViaEmailCode(api);
    const res = await api.get(`${API}/billing/subscriptions`, {
      headers: bearerHeaders(accessToken),
    });
    expect(res.status()).toBe(403);
  });
});
