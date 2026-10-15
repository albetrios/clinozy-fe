import { useSearch } from '@tanstack/react-router';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import { presetOfRole } from '@/shared/api/app/access-contracts.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { PRESET_CODES } from '@/tests/utils/app-preset-codes.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  member,
  PLATFORM_ROLES,
  platformRole,
  SELF,
} from '@/tests/utils/team-doubles.ts';

import {
  renderUsersRoutes,
  resetUsersRoutes,
  USERS_ADMIN_CODES,
} from '../../../__tests__/integration/users-test-router.tsx';
import { validateRolesSearch } from '../../../users.search.ts';
import { RolesAccess } from './RolesAccess.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));
// The module itself, not the barrel: the deferred commit imports it directly.
vi.mock('@/shared/notify/notify.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

const api = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
  listPermissionCatalog: vi.fn(),
  getRolePermissions: vi.fn(),
  replaceRolePermissions: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  ...api,
}));

/** clinozy-be's permission catalog, as `listPermissionCatalog` maps it. */
const CATALOG = [
  { code: 'organization:read', name: 'View Organization', category: 'tenancy' },
  { code: 'membership:read', name: 'View Members', category: 'users' },
  { code: 'webhook:manage', name: 'Manage Webhooks', category: 'notify' },
  { code: 'audit-log:read', name: 'View Audit Logs', category: 'audit' },
];

const { admin, doctor, front_desk: frontDesk, counsellor, senior } = PLATFORM_ROLES;

const ROSTER = [
  member('riya', SELF.email, [admin, frontDesk], {
    userId: SELF.userId,
    name: 'Riya Shah',
  }),
  member('reenal', 'reenal@cresence.skin', [doctor], { name: 'Dr. Reenal Chaniyara' }),
  member('foram', 'foram@cresence.skin', [frontDesk, counsellor], {
    name: 'Foram Kanpariya',
  }),
];

/** The roles clinozy-be lists — mutable, so a created role is listed on the refetch. */
let platformRoles: RoleSummary[] = [];
/** Each role's codes as clinozy-be keeps them — a write is read back. */
let roleCodes = new Map<string, string[]>();
/** Refuse the next codes write, as clinozy-be would. */
let refuseWrites = false;

/** A role's codes: as written, else the preset's, else the reader's alone. */
function codesOf(roleId: string): string[] {
  const written = roleCodes.get(roleId);
  if (written) return written;
  const role = platformRoles.find((each) => each.id === roleId);
  const preset = role ? presetOfRole(role) : null;
  return preset ? [...PRESET_CODES[preset]] : ['organization:read'];
}

/** The Roles page as the route renders it: the URL's role on screen. */
function Roles() {
  const { role } = validateRolesSearch(useSearch({ strict: false }));
  return <RolesAccess selected={role} />;
}

function renderRoles(url = '/organization/acme/users/roles', codes = USERS_ADMIN_CODES) {
  return renderUsersRoutes(url, () => null, { codes, Roles });
}

const rolesUrl = (role: RoleSummary) => `/organization/acme/users/roles?role=${role.id}`;

/** The role page, once it and the role's codes are up. */
async function rolePage() {
  return screen.findByTestId('users-role-page');
}

function box(row: string, action: string) {
  return screen.getByTestId(`users-role-matrix-${row}-${action}`);
}

const without = (...codes: string[]) =>
  USERS_ADMIN_CODES.filter((code) => !codes.includes(code));

