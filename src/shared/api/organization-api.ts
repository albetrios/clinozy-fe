import { z } from 'zod';

import { API_BASE_PATH } from '@/core/config/constants.ts';
import { api, type ApiData } from '@/core/http/api.ts';
import { apiClient } from '@/core/http/fetch-client.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import { organizationPermissionSchema } from '@/core/types/permissions.ts';
import { isoDateString } from '@/core/types/wire.ts';
import { parseListTolerant } from '@/lib/parse-list-tolerant.ts';
import {
  type DeleteReason,
  type Tone,
  weekdaySchema,
} from '@/shared/api/clinic/clinic-schema.ts';
import type {
  ApiKey,
  ApiKeyWithSecret,
  Member,
  MemberChange,
  MemberInvite,
  MembershipStatus,
  RoleSummary,
} from '@/shared/api/organization-contracts.ts';
import { servedTone } from '@/shared/clinic/clinic-tones.ts';
import { fetchMeContext } from '@/shared/tenancy/me-context.ts';

import { fetchListPage, type ListPage, type ListPageParams } from './fetch-list-page.ts';

/** Active-org scoped tenancy base (active org comes from the token, not the URL). */
const ORG_API = `${API_BASE_PATH}/tenancy/organization`;
/** Sibling of ORG_API, not a child: the permission catalog is platform-wide, not org-scoped. */
const PERMISSIONS_API = `${API_BASE_PATH}/tenancy/permissions`;

const VALID_PERMISSIONS = new Set<string>(organizationPermissionSchema.options);

/**
 * Keeps only the permission codes this build knows about.
 *
 * Exported so a caller that already holds a me-context can reuse the same
 * filter instead of paying a second `me/context` round trip for it.
 */
export function toOrganizationPermissions(codes: string[]): OrganizationPermission[] {
  return codes.filter((p): p is OrganizationPermission => VALID_PERMISSIONS.has(p));
}

/**
 * The caller's permission codes in the active organization, filtered to the ones
 * this client knows about.
 *
 * @remarks
 * Reads `me/context` rather than a dedicated endpoint, so it shares that request's
 * cache. Codes clinozy-be returns that are not in the client's union are dropped by
 * `toOrganizationPermissions` — a newer backend never breaks an older client.
 *
 * @returns The granted codes, or an empty list outside an organization.
 */
export async function getMyPermissions(): Promise<OrganizationPermission[]> {
  const ctx = await fetchMeContext();
  return toOrganizationPermissions(ctx.myPermissions);
}

// ── Invitations (the invitee's side) ──

type ApiAcceptedInvitation = NonNullable<
  ApiData<'/tenancy/membership-invitations/{membership_invitation_id}/accept', 'post'>
>;

const acceptedInvitationWire = wireSchema<ApiAcceptedInvitation>()(
  z.object({ organization_id: z.string() }),
);

/**
 * Accept an invitation with the token from its link (`POST
 * /tenancy/membership-invitations/:id/accept`). The answer names the organization only — the
 * caller reads its slug from the switch that follows.
 *
 * @remarks
 * A 401 here is clinozy-be refusing the link for this account, not an expired session, so the
 * refresh-and-replay is skipped.
 *
 * @returns The joined organization's id.
 */
export async function acceptInvitation(
  invitationId: string,
  token: string,
): Promise<{ organizationId: string }> {
  const response = await api.post(
    '/tenancy/membership-invitations/{membership_invitation_id}/accept',
    {
      params: { membership_invitation_id: invitationId },
      body: { token },
      skip401: true,
    },
  );
  return { organizationId: acceptedInvitationWire.parse(response.data).organization_id };
}

// ── Members ──

type ApiMembership = NonNullable<
  ApiData<'/tenancy/organization/memberships/{membership_id}', 'get'>
>;

