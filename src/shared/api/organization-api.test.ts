import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock, putMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}));
vi.mock('@/core/http/fetch-client.ts', () => ({
  apiClient: {
    get: getMock,
    post: postMock,
    put: putMock,
    patch: patchMock,
    delete: deleteMock,
  },
}));

import {
  acceptInvitation,
  createApiKey,
  createRole,
  deleteRole,
  getMyPermissions,
  getRolePermissions,
  inviteMember,
  leaveOrganization,
  listApiKeys,
  listMembers,
  listPermissionCatalog,
  listRoles,
  removeMember,
  replaceRolePermissions,
  resendInvitation,
  restoreMember,
  restoreRole,
  revokeApiKey,
  revokeInvitation,
  toOrganizationPermissions,
  updateMember,
  updateRole,
} from './organization-api.ts';

const TS = '2026-01-01T00:00:00.000Z';

const USR = 'usr_abcdefghij0123456789x';
const ROL = 'rol_abcdefghij0123456789x';
const ROL_EXTRA = 'rol_bbbbbbbbbb0123456789x';
const MEM = 'mem_abcdefghij0123456789x';
const BRN = 'brn_abcdefghij0123456789x';
const MEMBERSHIPS = '/api/v1/tenancy/organization/memberships';
const ROLES = '/api/v1/tenancy/organization/roles';

/** A membership as clinozy-be serializes it. */
const WIRE_MEMBER = {
  id: MEM,
  user_id: USR,
  organization_id: 'org_abcdefghij0123456789x',
  status: 'active',
  is_owner: false,
  joined_at: TS,
  created_at: TS,
  updated_at: '2026-01-02T00:00:00.000Z',
  display_name: 'Ada Byron',
  ended_at: null,
  end_reason: null,
  user: {
    id: USR,
    email: 'ada@acme.test',
    first_name: 'Ada',
    last_name: 'Byron',
    avatar_url: null,
  },
  invitation: null,
  staff_number: 12,
  phone: '+919876543210',
  tone: 'lav',
  role_ids: [ROL, ROL_EXTRA],
  branch_ids: [BRN],
  working_days: ['mon', 'tue'],
  work_starts_at: '09:30',
  work_ends_at: '18:00',
  commission_percent: 12.5,
};

const INVITED_WIRE = {
  ...WIRE_MEMBER,
  status: 'invited',
  joined_at: null,
  display_name: 'new@acme.test',
  invitation: { id: 'inv_abcdefghij0123456789x', expires_at: TS },
};

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  putMock.mockReset();
  patchMock.mockReset();
  deleteMock.mockReset();
});