beforeEach(() => {
  viewport.tier = 'desktop';
  refuseWrites = false;
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  for (const fn of Object.values(api)) fn.mockReset();
  platformRoles = Object.values(PLATFORM_ROLES);
  roleCodes = new Map();
  api.listMembers.mockResolvedValue({ rows: ROSTER, next: null, hasMore: false });
  api.listPermissionCatalog.mockResolvedValue(CATALOG);
  api.listRoles.mockImplementation(() =>
    Promise.resolve({ rows: platformRoles, next: null, hasMore: false }),
  );
  api.getRolePermissions.mockImplementation((id: string) => Promise.resolve(codesOf(id)));
  api.replaceRolePermissions.mockImplementation((id: string, codes: string[]) => {
    if (refuseWrites) return Promise.reject(new Error('offline'));
    roleCodes.set(id, [...codes]);
    return Promise.resolve(codes);
  });
  api.updateRole.mockImplementation(({ input }: { input: { id: string } }) => {
    const role = platformRoles.find((each) => each.id === input.id);
    return Promise.resolve({ ...role, ...input });
  });
  api.deleteRole.mockImplementation(({ roleId }: { roleId: string }) =>
    Promise.resolve({ id: roleId }),
  );
  api.createRole.mockImplementation(({ input }: { input: { name: string } }) => {
    const created = platformRole('created', input.name, false);
    platformRoles = [...platformRoles, created];
    return Promise.resolve(created);
  });
});
afterEach(() => {
  vi.useRealTimers();
  resetUsersRoutes();
});

