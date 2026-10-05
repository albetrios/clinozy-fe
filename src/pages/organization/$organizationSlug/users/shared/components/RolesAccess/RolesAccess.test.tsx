import { useSearch } from '@tanstack/react-router';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import type * as AccessApiModule from '@/shared/api/clinic/access-api.ts';
import { resetClinicAccessFixture } from '@/shared/api/clinic/access-api.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  member,
  PLATFORM_ROLES,
  platformRole,
  renderUsersRoutes,
  resetUsersRoutes,
  SELF,
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
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  ...api,
}));

// The fixture matrix, with a switch that makes clinozy-be refuse the next write.
const matrixWrites = vi.hoisted(() => ({ refuse: false }));
vi.mock('@/shared/api/clinic/access-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof AccessApiModule>();
  return {
    ...actual,
    saveRoleMatrixChange: (change: Parameters<typeof actual.saveRoleMatrixChange>[0]) =>
      matrixWrites.refuse
        ? Promise.reject(new Error('offline'))
        : actual.saveRoleMatrixChange(change),
  };
});

/** clinozy-be's permission catalog, as `listPermissionCatalog` maps it. */
const CATALOG = [
  { code: 'organization:read', name: 'View Organization', category: 'tenancy' },
  { code: 'membership:read', name: 'View Members', category: 'tenancy' },
  { code: 'webhook:manage', name: 'Manage Webhooks', category: 'notify' },
  { code: 'audit-log:read', name: 'View Audit Log', category: 'audit' },
];

const ROSTER = [
  member('riya', SELF.email, PLATFORM_ROLES.admin, { userId: SELF.userId }),
  member('reenal', 'reenal@cresence.skin'),
  member('foram', 'foram@cresence.skin'),
];

/** The roles clinozy-be lists — mutable, so a created role is listed on the refetch. */
let platformRoles: RoleSummary[] = [];
/** Each role's permission codes as clinozy-be keeps them — a write is read back. */
let roleCodes = new Map<string, OrganizationPermission[]>();

/** The Roles page as the route renders it: the URL's role on screen. */
function Roles() {
  const { role } = validateRolesSearch(useSearch({ strict: false }));
  return <RolesAccess selected={role} />;
}

function renderRoles(url = '/organization/acme/users/roles', codes = USERS_ADMIN_CODES) {
  return renderUsersRoutes(url, () => null, { codes, Roles });
}

/** The role page, once it is up. */
async function rolePage() {
  return screen.findByTestId('users-role-page');
}

function box(section: string, action: string) {
  return screen.getByTestId(`users-role-matrix-${section}-${action}`);
}

beforeEach(() => {
  viewport.tier = 'desktop';
  matrixWrites.refuse = false;
  resetClinicFixtures();
  resetClinicAccessFixture();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  for (const fn of Object.values(api)) fn.mockReset();
  platformRoles = Object.values(PLATFORM_ROLES);
  api.listMembers.mockResolvedValue({ rows: ROSTER, next: null, hasMore: false });
  api.listPermissionCatalog.mockResolvedValue(CATALOG);
  api.listRoles.mockImplementation(() =>
    Promise.resolve({ rows: platformRoles, next: null, hasMore: false }),
  );
  roleCodes = new Map();
  api.getRolePermissions.mockImplementation((id: string) =>
    Promise.resolve(roleCodes.get(id) ?? ['organization:read']),
  );
  api.updateRole.mockImplementation(
    (input: { id: string; name: string; permissions: OrganizationPermission[] }) => {
      roleCodes.set(input.id, input.permissions);
      return Promise.resolve({ ...PLATFORM_ROLES.senior, ...input });
    },
  );
  api.deleteRole.mockImplementation((id: string) => Promise.resolve({ id }));
  api.createRole.mockImplementation((input: { name: string }) => {
    const created = { ...platformRole('created', input.name, false), name: input.name };
    platformRoles = [...platformRoles, created];
    return Promise.resolve(created);
  });
});
afterEach(() => {
  vi.useRealTimers();
  resetUsersRoutes();
  resetClinicFixtures();
  resetClinicAccessFixture();
});