const membershipWire = wireSchema<ApiMembership>()(
  z.object({
    id: z.string(),
    user_id: z.string(),
    status: z.enum(['invited', 'active', 'suspended']),
    is_owner: z.boolean(),
    joined_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    display_name: z.string(),
    user: z.object({ email: z.string(), avatar_url: z.string().nullable() }),
    invitation: z.object({ id: z.string(), expires_at: z.string() }).nullable(),
    staff_number: z.number(),
    phone: z.string().nullable(),
    tone: z.string(),
    role_ids: z.array(z.string()),
    branch_ids: z.array(z.string()),
    working_days: z.array(weekdaySchema),
    work_starts_at: z.string(),
    work_ends_at: z.string(),
    commission_percent: z.number(),
  }),
);
type MembershipWire = z.output<typeof membershipWire>;

/** A membership as the app reads it. */
function toMember(wire: MembershipWire): Member {
  return {
    id: wire.id,
    userId: wire.user_id,
    name: wire.display_name,
    email: wire.user.email,
    status: wire.status,
    roleIds: wire.role_ids,
    roleId: wire.role_ids[0] ?? '',
    isOwner: wire.is_owner,
    joinedAt: wire.joined_at ?? '',
    avatarUrl: wire.user.avatar_url ?? undefined,
    invitation: wire.invitation
      ? { id: wire.invitation.id, expiresAt: wire.invitation.expires_at }
      : null,
    staffNumber: wire.staff_number,
    phone: wire.phone,
    tone: servedTone(wire.tone, wire.display_name),
    branchIds: wire.branch_ids,
    workingDays: wire.working_days,
    workStartsAt: wire.work_starts_at,
    workEndsAt: wire.work_ends_at,
    commissionPercent: wire.commission_percent,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

/** The members list's server-side filters beside search, sort and the cursor. */
export interface MemberListParams extends ListPageParams {
  status?: MembershipStatus;
  roleId?: string;
  branchId?: string;
}

/**
 * One page of the active organization's members (`GET /tenancy/organization/memberships`,
 * `membership:read`): search `q`, sort by name or joining, the status / role / branch filters and
 * the keyset cursor. Callers accumulate pages (`useCursorList`) or read them all
 * (`fetchAllMembers`).
 */
export async function listMembers(
  params: MemberListParams = {},
): Promise<ListPage<Member>> {
  const response = await api.get('/tenancy/organization/memberships', {
    query: {
      limit: params.limit,
      after: params.after,
      q: params.q === '' ? undefined : params.q,
      sort: listSortOf(params.sort),
      order: params.order,
      status: params.status,
      role_id: params.roleId,
      branch_id: params.branchId,
    },
  });
  const pagination = response.meta?.pagination;
  return {
    rows: z
      .array(membershipWire)
      .parse(response.data ?? [])
      .map(toMember),
    next: pagination?.next ?? null,
    hasMore: pagination?.has_more ?? false,
  };
}

/** The sorts the member and role lists take — anything else falls back to the server's default. */
function listSortOf(sort: string | undefined): 'name' | 'created_at' | undefined {
  return sort === 'name' || sort === 'created_at' ? sort : undefined;
}

/**
 * Change a member (`PATCH /tenancy/organization/memberships/:id`, `membership:update`): any of
 * status, roles, phone, tone, branches, working days, hours and commission. With
 * `expectedUpdatedAt`, clinozy-be answers `409 record_changed` when the row moved since it was
 * read. clinozy-be refuses the owner's roles and status (transfer ownership first) and the
 * caller's own status.
 */
export async function updateMember({
  membershipId,
  change,
  idempotencyKey,
}: {
  membershipId: string;
  change: MemberChange;
  idempotencyKey?: string;
}): Promise<Member> {
  const response = await api.patch('/tenancy/organization/memberships/{membership_id}', {
    params: { membership_id: membershipId },
    body: {
      status: change.status === 'invited' ? undefined : change.status,
      role_ids: change.roleIds,
      phone: change.phone,
      tone: change.tone,
      branch_ids: change.branchIds,
      working_days: change.workingDays,
      work_starts_at: change.workStartsAt,
      work_ends_at: change.workEndsAt,
      commission_percent: change.commissionPercent,
      expected_updated_at: change.expectedUpdatedAt,
    },
    idempotencyKey,
  });
  return toMember(membershipWire.parse(response.data));
}

/**
 * Remove a member (`DELETE /tenancy/organization/memberships/:id?reason=`, `membership:delete`).
 * Their preferences, saved views, API keys, lead holds, open tasks and branch defaults go with
 * the membership; a restore brings back the membership alone. Never the owner, never yourself.
 */
export async function removeMember({
  membershipId,
  reason,
  note,
}: {
  membershipId: string;
  reason: DeleteReason;
  note?: string;
}): Promise<{ id: string }> {
  await api.delete('/tenancy/organization/memberships/{membership_id}', {
    params: { membership_id: membershipId },
    reason,
    note,
  });
  return { id: membershipId };
}

/** Bring a removed member back (`POST …/memberships/:id/restore`, `membership:delete`). */
export async function restoreMember(
  membershipId: string,
  idempotencyKey: string,
): Promise<Member> {
  const response = await api.post(
    '/tenancy/organization/memberships/{membership_id}/restore',
    { params: { membership_id: membershipId }, idempotencyKey },
  );
  return toMember(membershipWire.parse(response.data));
}

/**
 * Leave the active organization — the caller's own membership, revoked
 * (`POST /organization/leave`, 204). Self-service: no permission code needed;
 * clinozy-be refuses the owner, who must transfer ownership first.
 */
export async function leaveOrganization(): Promise<void> {
  await apiClient.post<unknown>(`${ORG_API}/leave`, {});
}

/**
 * Invite a member by email (`POST /tenancy/organization/memberships`, `membership:create`,
 * team organizations only): clinozy-be creates an **invited** membership with the roles and any
 * clinic details given, and emails the invitee a link. The row joins the members list as
 * `invited` — its name is the email until they set one. clinozy-be refuses a role carrying a code
 * the inviter lacks (403), a full plan (`409 seat_limit_reached`), an existing member
 * (`409 membership_already_exists`) and a disposable address (`400 disposable_email`).
 */
export async function inviteMember({
  invite,
  idempotencyKey,
}: {
  invite: MemberInvite;
  idempotencyKey?: string;
}): Promise<Member> {
  const response = await api.post('/tenancy/organization/memberships', {
    body: {
      email: invite.email,
      role_ids: invite.roleIds,
      expires_in_days: invite.expiresInDays,
      phone: invite.phone,
      tone: invite.tone,
      branch_ids: invite.branchIds,
      working_days: invite.workingDays,
      work_starts_at: invite.workStartsAt,
      work_ends_at: invite.workEndsAt,
      commission_percent: invite.commissionPercent,
    },
    idempotencyKey,
  });
  return toMember(membershipWire.parse(response.data));
}

// ── Invitations (the organization's side) ──
//
// An invitation belongs to its invited membership: resend and cancel act on the membership id.

type ApiResentInvitation = NonNullable<
  ApiData<'/tenancy/organization/memberships/{membership_id}/invitation/resend', 'post'>
>;

const resentInvitationWire = wireSchema<ApiResentInvitation>()(
  z.object({ email: z.string(), expires_at: z.string() }),
);

/**
 * Send an invited member's link again (`POST …/memberships/:id/invitation/resend`,
 * `membership:update`): a fresh link and clinozy-be's default expiry (7 days) — an expired
 * invitation too. clinozy-be rate-limits the route strictly.
 */
export async function resendInvitation(
  membershipId: string,
  idempotencyKey?: string,
): Promise<{ email: string; expiresAt: string }> {
  const response = await api.post(
    '/tenancy/organization/memberships/{membership_id}/invitation/resend',
    { params: { membership_id: membershipId }, body: {}, idempotencyKey },
  );
  const invitation = resentInvitationWire.parse(response.data);
  return { email: invitation.email, expiresAt: invitation.expires_at };
}

/**
 * Cancel an invited member's invitation (`DELETE …/memberships/:id/invitation`,
 * `membership:delete`): clinozy-be revokes the link and ends the invited membership in one step,
 * so the row leaves the members list and the invitee's link says it was revoked.
 */
export async function revokeInvitation(membershipId: string): Promise<{ id: string }> {
  await api.delete('/tenancy/organization/memberships/{membership_id}/invitation', {
    params: { membership_id: membershipId },
  });
  return { id: membershipId };
}

// ── Roles ──

type ApiRole = NonNullable<ApiData<'/tenancy/organization/roles/{role_id}', 'get'>>;

const roleWire = wireSchema<ApiRole>()(
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    is_system: z.boolean(),
    is_locked: z.boolean(),
    tone: z.string(),
    member_count: z.number(),
    updated_at: z.string(),
  }),
);

