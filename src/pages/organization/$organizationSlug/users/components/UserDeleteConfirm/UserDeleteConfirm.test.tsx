import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { UserDeleteConfirm } from './UserDeleteConfirm.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const scheduled = vi.hoisted(() => ({ schedule: vi.fn() }));
vi.mock('@/shared/hooks/useDeferredRowRemoval/index.ts', () => ({
  useDeferredRowRemoval: () => scheduled.schedule,
}));

const writes = vi.hoisted(() => ({
  removeMember: vi.fn(),
  revokeInvitation: vi.fn(),
  removeProfile: vi.fn(),
}));
vi.mock('@/shared/hooks/useMembers/index.ts', () => ({
  useRemoveMember: () => ({ mutateAsync: writes.removeMember }),
}));
vi.mock('@/shared/hooks/useInvitations/index.ts', () => ({
  useRevokeInvitation: () => ({ mutateAsync: writes.revokeInvitation }),
}));
vi.mock('@/shared/hooks/useTeam/index.ts', () => ({
  useRemoveStaffProfile: () => ({ mutateAsync: writes.removeProfile }),
}));

function teamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    membershipId: 'mbr_reenal',
    userId: 'usr_reenal',
    email: 'reenal@cresence.skin',
    status: 'active',
    invitation: null,
    platformRoleId: 'rol_member',
    platformRoleName: 'Member',
    joinedAt: '2026-09-01T10:00:00.000Z',
    isOwner: false,
    isSelf: false,
    name: 'Dr. Reenal Chaniyara',
    initials: 'RC',
    tone: 'lav',
    roleKeys: ['doctor'],
    seq: 11,
    phone: null,
    branchIds: [],
    presence: 'away',
    lastActiveAt: null,
    profile: { id: 'stf_reenal' } as TeamMember['profile'],
    ...overrides,
  };
}

beforeEach(() => {
  scheduled.schedule.mockReset();
  for (const fn of Object.values(writes)) fn.mockReset();
});

describe('UserDeleteConfirm (users.md:238–252)', () => {
  it('asks "Delete this user?" with the name — or the drawer’s summary — in the pill', async () => {
    renderWithProviders(
      <UserDeleteConfirm
        target={{ member: teamMember(), record: 'Dr. Reenal Chaniyara · Doctor' }}
        onClose={vi.fn()}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this user?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Dr. Reenal Chaniyara · Doctor',
    );
    expect(await axeForDialog(dialog)).toHaveNoViolations();
  });

  it('schedules the removal behind a 10s Undo — membership, then the profile with the reason', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    renderWithProviders(
      <UserDeleteConfirm
        target={{ member: teamMember() }}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-not-needed'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(scheduled.schedule).toHaveBeenCalledTimes(1));
    expect(onDeleted).toHaveBeenCalled();
    const [input] = scheduled.schedule.mock.calls[0] as [
      {
        id: string;
        pendingMessage: string;
        delayMs: number;
        commit: () => Promise<void>;
      },
    ];
    expect(input).toMatchObject({
      id: 'mbr_reenal',
      pendingMessage: 'Dr. Reenal Chaniyara removed',
      delayMs: 10_000,
    });
    expect(writes.removeMember).not.toHaveBeenCalled();
    await input.commit();
    expect(writes.removeMember).toHaveBeenCalledWith('mbr_reenal');
    expect(writes.removeProfile).toHaveBeenCalledWith({
      id: 'stf_reenal',
      reason: 'not_needed',
      note: null,
    });
  });

  it('cancels an invited member’s invitation instead', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <UserDeleteConfirm
        target={{
          member: teamMember({
            status: 'invited',
            invitation: { id: 'inv_1', expiresAt: '2026-10-10T00:00:00.000Z' },
            profile: null,
          }),
        }}
        onClose={vi.fn()}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-mistake'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(scheduled.schedule).toHaveBeenCalledTimes(1));
    const [input] = scheduled.schedule.mock.calls[0] as [{ commit: () => Promise<void> }];
    await input.commit();
    expect(writes.revokeInvitation).toHaveBeenCalledWith('inv_1');
    expect(writes.removeMember).not.toHaveBeenCalled();
    expect(writes.removeProfile).not.toHaveBeenCalled();
  });

  it('keeps everyone on "Keep it"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <UserDeleteConfirm target={{ member: teamMember() }} onClose={onClose} />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(onClose).toHaveBeenCalled();
    expect(scheduled.schedule).not.toHaveBeenCalled();
  });
});