describe('RolesAccess — the role list and page (users.md:42–77)', () => {
  it('opens on Front desk: its people, the nine matrix rows and the eleven switches', async () => {
    const { container } = renderRoles();
    const page = await rolePage();
    expect(within(page).getByRole('heading', { name: 'Front desk' })).toBeInTheDocument();
    expect(screen.getByTestId('users-roles-item-front_desk')).toHaveAttribute(
      'aria-current',
      'true',
    );
    // The eight contract roles, then the organisation's custom role (Owner is never listed).
    expect(screen.getAllByTestId(/^users-roles-item-/)).toHaveLength(9);
    const people = within(page).getAllByTestId('users-role-person');
    expect(people.map((pill) => pill.textContent)).toEqual([
      'RSRiya Shah+ Admin',
      'FKForam Kanpariya+ Counsellor',
    ]);
    expect(within(page).getAllByRole('row')).toHaveLength(10);
    expect(box('leads', 'view')).toHaveAttribute('aria-checked', 'true');
    expect(box('leads', 'view')).toHaveAccessibleName('Front desk can view · Leads');
    expect(box('medical', 'view')).toHaveAttribute('aria-checked', 'false');
    expect(within(page).getAllByRole('switch')).toHaveLength(11);
    expect(
      within(page).getByText(
        'Changes apply right away to everyone with this role. Someone with two roles gets everything either role allows.',
      ),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('writes a box at once and keeps the rules: View off clears the row, the Row pill fills it', async () => {
    const user = userEvent.setup();
    renderRoles();
    await rolePage();
    await user.click(box('leads', 'delete'));
    expect(box('leads', 'delete')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('users-role-matrix-leads-row')).toHaveTextContent('Full');

    await user.click(box('leads', 'view'));
    for (const action of ['view', 'create', 'edit', 'delete']) {
      expect(box('leads', action)).toHaveAttribute('aria-checked', 'false');
    }
    expect(screen.getByTestId('users-role-matrix-leads-row')).toHaveTextContent('None');

    await user.click(box('medical', 'edit'));
    expect(box('medical', 'view')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('users-role-matrix-medical-row')).toHaveTextContent('Some');

    await user.click(screen.getByTestId('users-role-matrix-medical-row'));
    expect(box('medical', 'delete')).toHaveAttribute('aria-checked', 'true');
    expect(notifyMock.error).not.toHaveBeenCalled();
  });

  it('rolls a refused write back with the save-error toast', async () => {
    const user = userEvent.setup();
    renderRoles();
    await rolePage();
    matrixWrites.refuse = true;
    await user.click(box('medical', 'view'));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    await waitFor(() =>
      expect(box('medical', 'view')).toHaveAttribute('aria-checked', 'false'),
    );
  });

  it('flips a special permission at once', async () => {
    const user = userEvent.setup();
    renderRoles();
    await rolePage();
    const floor = screen.getByTestId('users-role-ability-floor');
    expect(floor).toHaveAttribute('aria-checked', 'false');
    await user.click(floor);
    expect(floor).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByTestId('users-role-ability-dayclose'));
    expect(screen.getByTestId('users-role-ability-dayclose')).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('copies another role’s access and says so', async () => {
    const user = userEvent.setup();
    renderRoles();
    await rolePage();
    await user.click(screen.getByTestId('users-role-copy'));
    await user.click(await screen.findByTestId('users-role-copy-option-pharmacist'));
    await waitFor(() =>
      expect(box('medical', 'view')).toHaveAttribute('aria-checked', 'true'),
    );
    expect(box('leads', 'view')).toHaveAttribute('aria-checked', 'false');
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Front desk now has the same access as Pharmacist',
    );
  });

  it('opens a holder’s drawer with the page kept behind it', async () => {
    const user = userEvent.setup();
    const { router } = renderRoles('/organization/acme/users/roles?role=doctor');
    const page = await rolePage();
    expect(within(page).getByRole('heading', { name: 'Doctor' })).toBeInTheDocument();
    await user.click(within(page).getByTestId('users-role-person'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/organization/acme/users/mbr_reenal/edit',
      ),
    );
    expect(router.state.location.search).toEqual({ from: 'roles', role: 'doctor' });
  });

  it('previews the app as the role, never as Admin', async () => {
    const user = userEvent.setup();
    renderRoles('/organization/acme/users/roles?role=counsellor');
    const page = await rolePage();
    await user.click(within(page).getByTestId('users-role-preview'));
    expect(useUIStore.getState().previewRole).toBe('counsellor');
    expect(notifyMock.success).toHaveBeenCalledWith(
      `Previewing ${PRODUCT_NAME} as Counsellor`,
    );
  });

  it('previews a custom role too — by its clinozy-be id (L-31e)', async () => {
    const user = userEvent.setup();
    renderRoles(`/organization/acme/users/roles?role=${PLATFORM_ROLES.senior.id}`);
    const page = await rolePage();
    await user.click(within(page).getByTestId('users-role-preview'));
    expect(useUIStore.getState().previewRole).toBe(PLATFORM_ROLES.senior.id);
    expect(notifyMock.success).toHaveBeenCalledWith(
      `Previewing ${PRODUCT_NAME} as Senior desk`,
    );
  });
});

describe('RolesAccess — who may change what (Q-U6, D47)', () => {
  it('locks Admin: every box says why, nothing changes, no preview', async () => {
    const user = userEvent.setup();
    renderRoles('/organization/acme/users/roles?role=admin');
    const page = await rolePage();
    await user.click(box('leads', 'delete'));
    expect(notifyMock.info).toHaveBeenCalledWith('Admins always have full access');
    expect(box('leads', 'delete')).toHaveAttribute('aria-checked', 'true');
    expect(box('leads', 'delete')).toHaveAttribute('aria-disabled', 'true');
    expect(within(page).getByTestId('users-role-preview')).toBeDisabled();
    expect(within(page).queryByTestId('users-role-copy')).toBeNull();
    expect(
      within(page).getByText('Admins can do everything · this role can’t be narrowed.'),
    ).toBeInTheDocument();
  });

  it('reads only without "Change roles & access" — boxes, switches and New role', async () => {
    const user = userEvent.setup();
    renderRoles(
      '/organization/acme/users/roles',
      USERS_ADMIN_CODES.filter((code) => code !== 'role:manage'),
    );
    const page = await rolePage();
    await user.click(box('leads', 'delete'));
    expect(notifyMock.info).toHaveBeenCalledWith('You can’t change roles · ask an admin');
    expect(box('leads', 'delete')).toHaveAttribute('aria-checked', 'false');
    await user.click(within(page).getByTestId('users-role-ability-floor'));
    expect(within(page).getByTestId('users-role-ability-floor')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(within(page).queryByTestId('users-role-copy')).toBeNull();
    await user.click(screen.getByTestId('users-roles-new-role'));
    expect(notifyMock.info).toHaveBeenCalledWith('You can’t add roles · ask an admin');
    expect(api.createRole).not.toHaveBeenCalled();
  });

  it('writes a custom role’s Users row to its clinozy-be codes (D17)', async () => {
    const user = userEvent.setup();
    renderRoles(`/organization/acme/users/roles?role=${PLATFORM_ROLES.senior.id}`);
    await rolePage();
    await waitFor(() =>
      expect(api.getRolePermissions).toHaveBeenCalledWith(PLATFORM_ROLES.senior.id),
    );
    await user.click(box('users', 'view'));
    await waitFor(() =>
      expect(api.updateRole).toHaveBeenCalledWith({
        id: PLATFORM_ROLES.senior.id,
        name: 'Senior desk',
        description: '',
        permissions: ['organization:read', 'membership:read', 'role:read'],
      }),
    );
    expect(box('users', 'view')).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps the Users row of a role bound to a clinozy-be system role read-only', async () => {
    const user = userEvent.setup();
    platformRoles = [...platformRoles, platformRole('doctor', 'Doctor', true)];
    renderRoles('/organization/acme/users/roles?role=doctor');
    await rolePage();
    await user.click(box('users', 'view'));
    expect(notifyMock.info).toHaveBeenCalledWith(
      `${PRODUCT_NAME} keeps this role’s Users access · it can’t be changed here`,
    );
    expect(api.updateRole).not.toHaveBeenCalled();
    expect(box('users', 'view')).toHaveAttribute('aria-disabled', 'true');
    // Its clinic rows stay the fixture's, and writable.
    await user.click(box('medical', 'view'));
    expect(box('medical', 'view')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('RolesAccess — Settings’ role dialog, relocated (D17)', () => {
  const SENIOR = `/organization/acme/users/roles?role=${PLATFORM_ROLES.senior.id}`;

  it('gives a custom role a workspace permission the viewer holds', async () => {
    const user = userEvent.setup();
    renderRoles(SENIOR, [...USERS_ADMIN_CODES, 'webhook:manage']);
    const page = await rolePage();
    const workspace = await within(page).findByTestId('users-role-workspace');
    // The catalog's codes the matrix doesn't map — only those the viewer holds.
    expect(
      within(workspace)
        .getAllByRole('switch')
        .map((card) => card.textContent),
    ).toEqual(['View Organization', 'Manage Webhooks']);
    expect(
      within(workspace).getByTestId('users-role-code-organization:read'),
    ).toHaveAttribute('aria-checked', 'true');
    const webhooks = within(workspace).getByTestId('users-role-code-webhook:manage');
    expect(webhooks).toHaveAttribute('aria-checked', 'false');
    expect(webhooks).toHaveAttribute('title', 'webhook:manage');

    await user.click(webhooks);
    await waitFor(() =>
      expect(api.updateRole).toHaveBeenCalledWith({
        id: PLATFORM_ROLES.senior.id,
        name: 'Senior desk',
        description: '',
        permissions: ['organization:read', 'webhook:manage'],
      }),
    );
    expect(webhooks).toHaveAttribute('aria-checked', 'true');
  });

  it('reads the workspace permissions only, without "Change roles & access"', async () => {
    const user = userEvent.setup();
    renderRoles(
      SENIOR,
      USERS_ADMIN_CODES.filter((code) => code !== 'role:manage'),
    );
    const card = await screen.findByTestId('users-role-code-organization:read');
    expect(card).toHaveAttribute('aria-disabled', 'true');
    await user.click(card);
    expect(notifyMock.info).toHaveBeenCalledWith('You can’t change roles · ask an admin');
    expect(api.updateRole).not.toHaveBeenCalled();
  });

  it('keeps a system-bound role’s workspace permissions the platform’s', async () => {
    const user = userEvent.setup();
    platformRoles = [...platformRoles, platformRole('doctor', 'Doctor', true)];
    renderRoles('/organization/acme/users/roles?role=doctor');
    const card = await screen.findByTestId('users-role-code-organization:read');
    await user.click(card);
    expect(notifyMock.info).toHaveBeenCalledWith(
      `${PRODUCT_NAME} keeps this role’s workspace permissions · they can’t be changed here`,
    );
    expect(api.updateRole).not.toHaveBeenCalled();
  });

  it('shows no workspace permissions for a role clinozy-be doesn’t back', async () => {
    renderRoles('/organization/acme/users/roles?role=front_desk');
    const page = await rolePage();
    expect(within(page).queryByTestId('users-role-workspace')).toBeNull();
    expect(within(page).queryByText('Workspace permissions')).toBeNull();
  });

  it('describes a custom role in place — an emptied box is the default', async () => {
    const user = userEvent.setup();
    renderRoles(SENIOR);
    const page = await rolePage();
    const description = within(page).getByTestId('users-role-description');
    expect(description).toHaveValue('');
    expect(description).toHaveAttribute(
      'placeholder',
      'Custom role · set what it can do below',
    );
    await user.type(description, 'Runs the evening desk{Enter}');
    await waitFor(() =>
      expect(api.updateRole).toHaveBeenCalledWith({
        id: PLATFORM_ROLES.senior.id,
        name: 'Senior desk',
        description: 'Runs the evening desk',
        permissions: ['organization:read'],
      }),
    );
  });

  it('shows a custom role’s own description to a viewer who can’t edit it', async () => {
    platformRoles = platformRoles.map((role) =>
      role.id === PLATFORM_ROLES.senior.id
        ? { ...role, description: 'Runs the evening desk' }
        : role,
    );
    renderRoles(
      SENIOR,
      USERS_ADMIN_CODES.filter((code) => code !== 'role:manage'),
    );
    const page = await rolePage();
    expect(await within(page).findByText('Runs the evening desk')).toBeInTheDocument();
    expect(within(page).queryByTestId('users-role-description')).toBeNull();
  });
});

describe('RolesAccess — new, renamed and deleted roles', () => {
  it('adds "New role" with no access, selects it and names it in place', async () => {
    const user = userEvent.setup();
    const { router } = renderRoles();
    await rolePage();
    await user.click(screen.getByTestId('users-roles-new-role'));
    await waitFor(() =>
      expect(api.createRole).toHaveBeenCalledWith({
        name: 'New role',
        description: 'Custom role',
        permissions: ['organization:read'],
      }),
    );
    const created = platformRole('created', 'New role', false).id;
    await waitFor(() => expect(router.state.location.search).toEqual({ role: created }));
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Role added · name it and pick what it can do',
    );
    const name = await screen.findByTestId('users-role-name');
    expect(name).toHaveValue('New role');
    expect(box('leads', 'view')).toHaveAttribute('aria-checked', 'false');

    await user.clear(name);
    await user.type(name, 'Senior desk{Enter}');
    expect(notifyMock.error).toHaveBeenCalledWith(
      'A role called Senior desk already exists',
    );
    expect(api.updateRole).not.toHaveBeenCalled();

    await user.clear(name);
    await user.type(name, 'Night desk{Enter}');
    await waitFor(() =>
      expect(api.updateRole).toHaveBeenCalledWith(
        expect.objectContaining({ id: created, name: 'Night desk' }),
      ),
    );
  });

  it('deletes a custom role nobody holds after the Undo window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderRoles(`/organization/acme/users/roles?role=${PLATFORM_ROLES.senior.id}`);
    const page = await rolePage();
    await user.click(within(page).getByTestId('users-role-delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete Senior desk?')).toBeInTheDocument();
    expect(await axeForDialog(dialog)).toHaveNoViolations();
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(
        screen.queryByTestId(`users-roles-item-${PLATFORM_ROLES.senior.id}`),
      ).toBeNull(),
    );
    expect(api.deleteRole).not.toHaveBeenCalled();
    // The Undo window is the shared 10s, not the deferred default's 5s.
    await vi.advanceTimersByTimeAsync(9_000);
    expect(api.deleteRole).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    await waitFor(() =>
      expect(api.deleteRole).toHaveBeenCalledWith(PLATFORM_ROLES.senior.id),
    );
  });

  it('offers no delete for a contract role', async () => {
    renderRoles('/organization/acme/users/roles?role=marketing');
    const page = await rolePage();
    expect(within(page).getByRole('heading', { name: 'Marketing' })).toBeInTheDocument();
    expect(within(page).queryByTestId('users-role-delete')).toBeNull();
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
    await user.click(screen.getByTestId('users-roles-item-doctor'));
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