/** A role as the app reads it. The list carries no codes — `getRolePermissions` reads them. */
function toRoleSummary(
  wire: z.output<typeof roleWire>,
  permissions: OrganizationPermission[] = [],
): RoleSummary {
  return {
    id: wire.id,
    name: wire.name,
    description: wire.description ?? '',
    permissions,
    memberCount: wire.member_count,
    isSystem: wire.is_system,
    isLocked: wire.is_locked,
    tone: servedTone(wire.tone, wire.name),
    updatedAt: wire.updated_at,
  };
}

/**
 * One page of the active organization's roles (`GET /tenancy/organization/roles`, `role:read`):
 * search `q`, sort by name or creation (creation is the presets' own order), the keyset cursor.
 */
export async function listRoles(
  params: ListPageParams = {},
): Promise<ListPage<RoleSummary>> {
  const response = await api.get('/tenancy/organization/roles', {
    query: {
      limit: params.limit,
      after: params.after,
      q: params.q === '' ? undefined : params.q,
      sort: listSortOf(params.sort),
      order: params.order,
    },
  });
  const pagination = response.meta?.pagination;
  return {
    rows: z
      .array(roleWire)
      .parse(response.data ?? [])
      .map((row) => toRoleSummary(row)),
    next: pagination?.next ?? null,
    hasMore: pagination?.has_more ?? false,
  };
}