describe('organization-api memberships', () => {
  it('maps every membership field to the Member domain shape', async () => {
    getMock.mockResolvedValue({ data: [WIRE_MEMBER] });
    const [member] = (await listMembers()).rows;
    expect(member).toEqual({
      id: MEM,
      userId: USR,
      name: 'Ada Byron',
      email: 'ada@acme.test',
      status: 'active',
      roleIds: [ROL, ROL_EXTRA],
      roleId: ROL,
      isOwner: false,
      joinedAt: TS,
      avatarUrl: undefined,
      invitation: null,
      staffNumber: 12,
      phone: '+919876543210',
      tone: 'lav',
      branchIds: [BRN],
      workingDays: ['mon', 'tue'],
      workStartsAt: '09:30',
      workEndsAt: '18:00',
      commissionPercent: 12.5,
      createdAt: TS,
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it("a tone the palette lacks falls back to the name's own", async () => {
    getMock.mockResolvedValue({ data: [{ ...WIRE_MEMBER, tone: 'teal' }] });
    const [member] = (await listMembers()).rows;
    expect(member?.tone).not.toBe('teal');
  });

  it('refuses a membership with an uppercase status (the old wire)', async () => {
    getMock.mockResolvedValue({ data: [{ ...WIRE_MEMBER, status: 'ACTIVE' }] });
    await expect(listMembers()).rejects.toThrow();
  });

  it('forwards search, sort, filters and the cursor, and surfaces the next cursor', async () => {
    getMock.mockResolvedValue({
      data: [],
      meta: { pagination: { next: 'cursor-2', has_more: true } },
    });
    const page = await listMembers({
      q: 'ada',
      limit: 100,
      after: 'cursor-1',
      sort: 'name',
      order: 'desc',
      status: 'invited',
      roleId: ROL,
      branchId: BRN,
    });
    const url = new URL(`http://x${getMock.mock.calls[0]?.[0] as string}`);
    expect(url.pathname).toBe(MEMBERSHIPS);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'ada',
      limit: '100',
      after: 'cursor-1',
      sort: 'name',
      order: 'desc',
      status: 'invited',
      role_id: ROL,
      branch_id: BRN,
    });
    expect(page).toEqual({ rows: [], next: 'cursor-2', hasMore: true });
  });

  it('drops a sort the API does not take', async () => {
    getMock.mockResolvedValue({ data: [] });
    await listMembers({ sort: 'commission' });
    expect(getMock.mock.calls[0]?.[0]).toBe(MEMBERSHIPS);
  });

  it("updateMember PATCHes only the fields that change, with the read's updated_at", async () => {
    patchMock.mockResolvedValue({ data: { ...WIRE_MEMBER, status: 'suspended' } });
    const member = await updateMember({
      membershipId: MEM,
      change: {
        status: 'suspended',
        roleIds: [ROL],
        commissionPercent: 10,
        expectedUpdatedAt: TS,
      },
      idempotencyKey: 'key-1',
    });
    expect(patchMock).toHaveBeenCalledWith(
      `${MEMBERSHIPS}/${MEM}`,
      {
        status: 'suspended',
        role_ids: [ROL],
        commission_percent: 10,
        expected_updated_at: TS,
      },
      { idempotencyKey: 'key-1' },
    );
    expect(JSON.stringify(patchMock.mock.calls[0]?.[1])).not.toContain('phone');
    expect(member.status).toBe('suspended');
  });

  it('updateMember never sends "invited" as a status', async () => {
    patchMock.mockResolvedValue({ data: WIRE_MEMBER });
    await updateMember({ membershipId: MEM, change: { status: 'invited' } });
    expect(patchMock.mock.calls[0]?.[1]).toEqual({});
  });

  it('removeMember DELETEs with its reason and note', async () => {
    deleteMock.mockResolvedValue({ data: undefined });
    await expect(
      removeMember({ membershipId: MEM, reason: 'other', note: 'Left the clinic' }),
    ).resolves.toEqual({ id: MEM });
    expect(deleteMock).toHaveBeenCalledWith(
      `${MEMBERSHIPS}/${MEM}?reason=other&note=Left+the+clinic`,
      undefined,
    );
  });

  it('restoreMember POSTs the restore with its key and maps the member', async () => {
    postMock.mockResolvedValue({ data: WIRE_MEMBER });
    const member = await restoreMember(MEM, 'key-2');
    expect(postMock).toHaveBeenCalledWith(`${MEMBERSHIPS}/${MEM}/restore`, undefined, {
      idempotencyKey: 'key-2',
    });
    expect(member.id).toBe(MEM);
  });

  it('leaveOrganization posts to the self-service /organization/leave', async () => {
    postMock.mockResolvedValue({ data: null });
    await leaveOrganization();
    expect(postMock).toHaveBeenCalledWith('/api/v1/tenancy/organization/leave', {});
  });

  it('inviteMember POSTs email, role_ids and the clinic details', async () => {
    postMock.mockResolvedValue({ data: INVITED_WIRE });
    const member = await inviteMember({
      invite: {
        email: 'new@acme.test',
        roleIds: [ROL, ROL_EXTRA],
        branchIds: [BRN],
        commissionPercent: 5,
      },
      idempotencyKey: 'key-3',
    });
    expect(postMock).toHaveBeenCalledWith(
      MEMBERSHIPS,
      {
        email: 'new@acme.test',
        role_ids: [ROL, ROL_EXTRA],
        branch_ids: [BRN],
        commission_percent: 5,
      },
      { idempotencyKey: 'key-3' },
    );
    expect(member).toMatchObject({ status: 'invited', name: 'new@acme.test' });
  });
});

describe('organization-api invitations', () => {
  it('carries the live invitation of an invited row, and none for a joined member', async () => {
    getMock.mockResolvedValue({ data: [INVITED_WIRE, WIRE_MEMBER] });
    const [invited, joined] = (await listMembers()).rows;
    expect(invited?.invitation).toEqual({
      id: 'inv_abcdefghij0123456789x',
      expiresAt: TS,
    });
    expect(invited?.joinedAt).toBe('');
    expect(joined?.invitation).toBeNull();
  });

  it("resendInvitation POSTs to the membership's invitation resend and reads the new expiry", async () => {
    postMock.mockResolvedValue({
      data: {
        id: 'inv_abcdefghij0123456789x',
        membership_id: MEM,
        email: 'new@acme.test',
        expires_at: '2026-01-08T00:00:00.000Z',
        accepted_at: null,
        revoked_at: null,
        created_at: TS,
      },
    });
    await expect(resendInvitation(MEM, 'key-4')).resolves.toEqual({
      email: 'new@acme.test',
      expiresAt: '2026-01-08T00:00:00.000Z',
    });
    expect(postMock).toHaveBeenCalledWith(
      `${MEMBERSHIPS}/${MEM}/invitation/resend`,
      {},
      { idempotencyKey: 'key-4' },
    );
  });

  it("revokeInvitation DELETEs the membership's invitation", async () => {
    deleteMock.mockResolvedValue({ data: undefined });
    await expect(revokeInvitation(MEM)).resolves.toEqual({ id: MEM });
    expect(deleteMock).toHaveBeenCalledWith(
      `${MEMBERSHIPS}/${MEM}/invitation`,
      undefined,
    );
  });

  it('acceptInvitation POSTs the token without the 401 refresh and returns the organization', async () => {
    postMock.mockResolvedValue({
      data: {
        id: 'inv_abcdefghij0123456789x',
        membership_id: MEM,
        organization_id: 'org_abcdefghij0123456789x',
        email: 'new@acme.test',
        expires_at: TS,
        accepted_at: TS,
        revoked_at: null,
        created_at: TS,
      },
    });
    await expect(acceptInvitation('inv_abcdefghij0123456789x', 'tok')).resolves.toEqual({
      organizationId: 'org_abcdefghij0123456789x',
    });
    expect(postMock).toHaveBeenCalledWith(
      '/api/v1/tenancy/membership-invitations/inv_abcdefghij0123456789x/accept',
      { token: 'tok' },
      { skip401: true },
    );
  });
});

const ROLE_WIRE = {
  id: ROL,
  name: 'Doctor',
  description: 'Sees patients',
  is_system: true,
  is_locked: false,
  tone: 'sky',
  member_count: 3,
  created_at: TS,
  updated_at: TS,
};

const CODES_WIRE = [
  { permission_code: 'patient:read', created_at: TS },
  { permission_code: 'not:a-code', created_at: TS },
];

describe('organization-api roles', () => {
  it('maps the role wire to RoleSummary — the list carries no codes', async () => {
    getMock.mockResolvedValue({ data: [ROLE_WIRE, { ...ROLE_WIRE, description: null }] });
    const { rows } = await listRoles({ sort: 'created_at' });
    expect(rows[0]).toEqual({
      id: ROL,
      name: 'Doctor',
      description: 'Sees patients',
      permissions: [],
      memberCount: 3,
      isSystem: true,
      isLocked: false,
      tone: 'sky',
      updatedAt: TS,
    });
    expect(rows[1]?.description).toBe('');
    expect(getMock.mock.calls[0]?.[0]).toBe(`${ROLES}?sort=created_at`);
  });

  it('createRole creates in ONE call — codes, tone, copy-from — and reads the stored codes back', async () => {
    postMock.mockResolvedValue({ data: { ...ROLE_WIRE, is_system: false } });
    getMock.mockResolvedValue({ data: CODES_WIRE });
    const role = await createRole({
      input: {
        name: 'Floor manager',
        description: '',
        permissions: ['patient:read'],
        tone: 'plum',
        copyFromRoleId: ROL_EXTRA,
      },
      idempotencyKey: 'key-5',
    });
    expect(postMock).toHaveBeenCalledWith(
      ROLES,
      {
        name: 'Floor manager',
        description: null,
        permission_codes: ['patient:read'],
        tone: 'plum',
        copy_from_role_id: ROL_EXTRA,
      },
      { idempotencyKey: 'key-5' },
    );
    expect(putMock).not.toHaveBeenCalled();
    expect(getMock).toHaveBeenCalledWith(`${ROLES}/${ROL}/permissions`);
    expect(role.permissions).toEqual(['patient:read']);
  });

  it('updateRole PATCHes the role, then PUTs the whole code set', async () => {
    patchMock.mockResolvedValue({ data: { ...ROLE_WIRE, name: 'Senior doctor' } });
    putMock.mockResolvedValue({ data: CODES_WIRE });
    getMock.mockResolvedValue({ data: CODES_WIRE });
    const role = await updateRole({
      input: {
        id: ROL,
        name: 'Senior doctor',
        permissions: ['patient:read'],
        expectedUpdatedAt: TS,
      },
    });
    expect(patchMock).toHaveBeenCalledWith(
      `${ROLES}/${ROL}`,
      { name: 'Senior doctor', expected_updated_at: TS },
      undefined,
    );
    expect(putMock).toHaveBeenCalledWith(
      `${ROLES}/${ROL}/permissions`,
      { permission_codes: ['patient:read'] },
      undefined,
    );
    expect(role).toMatchObject({ name: 'Senior doctor', permissions: ['patient:read'] });
  });

  it('updateRole with codes alone skips the PATCH and reads the role', async () => {
    putMock.mockResolvedValue({ data: CODES_WIRE });
    getMock.mockImplementation((path: string) =>
      Promise.resolve({ data: path.endsWith('/permissions') ? CODES_WIRE : ROLE_WIRE }),
    );
    const role = await updateRole({ input: { id: ROL, permissions: ['patient:read'] } });
    expect(patchMock).not.toHaveBeenCalled();
    expect(role.name).toBe('Doctor');
  });

  it('updateRole surfaces a refused code set after the PATCH landed', async () => {
    patchMock.mockResolvedValue({ data: ROLE_WIRE });
    putMock.mockRejectedValue(new Error('403'));
    await expect(
      updateRole({ input: { id: ROL, description: 'x', permissions: ['role:delete'] } }),
    ).rejects.toThrow('403');
  });

  it('replaceRolePermissions answers the stored codes this build knows', async () => {
    putMock.mockResolvedValue({ data: CODES_WIRE });
    await expect(replaceRolePermissions(ROL, ['patient:read'])).resolves.toEqual([
      'patient:read',
    ]);
  });

  it('getRolePermissions drops codes this build does not model', async () => {
    getMock.mockResolvedValue({ data: CODES_WIRE });
    await expect(getRolePermissions(ROL)).resolves.toEqual(['patient:read']);
  });

  it('deleteRole DELETEs with its reason', async () => {
    deleteMock.mockResolvedValue({ data: undefined });
    await expect(deleteRole({ roleId: ROL, reason: 'not_needed' })).resolves.toEqual({
      id: ROL,
    });
    expect(deleteMock).toHaveBeenCalledWith(
      `${ROLES}/${ROL}?reason=not_needed`,
      undefined,
    );
  });

  it('restoreRole POSTs the restore with its key and reads the codes', async () => {
    postMock.mockResolvedValue({ data: ROLE_WIRE });
    getMock.mockResolvedValue({ data: CODES_WIRE });
    const role = await restoreRole(ROL, 'key-6');
    expect(postMock).toHaveBeenCalledWith(`${ROLES}/${ROL}/restore`, undefined, {
      idempotencyKey: 'key-6',
    });
    expect(role.permissions).toEqual(['patient:read']);
  });
});

const KEY_WIRE = {
  id: 'key_1',
  name: 'CI token',
  key_prefix: 'core_live_abcd',
  created_at: TS,
  last_used_at: null,
  expires_at: null,
};

describe('organization-api api-keys (live)', () => {
  it('maps the api-key wire to ApiKey', async () => {
    getMock.mockResolvedValue({ data: [KEY_WIRE] });
    const [key] = (await listApiKeys()).rows;
    expect(key).toMatchObject({
      id: 'key_1',
      name: 'CI token',
      prefix: 'core_live_abcd',
      createdAt: TS,
    });
    expect(key?.expiresAt).toBeUndefined();
  });

  it('createApiKey sends scopes and a NUMBER of days, and unwraps raw_key', async () => {
    // Three corrections in one call, all of which the old shape got wrong:
    // `scopes` is REQUIRED and the body is `.strict()` server-side;
    // `expires_in_days` is a number of days, not a string; and the response is
    // `{ api_key, raw_key }`, not a flat row carrying a `secret`.
    postMock.mockResolvedValue({
      data: { api_key: KEY_WIRE, raw_key: 'core_live_abcd_secret' },
    });
    const created = await createApiKey({
      name: 'CI token',
      scopes: ['organization:read'],
      expiresInDays: 30,
    });
    expect(created.secret).toBe('core_live_abcd_secret');
    expect(created.prefix).toBe('core_live_abcd');
    expect(postMock).toHaveBeenCalledWith(expect.stringContaining('/api-keys'), {
      name: 'CI token',
      scopes: ['organization:read'],
      expires_in_days: 30,
    });
  });

  it('createApiKey OMITS expires_in_days for a key that never expires', async () => {
    // clinozy-be caps the field at 365, so "never" cannot be a larger number.
    postMock.mockResolvedValue({
      data: { api_key: KEY_WIRE, raw_key: 'core_live_abcd_secret' },
    });
    await createApiKey({
      name: 'Forever',
      scopes: ['organization:read'],
      expiresInDays: null,
    });
    expect(postMock).toHaveBeenCalledWith(expect.stringContaining('/api-keys'), {
      name: 'Forever',
      scopes: ['organization:read'],
    });
  });

  it('revokeApiKey deletes and returns the id', async () => {
    deleteMock.mockResolvedValue({ data: null });
    expect(await revokeApiKey('key_1')).toEqual({ id: 'key_1' });
    expect(deleteMock).toHaveBeenCalledWith(expect.stringContaining('/api-keys/key_1'));
  });
});

describe('organization-api permissions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('toOrganizationPermissions drops codes this build does not know', () => {
    // A newer backend can grant a code this frontend has no policy for. Passing it
    // through would put an unrenderable permission into the store.
    expect(
      toOrganizationPermissions(['organization:read', 'not:a:real:permission']),
    ).toEqual(['organization:read']);
  });

  it('getMyPermissions reads the filtered codes off me/context', async () => {
    // The network fallback for when no me/context is cached — the guard chain
    // normally has one, and reads it directly (see ensurePermissionsFor).
    getMock.mockResolvedValue({
      data: {
        user: {
          id: USR,
          email: 'owner@example.com',
          first_name: null,
          last_name: null,
          avatar_url: null,
          status: 'ACTIVE',
          is_email_verified: true,
          is_mfa_enabled: false,
          onboarding_completed: true,
          created_at: TS,
          updated_at: TS,
        },
        active_organization: null,
        active_organization_id: null,
        my_permissions: ['organization:read', 'nope:nope'],
        global_role: null,
        organizations: [],
        deployment_flags: { personal_organizations: true, team_organizations: true },
        personal_organization_id: null,
      },
    });

    expect(await getMyPermissions()).toEqual(['organization:read']);
    expect(getMock).toHaveBeenCalledWith(expect.stringContaining('/auth/me/context'));
  });
});

