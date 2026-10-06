import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { CreateRoleDialog } from './CreateRoleDialog.tsx';

const { createRoleMutate, updateRoleMutate, useRolePermissionsMock } = vi.hoisted(() => ({
  createRoleMutate: vi.fn(),
  updateRoleMutate: vi.fn(),
  useRolePermissionsMock: vi.fn(() => ({ data: undefined, isSuccess: false })),
}));
vi.mock('@/shared/hooks/useRoles/index.ts', () => ({
  useCreateRole: () => ({ mutateAsync: createRoleMutate, isPending: false }),
  useUpdateRole: () => ({ mutateAsync: updateRoleMutate, isPending: false }),
  useRolePermissions: useRolePermissionsMock,
}));
// The permission picker now reads clinozy-be's catalog (`GET /tenancy/permissions`) intersected
// with what the caller holds, instead of a hardcoded client list. Stub the hook so these
// tests stay about the dialog rather than the fetch.
const { useAssignablePermissionsMock } = vi.hoisted(() => ({
  useAssignablePermissionsMock: vi.fn(() => ({
    rows: [
      { code: 'organization:read', name: 'View Organization', category: 'tenancy' },
      { code: 'membership:read', name: 'View Members', category: 'tenancy' },
      { code: 'membership:manage', name: 'Manage Members', category: 'tenancy' },
      { code: 'invitation:manage', name: 'Manage Invitations', category: 'tenancy' },
      { code: 'webhook:manage', name: 'Manage Webhooks', category: 'notify' },
    ],
    isPending: false,
    isError: false,
  })),
}));
vi.mock('@/shared/hooks/useAssignablePermissions/index.ts', () => ({
  useAssignablePermissions: useAssignablePermissionsMock,
}));

const EDIT_ROLE: RoleSummary = {
  id: 'rol_x',
  name: 'Member',
  description: 'Everyday access',
  permissions: ['membership:read'],
  memberCount: 3,
  isSystem: false,
};

/** Mounts the trigger (the drawer's dirty guard needs the router) and opens the drawer. */
async function open() {
  const view = renderWithProviders(<CreateRoleDialog />);
  const user = userEvent.setup();
  await user.click(await screen.findByTestId('role-create-open'));
  await screen.findByTestId('role-create-form');
  return { user, view };
}

/**
 * The edit drawer, with a way to re-render it as a refetch landing would (its
 * hooks re-run). The button sits outside the modal, so it is pressed with
 * `fireEvent` — a pointer cannot reach it past the drawer.
 */
function RoleEditHarness() {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  return (
    <>
      <button type="button" data-testid="refetch-lands" onClick={rerender}>
        Refetch
      </button>
      <CreateRoleDialog role={EDIT_ROLE} open onOpenChange={() => {}} />
    </>
  );
}