/** A new custom role's name, description, tone, codes and the role whose codes it starts from. */
export interface RoleCreateInput {
  name: string;
  description: string;
  permissions: string[];
  tone?: Tone;
  /** Adds that role's codes to `permissions` (Users › New role's "Copy access from"). */
  copyFromRoleId?: string;
}

/**
 * Create a custom role in one call (`POST /tenancy/organization/roles`, `role:create`, team
 * organizations only): name, description, tone and its codes — `permission_codes`, plus a source
 * role's with `copy_from_role_id`. clinozy-be refuses a code the caller does not hold (403) and a
 * name already taken (409). The stored set is read back: it is what the cache should believe.
 */
export async function createRole({
  input,
  idempotencyKey,
}: {
  input: RoleCreateInput;
  idempotencyKey?: string;
}): Promise<RoleSummary> {
  const response = await api.post('/tenancy/organization/roles', {
    body: {
      name: input.name,
      description: input.description === '' ? null : input.description,
      permission_codes: input.permissions,
      tone: input.tone,
      copy_from_role_id: input.copyFromRoleId,
    },
    idempotencyKey,
  });
  const role = roleWire.parse(response.data);
  return toRoleSummary(role, await getRolePermissions(role.id));
}

/** A role's edit: what changes on the role itself, and its whole new code set when that changes. */
export interface RoleUpdateInput {
  id: string;
  /** Custom roles only — a preset keeps its name. */
  name?: string;
  description?: string;
  tone?: Tone;
  /** The whole new set (a full replace), or omitted to leave the codes as they are. */
  permissions?: string[];
  /** The edited role's `updatedAt` — `409 record_changed` when it moved since. */
  expectedUpdatedAt?: string;
}

/**
 * Edit a role: name, description and tone (`PATCH …/roles/:id`, `role:update`), then — when given
 * — its whole code set (`PUT …/roles/:id/permissions`, a full replace).
 *
 * @remarks
 * The two writes are separate on clinozy-be, so an edit can half-apply: renamed, but not
 * re-permissioned (a code the caller lacks, a locked role). Nothing can be rolled back (the old
 * name is gone), so the failure surfaces and the mutation hooks refresh the roles either way.
 */