describe('RolesAccess — the role list and page (users.md:42–77)', () => {
  it('opens on Front desk: its people, a row per resource and its codes', async () => {
    const { container } = renderRoles();
    const page = await rolePage();
    expect(within(page).getByRole('heading', { name: 'Front desk' })).toBeInTheDocument();
    expect(screen.getByTestId(`users-roles-item-${frontDesk.id}`)).toHaveAttribute(
      'aria-current',
      'true',
    );
    // The presets but Owner, then the clinic's own role.
    expect(screen.getAllByTestId(/^users-roles-item-/)).toHaveLength(9);
    const people = within(page).getAllByTestId('users-role-person');
    expect(people.map((pill) => pill.textContent)).toEqual([
      'RSRiya Shah+ Admin',
      'FKForam Kanpariya+ Counsellor',
    ]);
    // The head row and sixteen resources.
    expect(within(page).getAllByRole('row')).toHaveLength(17);
    expect(box('lead', 'view')).toHaveAttribute('aria-checked', 'true');
    expect(box('lead', 'view')).toHaveAccessibleName('Front desk can view · Leads');
    expect(box('lead', 'view')).toHaveAttribute('title', 'lead:read');
    expect(box('lead', 'delete')).toHaveAttribute('aria-checked', 'false');
    expect(box('medicine', 'view')).toHaveAttribute('aria-checked', 'false');
    expect(box('patient_review', 'create')).toHaveAttribute('aria-checked', 'true');
    // Every member reads the catalogue: Offerings has no View box.
    expect(screen.queryByTestId('users-role-matrix-offering-view')).toBeNull();
    expect(screen.getByTestId('users-role-code-lead:export')).toHaveTextContent(
      'Export · Leads',
    );
    expect(
      screen.getByTestId('users-role-code-patient:private_album:read'),
    ).toHaveAttribute('aria-checked', 'false');
    expect(
      within(page).getByText(
        'Changes apply right away to everyone with this role. Someone with two roles gets everything either role allows.',
      ),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('writes the whole set at once — View off clears the row, a box brings View, the Row pill fills it', async () => {
    const user = userEvent.setup();
    renderRoles();
    await rolePage();
    await user.click(box('lead', 'delete'));
    expect(box('lead', 'delete')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('users-role-matrix-lead-row')).toHaveTextContent('Full');
    await waitFor(() =>
      expect(api.replaceRolePermissions).toHaveBeenCalledWith(
        frontDesk.id,
        expect.arrayContaining(['lead:delete', ...PRESET_CODES.front_desk]),
      ),
    );

    await user.click(box('lead', 'view'));
    for (const action of ['view', 'create', 'edit', 'delete']) {
      expect(box('lead', action)).toHaveAttribute('aria-checked', 'false');
    }
    expect(screen.getByTestId('users-role-matrix-lead-row')).toHaveTextContent('None');

    await user.click(box('medicine', 'edit'));
    expect(box('medicine', 'view')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('users-role-matrix-medicine-row')).toHaveTextContent(
      'Some',
    );

    await user.click(screen.getByTestId('users-role-matrix-medicine-row'));
    expect(box('medicine', 'delete')).toHaveAttribute('aria-checked', 'true');
    expect(notifyMock.error).not.toHaveBeenCalled();
  });

  it('puts a refused write back, with the error toast', async () => {
    const user = userEvent.setup();
    renderRoles();
    await rolePage();
    refuseWrites = true;
    await user.click(box('medicine', 'view'));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    await waitFor(() =>
      expect(box('medicine', 'view')).toHaveAttribute('aria-checked', 'false'),
    );
  });

  it('flips a special permission — one code — at once', async () => {
    const user = userEvent.setup();
    renderRoles();
    await rolePage();
    const floor = screen.getByTestId('users-role-code-offering:lower_price:read');
    expect(floor).toHaveAttribute('aria-checked', 'false');
    await user.click(floor);
    expect(floor).toHaveAttribute('aria-checked', 'true');
    await waitFor(() =>
      expect(api.replaceRolePermissions).toHaveBeenCalledWith(
        frontDesk.id,
        expect.arrayContaining(['offering:lower_price:read']),
      ),
    );
  });

  it('copies another role’s codes and says so', async () => {
    const user = userEvent.setup();
    renderRoles();
    await rolePage();
    await user.click(screen.getByTestId('users-role-copy'));
    await user.click(
      await screen.findByTestId(`users-role-copy-option-${PLATFORM_ROLES.pharmacist.id}`),
    );
    await waitFor(() =>
      expect(box('medicine', 'view')).toHaveAttribute('aria-checked', 'true'),
    );
    expect(box('lead', 'view')).toHaveAttribute('aria-checked', 'false');
    expect(api.replaceRolePermissions).toHaveBeenCalledWith(frontDesk.id, [
      ...PRESET_CODES.pharmacist,
    ]);
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Front desk now has the same access as Pharmacist',
    );
  });

  it('opens a holder’s drawer with the page kept behind it', async () => {
    const user = userEvent.setup();
    const { router } = renderRoles(rolesUrl(doctor));
    const page = await rolePage();
    expect(within(page).getByRole('heading', { name: 'Doctor' })).toBeInTheDocument();
    await user.click(within(page).getByTestId('users-role-person'));
    const reenal = ROSTER[1]?.id;
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/users/${reenal}/edit`,
      ),
    );
    expect(router.state.location.search).toEqual({ from: 'roles', role: doctor.id });
  });

  it('previews the app as the role — a custom one too — by its id', async () => {
    const user = userEvent.setup();
    const { unmount } = renderRoles(rolesUrl(counsellor));
    await user.click(within(await rolePage()).getByTestId('users-role-preview'));
    expect(useUIStore.getState().previewRole).toBe(counsellor.id);
    expect(notifyMock.success).toHaveBeenCalledWith(
      `Previewing ${PRODUCT_NAME} as Counsellor`,
    );
    unmount();
    useUIStore.setState({ previewRole: null });
    renderRoles(rolesUrl(senior));
    await user.click(within(await rolePage()).getByTestId('users-role-preview'));
    expect(useUIStore.getState().previewRole).toBe(senior.id);
  });
});

describe('RolesAccess — who may change what (Q-U6)', () => {
  it('locks Admin: every box says why, nothing changes, no preview', async () => {
    const user = userEvent.setup();
    renderRoles(rolesUrl(admin));
    const page = await rolePage();
    await user.click(box('lead', 'delete'));
    expect(notifyMock.info).toHaveBeenCalledWith('Admins always have full access');
    expect(box('lead', 'delete')).toHaveAttribute('aria-checked', 'true');
    expect(box('lead', 'delete')).toHaveAttribute('aria-disabled', 'true');
    expect(within(page).getByTestId('users-role-preview')).toBeDisabled();
    expect(within(page).queryByTestId('users-role-copy')).toBeNull();
    expect(
      within(page).getByText('Admins can do everything · this role can’t be narrowed.'),
    ).toBeInTheDocument();
    expect(api.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('reads only without role:update — boxes, switches — and adds none without role:create', async () => {
    const user = userEvent.setup();
    renderRoles('/organization/acme/users/roles', without('role:update', 'role:create'));
    const page = await rolePage();
    await user.click(box('lead', 'delete'));
    expect(notifyMock.info).toHaveBeenCalledWith('You can’t change roles · ask an admin');
    expect(box('lead', 'delete')).toHaveAttribute('aria-checked', 'false');
    const floor = within(page).getByTestId('users-role-code-offering:lower_price:read');
    await user.click(floor);
    expect(floor).toHaveAttribute('aria-checked', 'false');
    expect(within(page).queryByTestId('users-role-copy')).toBeNull();
    expect(
      within(page).getByText(
        'You can see roles here. Changing them needs “Update roles”.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByTestId('users-roles-new-role'));
    expect(notifyMock.info).toHaveBeenCalledWith('You can’t add roles · ask an admin');
    expect(api.createRole).not.toHaveBeenCalled();
    expect(api.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('gives only a code the viewer holds — and leaves a role beyond their own access alone', async () => {
    const user = userEvent.setup();
    const { unmount } = renderRoles(rolesUrl(senior), without('medicine:delete'));
    await rolePage();
    expect(box('medicine', 'delete')).toHaveAttribute('aria-disabled', 'true');
    await user.click(box('medicine', 'delete'));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You can only give access you have yourself',
    );
    expect(api.replaceRolePermissions).not.toHaveBeenCalled();
    unmount();

    // clinozy-be checks the role's old codes against the editor's too.
    roleCodes.set(senior.id, ['organization:read', 'medicine:delete']);
    renderRoles(rolesUrl(senior), without('medicine:delete'));
    const page = await rolePage();
    await user.click(box('lead', 'view'));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'This role has access you don’t have · ask an admin',
    );
    expect(
      within(page).getByText(
        'This role has access you don’t have · only someone who has it can change the role.',
      ),
    ).toBeInTheDocument();
    expect(api.replaceRolePermissions).not.toHaveBeenCalled();
  });
});

describe('RolesAccess — workspace permissions and the description (D17)', () => {
  it('gives a workspace permission the viewer holds — the codes no box or switch maps', async () => {
    const user = userEvent.setup();
    renderRoles(rolesUrl(senior));
    const page = await rolePage();
    const workspace = await within(page).findByTestId('users-role-workspace');
    expect(
      within(workspace)
        .getAllByRole('switch')
        .map((card) => card.textContent),
    ).toEqual(['View Organization', 'Manage Webhooks', 'View Audit Logs']);
    expect(
      within(workspace).getByTestId('users-role-code-organization:read'),
    ).toHaveAttribute('aria-checked', 'true');
    const webhooks = within(workspace).getByTestId('users-role-code-webhook:manage');
    expect(webhooks).toHaveAttribute('title', 'webhook:manage');
    await user.click(webhooks);
    expect(webhooks).toHaveAttribute('aria-checked', 'true');
    await waitFor(() =>
      expect(api.replaceRolePermissions).toHaveBeenCalledWith(senior.id, [
        'organization:read',
        'webhook:manage',
      ]),
    );
  });

  it('describes a custom role in place — an emptied box is the default', async () => {
    const user = userEvent.setup();
    renderRoles(rolesUrl(senior));
    const page = await rolePage();
    const description = within(page).getByTestId('users-role-description');
    expect(description).toHaveValue('Runs the desk on weekends');
    expect(description).toHaveAttribute(
      'placeholder',
      'Custom role · set what it can do below',
    );
    await user.clear(description);
    await user.type(description, 'Runs the evening desk{Enter}');
    await waitFor(() =>
      expect(api.updateRole).toHaveBeenCalledWith({
        input: { id: senior.id, description: 'Runs the evening desk' },
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('shows a custom role’s own description to a viewer who can’t edit it', async () => {
    renderRoles(rolesUrl(senior), without('role:update'));
    const page = await rolePage();
    expect(
      await within(page).findByText('Runs the desk on weekends'),
    ).toBeInTheDocument();
    expect(within(page).queryByTestId('users-role-description')).toBeNull();
  });
});

describe('RolesAccess — new, renamed and deleted roles', () => {
  it('adds "New role" in one call, selects it and names it in place', async () => {
    const user = userEvent.setup();
    const { router } = renderRoles();
    await rolePage();
    await user.click(screen.getByTestId('users-roles-new-role'));
    await waitFor(() =>
      expect(api.createRole).toHaveBeenCalledWith({
        input: {
          name: 'New role',
          description: 'Custom role',
          permissions: ['organization:read'],
          tone: 'lime',
        },
        idempotencyKey: expect.any(String),
      }),
    );
    const created = platformRole('created', 'New role', false).id;
    await waitFor(() => expect(router.state.location.search).toEqual({ role: created }));
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Role added · name it and pick what it can do',
    );
    const name = await screen.findByTestId('users-role-name');
    expect(name).toHaveValue('New role');
    await waitFor(() =>
      expect(box('lead', 'view')).toHaveAttribute('aria-checked', 'false'),
    );

    await user.clear(name);
    await user.type(name, 'Senior desk{Enter}');
    expect(notifyMock.error).toHaveBeenCalledWith(
      'A role called Senior desk already exists',
    );
    expect(api.updateRole).not.toHaveBeenCalled();

    await user.clear(name);
    await user.type(name, 'Night desk{Enter}');
    await waitFor(() =>
      expect(api.updateRole).toHaveBeenCalledWith({
        input: { id: created, name: 'Night desk' },
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('deletes a custom role nobody holds after the Undo window, as no longer needed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderRoles(rolesUrl(senior));
    const page = await rolePage();
    await user.click(within(page).getByTestId('users-role-delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete Senior desk?')).toBeInTheDocument();
    expect(await axeForDialog(dialog)).toHaveNoViolations();
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(screen.queryByTestId(`users-roles-item-${senior.id}`)).toBeNull(),
    );
    expect(api.deleteRole).not.toHaveBeenCalled();
    // The Undo window is the shared 10s, not the deferred default's 5s.
    await vi.advanceTimersByTimeAsync(9_000);
    expect(api.deleteRole).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    await waitFor(() =>
      expect(api.deleteRole).toHaveBeenCalledWith({
        roleId: senior.id,
        reason: 'not_needed',
      }),
    );
  });

  it('offers no delete — nor a rename — for a preset', async () => {
    renderRoles(rolesUrl(PLATFORM_ROLES.marketing));
    const page = await rolePage();
    expect(within(page).getByRole('heading', { name: 'Marketing' })).toBeInTheDocument();
    expect(within(page).queryByTestId('users-role-delete')).toBeNull();
    expect(within(page).queryByTestId('users-role-name')).toBeNull();
    expect(
      within(page).getByText(
        'Nobody has this role yet · give it to someone from their user drawer.',
      ),
    ).toBeInTheDocument();
  });
});

describe('RolesAccess — on a phone (H:184–187)', () => {
  it('shows one pane at a time, with "Back to roles"', async () => {
    viewport.tier = 'phone';
    const user = userEvent.setup();
    renderRoles();
    await screen.findByTestId('users-roles-list');
    expect(screen.queryByTestId('users-role-page')).toBeNull();
    await user.click(screen.getByTestId(`users-roles-item-${doctor.id}`));
    const page = await rolePage();
    expect(screen.queryByTestId('users-roles-list')).toBeNull();
    await user.click(within(page).getByTestId('users-roles-back'));
    expect(await screen.findByTestId('users-roles-list')).toBeInTheDocument();
  });

  it('keeps the list after "New role"', async () => {
    viewport.tier = 'phone';
    const user = userEvent.setup();
    renderRoles();
    await screen.findByTestId('users-roles-list');
    await user.click(screen.getByTestId('users-roles-new-role'));
    await waitFor(() => expect(api.createRole).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getByTestId(
          `users-roles-item-${platformRole('created', 'New role', false).id}`,
        ),
      ).toHaveAttribute('aria-current', 'true'),
    );
    expect(screen.queryByTestId('users-role-page')).toBeNull();
  });
});