describe('organization-api permission catalog', () => {
  beforeEach(() => vi.resetAllMocks());

  it('reads the catalog clinozy-be enforces', async () => {
    getMock.mockResolvedValue({
      data: [
        { code: 'organization:read', name: 'View Organization', category: 'tenancy' },
        { code: 'webhook:manage', name: 'Manage Webhooks', category: 'notify' },
      ],
    });

    const rows = await listPermissionCatalog();

    expect(getMock).toHaveBeenCalledWith(expect.stringContaining('/tenancy/permissions'));
    expect(rows).toEqual([
      { code: 'organization:read', name: 'View Organization', category: 'tenancy' },
      { code: 'webhook:manage', name: 'Manage Webhooks', category: 'notify' },
    ]);
  });

  // A backend that adds a permission ahead of this client must not break the picker: the
  // unknown code is dropped rather than rendered as an unselectable mystery row.
  it('drops codes this build does not model', async () => {
    getMock.mockResolvedValue({
      data: [
        { code: 'organization:read', name: 'View Organization', category: 'tenancy' },
        { code: 'quantum:entangle', name: 'Entangle', category: 'future' },
      ],
    });

    const rows = await listPermissionCatalog();

    expect(rows.map((row) => row.code)).toEqual(['organization:read']);
  });
});