export async function updateRole({
  input,
  idempotencyKey,
}: {
  input: RoleUpdateInput;
  idempotencyKey?: string;
}): Promise<RoleSummary> {
  const hasRoleChange =
    input.name !== undefined ||
    input.description !== undefined ||
    input.tone !== undefined;
  const role = hasRoleChange
    ? roleWire.parse(
        (
          await api.patch('/tenancy/organization/roles/{role_id}', {
            params: { role_id: input.id },
            body: {
              name: input.name,
              description: input.description,
              tone: input.tone,
              expected_updated_at: input.expectedUpdatedAt,
            },
            idempotencyKey,
          })
        ).data,
      )
    : null;
  if (input.permissions !== undefined) {
    await replaceRolePermissions(input.id, input.permissions);
  }
  const permissions = await getRolePermissions(input.id);
  if (role) return toRoleSummary(role, permissions);
  const read = await api.get('/tenancy/organization/roles/{role_id}', {
    params: { role_id: input.id },
  });
  return toRoleSummary(roleWire.parse(read.data), permissions);
}

/**
 * Replace a role's codes with this set (`PUT …/roles/:id/permissions`, `role:update`). clinozy-be
 * refuses a code the caller lacks, a locked role's and the owner's role's.
 */
export async function replaceRolePermissions(
  roleId: string,
  permissions: readonly string[],
): Promise<OrganizationPermission[]> {
  const response = await api.put('/tenancy/organization/roles/{role_id}/permissions', {
    params: { role_id: roleId },
    body: { permission_codes: [...permissions] },
  });
  return codesOf(response.data);
}

/**
 * Delete a custom role (`DELETE …/roles/:id?reason=`, `role:delete`). clinozy-be refuses a preset
 * (`is_system`), so the caller offers it only for the organization's own roles.
 */
export async function deleteRole({
  roleId,
  reason,
  note,
}: {
  roleId: string;
  reason: DeleteReason;
  note?: string;
}): Promise<{ id: string }> {
  await api.delete('/tenancy/organization/roles/{role_id}', {
    params: { role_id: roleId },
    reason,
    note,
  });
  return { id: roleId };
}

/** Bring a deleted role back (`POST …/roles/:id/restore`, `role:delete`). */
export async function restoreRole(
  roleId: string,
  idempotencyKey: string,
): Promise<RoleSummary> {
  const response = await api.post('/tenancy/organization/roles/{role_id}/restore', {
    params: { role_id: roleId },
    idempotencyKey,
  });
  const role = roleWire.parse(response.data);
  return toRoleSummary(role, await getRolePermissions(role.id));
}

type ApiRolePermission = NonNullable<
  ApiData<'/tenancy/organization/roles/{role_id}/permissions', 'get'>
>[number];

const rolePermissionWire = wireSchema<ApiRolePermission>()(
  z.object({ permission_code: z.string() }),
);

/** The known codes in a role-permissions answer. */
function codesOf(data: unknown): OrganizationPermission[] {
  return toOrganizationPermissions(
    z
      .array(rolePermissionWire)
      .parse(data ?? [])
      .map((row) => row.permission_code),
  );
}

/**
 * The permission codes granted to one role (`GET …/roles/:id/permissions`, `role:read` — the
 * whole set, one answer). The roles list carries none, so an edit reads them here first —
 * otherwise a save would replace the role's real codes with an empty set.
 */
export async function getRolePermissions(
  roleId: string,
): Promise<OrganizationPermission[]> {
  const response = await api.get('/tenancy/organization/roles/{role_id}/permissions', {
    params: { role_id: roleId },
  });
  return codesOf(response.data);
}

const permissionCatalogWire = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  category: z.string(),
});

/** One assignable permission, as the role builder and API-key scope picker render it. */
export interface PermissionCatalogEntry {
  code: OrganizationPermission;
  /** Human label supplied by clinozy-be (e.g. "Manage API Keys") — no client i18n key needed. */
  name: string;
  category: string;
}

