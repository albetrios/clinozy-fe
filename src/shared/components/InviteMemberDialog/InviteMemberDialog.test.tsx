import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { InviteMemberDialog } from './InviteMemberDialog.tsx';

const { inviteMutate, useRolesMock } = vi.hoisted(() => ({
  inviteMutate: vi.fn(),
  useRolesMock: vi.fn(),
}));
vi.mock('@/shared/hooks/useInvitations/index.ts', () => ({
  useInviteMember: () => ({ mutateAsync: inviteMutate, isPending: false }),
}));
vi.mock('@/shared/hooks/useRoles/index.ts', () => ({
  useRoles: useRolesMock,
}));

function role(id: string, name: string): RoleSummary {
  return {
    id,
    name,
    description: '',
    permissions: [],
    memberCount: 0,
    isSystem: name === 'Owner',
    isLocked: false,
    tone: 'sky',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function rolesResult(rows: RoleSummary[], isPending = false) {
  return {
    rows,
    isPending,
    isError: false,
    isFetching: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  };
}

/** Mounts the trigger (the drawer's dirty guard needs the router) and opens the drawer. */
async function open() {
  renderWithProviders(<InviteMemberDialog />);
  const user = userEvent.setup();
  await user.click(await screen.findByTestId('invite-member-open'));
  return user;
}

/**
 * The drawer with a way to re-render it as a refetch landing would. The button
 * sits outside the modal, so it is pressed with `fireEvent`.
 */
function InviteHarness() {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  return (
    <>
      <button type="button" data-testid="refetch-lands" onClick={rerender}>
        Refetch
      </button>
      <InviteMemberDialog />
    </>
  );
}

describe('InviteMemberDialog', () => {
  it('is a child drawer stacked on Settings › Members: named, Back returns, the email focused', async () => {
    useRolesMock.mockReturnValue(
      rolesResult([role('rol_owner', 'Owner'), role('rol_mem', 'Member')]),
    );
    const user = await open();

    const drawer = await screen.findByTestId('invite-member-dialog');
    expect(screen.getByRole('dialog', { name: 'Invite a member' })).toBe(drawer);
    const submit = screen.getByTestId('invite-member-submit');
    expect(submit).toHaveTextContent('Send invitation');
    // It submits the form, so Enter in the email sends too.
    expect(submit).toHaveAttribute('form', screen.getByTestId('invite-member-form').id);
    await waitFor(() => expect(screen.getByTestId('invite-member-email')).toHaveFocus());
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    const back = screen.getByTestId('invite-member-dialog-dismiss');
    expect(back).toHaveTextContent('Back');
    await user.click(back);
    await waitFor(() =>
      expect(screen.queryByTestId('invite-member-dialog')).not.toBeInTheDocument(),
    );
  });

  it('offers only Back while there is no role to assign', async () => {
    useRolesMock.mockReturnValue(rolesResult([role('rol_owner', 'Owner')]));
    await open();

    expect(await screen.findByTestId('invite-member-no-roles')).toBeInTheDocument();
    expect(screen.getByTestId('invite-member-dialog-dismiss')).toHaveTextContent('Back');
    expect(screen.queryByTestId('invite-member-submit')).not.toBeInTheDocument();
  });

  it('submits the email + the picked role as role_ids (the org has real roles)', async () => {
    // Regression: the form used to submit a hardcoded role NAME to a
    // non-existent /invitations endpoint. It must post real role ids.
    useRolesMock.mockReturnValue(
      rolesResult([role('rol_owner', 'Owner'), role('rol_mem', 'Member')]),
    );
    inviteMutate.mockResolvedValueOnce({ email: 'new@x.test' });
    const user = await open();

    await screen.findByTestId('invite-member-form');
    await user.type(screen.getByTestId('invite-member-email'), 'new@x.test');
    await user.click(screen.getByTestId('invite-member-role'));
    await user.click(await screen.findByRole('option', { name: 'Member' }));
    await user.click(screen.getByTestId('invite-member-submit'));

    await waitFor(() =>
      expect(inviteMutate).toHaveBeenCalledWith({
        email: 'new@x.test',
        roleIds: ['rol_mem'],
      }),
    );
  });

  it('excludes the Owner role from the invite options', async () => {
    useRolesMock.mockReturnValue(
      rolesResult([role('rol_owner', 'Owner'), role('rol_mem', 'Member')]),
    );
    const user = await open();
    await user.click(await screen.findByTestId('invite-member-role'));

    expect(await screen.findByRole('option', { name: 'Member' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument();
  });

  it('guides the user to create a role when only Owner exists', async () => {
    useRolesMock.mockReturnValue(rolesResult([role('rol_owner', 'Owner')]));
    await open();

    expect(await screen.findByTestId('invite-member-no-roles')).toBeInTheDocument();
    expect(screen.queryByTestId('invite-member-form')).not.toBeInTheDocument();
  });

  it('shows a loading state while roles are fetching', async () => {
    useRolesMock.mockReturnValue(rolesResult([], true));
    await open();

    expect(await screen.findByTestId('invite-member-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('invite-member-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('invite-member-no-roles')).not.toBeInTheDocument();
  });

  // ── SET-11: a failed roles fetch is not "you have no roles" ───────────────

  it('offers a retry when the roles fetch fails, not "go create a role"', async () => {
    // Regression: the else branch caught isError too, so a network failure told
    // the user to create a role that already exists.
    const refetch = vi.fn();
    const user = userEvent.setup();
    useRolesMock.mockReturnValue({
      ...rolesResult([]),
      isError: true,
      refetch,
    });
    renderWithProviders(<InviteMemberDialog />);
    await user.click(await screen.findByTestId('invite-member-open'));

    expect(await screen.findByTestId('invite-member-roles-error')).toBeInTheDocument();
    expect(screen.queryByTestId('invite-member-no-roles')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('retry-button'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('still guides the user when the fetch SUCCEEDS with no assignable role', async () => {
    const user = userEvent.setup();
    useRolesMock.mockReturnValue(rolesResult([role('rol_owner', 'Owner')]));
    renderWithProviders(<InviteMemberDialog />);
    await user.click(await screen.findByTestId('invite-member-open'));

    expect(await screen.findByTestId('invite-member-no-roles')).toBeInTheDocument();
    expect(screen.queryByTestId('invite-member-roles-error')).not.toBeInTheDocument();
  });

  // ── No default role ──────────────────────────────────────────────────────

  it('opens on no role, not on whatever the roster sorts first', async () => {
    // Regression: the field defaulted to `invitableRoles[0]`, and every clinic
    // this app provisions sorts `Admin` first — so the quiet path through the
    // dialog handed a new teammate admin rights. The presets each carry a clinic
    // job, so the inviter picks one.
    useRolesMock.mockReturnValue(
      rolesResult([role('rol_admin', 'Admin'), role('rol_doc', 'Doctor')]),
    );
    await open();

    const trigger = await screen.findByTestId('invite-member-role');
    expect(trigger).not.toHaveTextContent('Admin');
    expect(trigger).not.toHaveTextContent('Doctor');
  });

  it('preselects nothing — and says so — when only custom roles exist', async () => {
    // A custom role carries no permission set here to rank it by, so guessing
    // one would be a blind privilege grant. The inviter chooses instead, and a
    // send with nothing chosen has to SAY that rather than silently do nothing.
    const user = userEvent.setup();
    useRolesMock.mockReturnValue(
      rolesResult([role('rol_a', 'Support'), role('rol_b', 'Editor')]),
    );
    renderWithProviders(<InviteMemberDialog />);
    await user.click(await screen.findByTestId('invite-member-open'));
    await screen.findByTestId('invite-member-form');

    const roleTrigger = screen.getByTestId('invite-member-role');
    expect(roleTrigger).not.toHaveTextContent('Support');
    expect(roleTrigger).not.toHaveTextContent('Editor');

    await user.type(screen.getByTestId('invite-member-email'), 'new@x.test');
    await user.click(screen.getByTestId('invite-member-submit'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Select a role');
    expect(roleTrigger).toHaveAttribute('aria-invalid', 'true');
    expect(inviteMutate).not.toHaveBeenCalled();
  });

  it('never overwrites a role the user already picked', async () => {
    // The default effect re-runs whenever the first role id changes; a refetch
    // that reorders the list used to reset the field under the user.
    const user = userEvent.setup();
    useRolesMock.mockReturnValue(
      rolesResult([role('rol_a', 'Support'), role('rol_b', 'Editor')]),
    );
    renderWithProviders(<InviteHarness />);
    await user.click(await screen.findByTestId('invite-member-open'));
    await screen.findByTestId('invite-member-role');

    await user.click(screen.getByTestId('invite-member-role'));
    await user.click(await screen.findByRole('option', { name: 'Editor' }));
    expect(screen.getByTestId('invite-member-role')).toHaveTextContent('Editor');

    // A refetch brings a NEW first role — on the unfixed build the effect fires
    // again and replaces the user's choice with it.
    useRolesMock.mockReturnValue(
      rolesResult([
        role('rol_c', 'Ops'),
        role('rol_a', 'Support'),
        role('rol_b', 'Editor'),
      ]),
    );
    fireEvent.click(screen.getByTestId('refetch-lands'));

    await waitFor(() =>
      expect(screen.getByTestId('invite-member-role')).toHaveTextContent('Editor'),
    );
  });
});
