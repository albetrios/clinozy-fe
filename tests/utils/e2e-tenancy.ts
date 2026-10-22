import { type APIRequestContext, type APIResponse, expect } from '@playwright/test';
import pg from 'pg';

import { e2eTeamOrgProfile } from './e2e-faker.ts';
import { requireDatabaseUrl } from './e2e-session.ts';
import { echoedInvitationToken } from './e2e-verification-code.ts';

const API = '/api/v1';

export const idempotencyKey = (): string => crypto.randomUUID();

export function bearerHeaders(token: string, withIdem = false): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    ...(withIdem ? { 'X-Idempotency-Key': idempotencyKey() } : {}),
  };
}

export type TeamOrg = { id: string; slug: string | null; name?: string };

/**
 * A personal workspace has no billing of its own, and a read never leaks
 * another organization's. clinozy-be's billing reads are open to both kinds of
 * workspace (`docs/routes.txt`: `both`): the subscriptions list answers with an
 * empty page, the rest (invoices, payment methods) with 422 "create a team
 * organization".
 */
export async function expectNoPersonalBilling(res: APIResponse): Promise<void> {
  if (res.status() === 200) {
    expect(((await res.json()) as { data: unknown[] }).data).toEqual([]);
    return;
  }
  expect([403, 404, 422]).toContain(res.status());
}

/**
 * Create a TEAM org and, unless `switchInto` is false, switch the session into
 * it — `teamToken` is then the session's new token, scoped to the org (the
 * switch retires `token`); without the switch it is `token`, still live.
 */
export async function createTeamOrganization(
  api: APIRequestContext,
  token: string,
  opts?: { name?: string; slug?: string; switchInto?: boolean },
): Promise<{ createStatus: number; org: TeamOrg | null; teamToken: string }> {
  const { name, slug } = e2eTeamOrgProfile({
    label: 'team',
    name: opts?.name,
    slug: opts?.slug,
  });
  const create = await api.post(`${API}/tenancy/organizations`, {
    headers: bearerHeaders(token, true),
    data: { name, slug },
  });
  const org = create.ok() ? ((await create.json()) as { data: TeamOrg }).data : null;
  let teamToken = token;
  if (org && opts?.switchInto !== false) {
    const sw = await api.post(`${API}/auth/switch-to-organization`, {
      headers: bearerHeaders(token),
      data: { organization_id: org.id },
    });
    if (sw.ok()) {
      teamToken = ((await sw.json()) as { data: { access_token: string } }).data
        .access_token;
    }
  }
  return { createStatus: create.status(), org, teamToken };
}

async function resolveMemberRoleId(
  api: APIRequestContext,
  teamToken: string,
): Promise<string> {
  const rolesRes = await api.get(`${API}/tenancy/organization/roles`, {
    headers: bearerHeaders(teamToken),
  });
  if (!rolesRes.ok()) {
    throw new Error(`list roles failed: ${rolesRes.status()} ${await rolesRes.text()}`);
  }
  const roles = (await rolesRes.json()) as {
    data: Array<{ id: string; name: string }>;
  };
  const memberRole =
    roles.data.find((role) => role.name.toLowerCase() === 'admin') ??
    roles.data.find((role) => role.name.toLowerCase() === 'member') ??
    roles.data.find((role) => role.name.toLowerCase() !== 'owner') ??
    roles.data[0];
  if (!memberRole?.id) {
    throw new Error('createTeamInvitation: no assignable role in team org');
  }
  return memberRole.id;
}

/** A `sub_` public id: the prefix and 21 characters of [a-z0-9], as clinozy-be mints them. */
function subscriptionPublicId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(21));
  return `sub_${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}`;
}

/**
 * Gives the clinic `slug` room to invite: an ACTIVE subscription, with no payment provider, on the
 * cheapest active plan with more than one seat. A new clinic is on Free, whose one seat its owner
 * holds, so every invite would answer `409 seat_limit_reached`; a paid plan needs Stripe, which no
 * local or CI stack here has. Written straight to clinozy-be Postgres (DATABASE_URL); a clinic
 * that already has a live subscription keeps it. Throws when no seat could be granted.
 */
export async function grantInvitableSeats(slug: string): Promise<void> {
  const client = new pg.Client({ connectionString: requireDatabaseUrl() });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO billing.subscriptions
         (public_id, organization_id, plan_id, billing_cycle, status,
          current_period_start, current_period_end)
       SELECT $1, organization.id, plan.id, 'MONTHLY', 'ACTIVE', now(), now() + interval '30 days'
       FROM tenancy.organizations AS organization,
         LATERAL (
           SELECT id FROM billing.plans
           WHERE is_active AND (included_seats IS NULL OR included_seats > 1)
           ORDER BY included_seats IS NULL, price_monthly, included_seats
           LIMIT 1
         ) AS plan
       WHERE organization.slug = $2
         AND NOT EXISTS (
           SELECT 1 FROM billing.subscriptions AS live
           WHERE live.organization_id = organization.id AND live.status <> 'CANCELED'
         )`,
      [subscriptionPublicId(), slug],
    );
    const granted = await client.query(
      `SELECT 1 FROM billing.subscriptions AS live
       JOIN tenancy.organizations AS organization ON organization.id = live.organization_id
       JOIN billing.plans AS plan ON plan.id = live.plan_id
       WHERE organization.slug = $1 AND live.status = 'ACTIVE'
         AND (plan.included_seats IS NULL OR plan.included_seats > 1)`,
      [slug],
    );
    if (granted.rowCount === 0) {
      throw new Error(
        `grantInvitableSeats: no multi-seat subscription for clinic "${slug}" (no such clinic, or no active plan with more than one seat)`,
      );
    }
  } finally {
    await client.end();
  }
}

/**
 * Creates a pending member invitation in a new team org, with seats granted first.
 * `invitationToken` is the accept token clinozy-be echoes on the answer, or `null`
 * where it does not echo — then read it from the email (`pollInvitationTokenFromMailOutbox`).
 */
export async function createTeamInvitation(
  api: APIRequestContext,
  ownerToken: string,
  inviteeEmail: string,
  opts?: { slug?: string; name?: string },
): Promise<{
  invitationId: string;
  invitationToken: string | null;
  orgSlug: string;
  teamToken: string;
}> {
  const { org, teamToken } = await createTeamOrganization(api, ownerToken, opts);
  if (!org?.slug) {
    throw new Error('createTeamInvitation: team org slug missing');
  }
  await grantInvitableSeats(org.slug);
  const roleId = await resolveMemberRoleId(api, teamToken);
  const res = await api.post(`${API}/tenancy/organization/memberships`, {
    headers: bearerHeaders(teamToken, true),
    data: { email: inviteeEmail, role_ids: [roleId] },
  });
  if (res.status() !== 200) {
    throw new Error(
      `create membership invite failed: ${res.status()} ${await res.text()}`,
    );
  }
  const body = (await res.json()) as {
    data: { invitation?: { id: string } | null };
  };
  const invitationId = body.data.invitation?.id;
  if (!invitationId) {
    throw new Error(
      'createTeamInvitation: invitation id missing from membership response',
    );
  }
  return {
    invitationId,
    invitationToken: await echoedInvitationToken(res),
    orgSlug: org.slug,
    teamToken,
  };
}