/**
 * The permission catalog clinozy-be actually enforces (`GET /tenancy/permissions`, auth-only).
 *
 * Replaces a hardcoded client list that had drifted to 11 of the backend's codes, silently
 * making the missing ones — both webhook codes among them — undelegatable through the roles
 * UI. Unknown codes are dropped (`toOrganizationPermissions`) so a backend that adds one
 * ahead of the client cannot break the picker.
 */
export async function listPermissionCatalog(): Promise<PermissionCatalogEntry[]> {
  const res = await apiClient.get<unknown>(PERMISSIONS_API);
  return parseListTolerant(permissionCatalogWire, res.data, 'permission catalog')
    .filter((row): row is typeof row & { code: OrganizationPermission } =>
      VALID_PERMISSIONS.has(row.code),
    )
    .map((row) => ({ code: row.code, name: row.name, category: row.category }));
}

// ── API keys ──

/**
 * One API-key row as clinozy-be serializes it
 * (`organization-api-key.serializer.ts`). The masked prefix is `key_prefix` on
 * the wire — this schema asked for `prefix`, so the first organization to own a
 * key got a parse failure instead of a list. An empty organization parsed fine,
 * which is why the mismatch survived: the only state anyone had seen was the
 * empty one.
 */
const apiKeyWire = z.object({
  id: z.string(),
  name: z.string(),
  key_prefix: z.string(),
  created_at: isoDateString,
  last_used_at: isoDateString.nullable().optional(),
  expires_at: isoDateString.nullable().optional(),
});
type ApiKeyWire = z.infer<typeof apiKeyWire>;

function toApiKey(w: ApiKeyWire): ApiKey {
  return {
    id: w.id,
    name: w.name,
    prefix: w.key_prefix,
    createdAt: w.created_at,
    lastUsedAt: w.last_used_at ?? undefined,
    expiresAt: w.expires_at ?? undefined,
  };
}

/** One page of the active organization's API keys (windowed: search `q` + keyset cursor). */
export async function listApiKeys(
  params: ListPageParams = {},
): Promise<ListPage<ApiKey>> {
  const page = await fetchListPage(`${ORG_API}/api-keys`, apiKeyWire, 'api-keys', params);
  return { ...page, rows: page.rows.map(toApiKey) };
}

/**
 * Create an API key. The full secret comes back exactly once.
 *
 * `scopes` is REQUIRED and the body is `.strict()` server-side, so a request
 * without it is rejected 400 before it reaches the handler — which is what the
 * earlier shape of this fetcher did, and why nothing ever called it. The scopes
 * are permission codes, and clinozy-be additionally refuses any the caller does not
 * hold themselves (`assertCallerCanGrantPermissionCodes`).
 *
 * `expires_in_days` is a NUMBER of days (1–365) or omitted for a key that never
 * expires — not the string the old shape sent.
 */
export async function createApiKey(input: {
  name: string;
  scopes: string[];
  expiresInDays: number | null;
}): Promise<ApiKeyWithSecret> {
  const res = await apiClient.post<unknown>(`${ORG_API}/api-keys`, {
    name: input.name,
    scopes: input.scopes,
    ...(input.expiresInDays === null ? {} : { expires_in_days: input.expiresInDays }),
  });
  // `{ api_key, raw_key }`, not a flat row with a `secret` field.
  const wire = z.object({ api_key: apiKeyWire, raw_key: z.string() }).parse(res.data);
  return { ...toApiKey(wire.api_key), secret: wire.raw_key };
}

export async function renameApiKey(input: { id: string; name: string }): Promise<ApiKey> {
  const res = await apiClient.patch<unknown>(`${ORG_API}/api-keys/${input.id}`, {
    name: input.name,
  });
  return toApiKey(apiKeyWire.parse(res.data));
}

export async function revokeApiKey(keyId: string): Promise<{ id: string }> {
  await apiClient.delete<unknown>(`${ORG_API}/api-keys/${keyId}`);
  return { id: keyId };
}
