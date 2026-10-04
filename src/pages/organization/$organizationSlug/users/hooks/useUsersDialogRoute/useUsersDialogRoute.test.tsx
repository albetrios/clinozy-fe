import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';

import {
  renderUsersRoutes,
  resetUsersRoutes,
} from '../../__tests__/integration/users-test-router.tsx';
import { useUsersDialogRoute } from './useUsersDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const REENAL = { membershipId: 'mbr_reenal', name: 'Dr. Reenal Chaniyara' } as TeamMember;

/** The page under test: what the hook says, as text. */
function probe(team: { members: TeamMember[]; isPending: boolean }, canInvite = true) {
  return function Probe() {
    const { dialog } = useUsersDialogRoute(team, { canInvite, accessResolved: true });
    const member = dialog.kind === 'edit' ? (dialog.member?.name ?? 'loading') : '';
    return (
      <output>
        {dialog.kind}
        {member ? `:${member}` : ''}
      </output>
    );
  };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});
afterEach(() => resetUsersRoutes());

describe('useUsersDialogRoute (KICKOFF §4, D24)', () => {
  it('reads no dialog on the Team itself', async () => {
    renderUsersRoutes(
      '/organization/acme/users',
      probe({ members: [], isPending: false }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('none');
  });

  it('opens New user on users/create', async () => {
    renderUsersRoutes(
      '/organization/acme/users/create',
      probe({ members: [], isPending: false }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('create');
  });

  it('opens the member on users/$userId/edit — loading until the Team has answered', async () => {
    const { unmount } = renderUsersRoutes(
      '/organization/acme/users/mbr_reenal/edit',
      probe({ members: [], isPending: true }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('edit:loading');
    unmount();
    renderUsersRoutes(
      '/organization/acme/users/mbr_reenal/edit',
      probe({ members: [REENAL], isPending: false }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'edit:Dr. Reenal Chaniyara',
    );
  });

  it('leaves a dead member link for the Team with "User not found"', async () => {
    const { router } = renderUsersRoutes(
      '/organization/acme/users/mbr_gone/edit',
      probe({ members: [REENAL], isPending: false }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users'),
    );
    expect(notifyMock.info).toHaveBeenCalledWith(
      'User not found · it may have been deleted',
    );
  });

  it('returns a dead member link opened from a role page to that role', async () => {
    function FromRoles() {
      useUsersDialogRoute(
        { members: [REENAL], isPending: false },
        { canInvite: true, accessResolved: true, from: 'roles', role: 'doctor' },
      );
      return null;
    }
    const { router } = renderUsersRoutes(
      '/organization/acme/users/mbr_gone/edit?from=roles&role=doctor',
      FromRoles,
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users/roles'),
    );
    expect(router.state.location.search).toEqual({ role: 'doctor' });
  });

  it('sends a create link back with the permission toast to a member who may not invite', async () => {
    const { router } = renderUsersRoutes(
      '/organization/acme/users/create?q=riya',
      probe({ members: [], isPending: false }, false),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users'),
    );
    expect(router.state.location.search).toEqual({ q: 'riya' });
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
  });
});