describe('CreateRoleDialog', () => {
  it('opens a form with name, description, and a permission checklist', async () => {
    await open();
    expect(screen.getByTestId('role-create-name')).toBeInTheDocument();
    expect(screen.getByTestId('role-create-description')).toBeInTheDocument();
    expect(screen.getByTestId('role-perm-membership:manage')).toBeInTheDocument();
    expect(screen.getByTestId('role-perm-invitation:manage')).toBeInTheDocument();
  });

  it('blocks submit until at least one permission is selected', async () => {
    const { user } = await open();

    await user.type(screen.getByTestId('role-create-name'), 'Member');
    await user.type(screen.getByTestId('role-create-description'), 'Everyday access');
    await user.click(screen.getByTestId('role-create-submit'));

    expect(await screen.findByText(/at least one permission/i)).toBeInTheDocument();
    expect(createRoleMutate).not.toHaveBeenCalled();
  });

  it('creates a role with the chosen name, description, and permissions', async () => {
    createRoleMutate.mockResolvedValueOnce({ id: 'rol_x', name: 'Member' });
    const { user } = await open();

    await user.type(screen.getByTestId('role-create-name'), 'Member');
    await user.type(screen.getByTestId('role-create-description'), 'Everyday access');
    await user.click(screen.getByTestId('role-perm-membership:read'));
    await user.click(screen.getByTestId('role-create-submit'));

    await waitFor(() =>
      expect(createRoleMutate).toHaveBeenCalledWith({
        name: 'Member',
        description: 'Everyday access',
        permissions: ['membership:read'],
      }),
    );
  });

  it('has no accessibility violations', async () => {
    const { view } = await open();
    expect(await axeForDialog(view.baseElement)).toHaveNoViolations();
  });

  it('is a child drawer stacked on Settings › Roles: named, Back returns, the name focused', async () => {
    const { user } = await open();

    const drawer = screen.getByTestId('role-create-dialog');
    expect(screen.getByRole('dialog', { name: 'Create a role' })).toBe(drawer);
    const submit = screen.getByTestId('role-create-submit');
    expect(submit).toHaveTextContent('Create role');
    // It submits the form, so Enter in the name saves too.
    expect(submit).toHaveAttribute('form', screen.getByTestId('role-create-form').id);
    await waitFor(() => expect(screen.getByTestId('role-create-name')).toHaveFocus());

    const back = screen.getByTestId('role-create-dialog-dismiss');
    expect(back).toHaveTextContent('Back');
    await user.click(back);
    await waitFor(() =>
      expect(screen.queryByTestId('role-create-dialog')).not.toBeInTheDocument(),
    );
  });

  it('edits an existing role: pre-filled and saves via updateRole', async () => {
    // Regression: roles could be created + deleted but not EDITED.
    // The list omits permissions, so the dialog fetches the real grants to
    // pre-fill — otherwise a save would wipe them.
    useRolePermissionsMock.mockReturnValue({
      data: ['membership:read'],
      isSuccess: true,
    });
    updateRoleMutate.mockResolvedValueOnce(EDIT_ROLE);
    const user = userEvent.setup();
    renderWithProviders(
      <CreateRoleDialog role={EDIT_ROLE} open onOpenChange={vi.fn()} />,
    );

    const form = await screen.findByTestId('role-create-form');
    expect(form).toBeInTheDocument();
    // Pre-filled from the role.
    expect(screen.getByTestId('role-create-name')).toHaveValue('Member');
    // Pre-filled from the fetched permissions (checkbox reflects the grant).
    await waitFor(() =>
      expect(screen.getByTestId('role-perm-membership:read')).toHaveAttribute(
        'data-state',
        'checked',
      ),
    );
    // Add a permission and save.
    await user.click(screen.getByTestId('role-perm-membership:manage'));
    await user.click(screen.getByTestId('role-create-submit'));

    await waitFor(() =>
      expect(updateRoleMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'rol_x',
          name: 'Member',
          permissions: expect.arrayContaining(['membership:read', 'membership:manage']),
        }),
      ),
    );
  });

  // ── SET-10: pre-fill once, on the success transition ──────────────────────

  it('shows a skeleton instead of an all-unchecked checklist while grants load', async () => {
    // Regression: the list row carries no permissions, so the edit form opened
    // with every box unchecked and then visibly ticked itself.
    useRolePermissionsMock.mockReturnValue({ data: undefined, isSuccess: false });
    renderWithProviders(
      <CreateRoleDialog role={EDIT_ROLE} open onOpenChange={() => {}} />,
    );

    const loading = await screen.findByTestId('role-edit-loading');
    expect(screen.queryByTestId('role-perm-membership:read')).not.toBeInTheDocument();
    expect(screen.getByTestId('role-create-submit')).toBeDisabled();
    // The design's flat bars (`_patterns.md:282`), not a pulse.
    expect(loading.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
    expect(loading.querySelector('.animate-pulse')).toBeNull();
  });

  it('keeps in-progress edits when the permissions query refetches', async () => {
    // The permissions key is a DESCENDANT of the roles prefix, so ANY other role
    // mutation invalidates it. Keying the pre-fill on `data` re-ran reset() on
    // every refetch and wiped whatever the user had typed.
    const user = userEvent.setup();
    useRolePermissionsMock.mockReturnValue({
      data: ['membership:read'],
      isSuccess: true,
    });
    renderWithProviders(<RoleEditHarness />);

    const name = await screen.findByTestId('role-create-name');
    await user.clear(name);
    await user.type(name, 'Editor');
    await user.click(screen.getByTestId('role-perm-invitation:manage'));

    // A refetch lands: same values, brand-new array identity.
    useRolePermissionsMock.mockReturnValue({
      data: ['membership:read'],
      isSuccess: true,
    });
    fireEvent.click(screen.getByTestId('refetch-lands'));

    await waitFor(() =>
      expect(screen.getByTestId('role-create-name')).toHaveValue('Editor'),
    );
    expect(screen.getByTestId('role-perm-invitation:manage')).toBeChecked();
  });

  // The catalog is fetched now, so the picker has two states it never had when the list was
  // a hardcoded constant. Neither may render as "no permissions to grant".
  it('says the permission list is loading rather than showing an empty picker', async () => {
    useAssignablePermissionsMock.mockReturnValue({
      rows: [],
      isPending: true,
      isError: false,
    });
    await open();

    expect(screen.queryByTestId('role-perm-membership:manage')).not.toBeInTheDocument();
    expect(screen.getByText(/loading permissions/i)).toBeInTheDocument();
  });

  it('reports a failed catalog fetch instead of an empty picker', async () => {
    useAssignablePermissionsMock.mockReturnValue({
      rows: [],
      isPending: false,
      isError: true,
    });
    await open();

    expect(screen.getByRole('alert')).toHaveTextContent(/permission list/i);
  });
});
