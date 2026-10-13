import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { UserLeaveConfirm } from './UserLeaveConfirm.tsx';

const scheduled = vi.hoisted(() => ({ schedule: vi.fn() }));
vi.mock('@/shared/hooks/useDeferredRowRemoval/index.ts', () => ({
  useDeferredRowRemoval: () => scheduled.schedule,
}));

const leave = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
vi.mock('@/shared/hooks/useMembers/index.ts', () => ({
  useLeaveOrganization: () => leave,
}));

const me = vi.hoisted(() => ({ name: 'Cresence Skin' as string | undefined }));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: () => ({ data: { activeOrganization: { name: me.name } } }),
}));

/** You, on your own row — an Admin, not the owner. */
const SELF = {
  membershipId: 'mbr_riya',
  name: 'Riya Shah',
  isSelf: true,
  isOwner: false,
} as TeamMember;

/** The scheduled leave's input. */
function scheduledInput() {
  const [input] = scheduled.schedule.mock.calls[0] as [
    {
      id: string;
      pendingMessage: string;
      committedMessage: string;
      delayMs: number;
      commit: () => Promise<void>;
    },
  ];
  return input;
}

beforeEach(() => {
  scheduled.schedule.mockReset();
  leave.mutateAsync.mockReset();
  leave.mutateAsync.mockResolvedValue(undefined);
  me.name = 'Cresence Skin';
});

describe('UserLeaveConfirm (D17 — Settings’ self-removal)', () => {
  it('asks "Leave <clinic>?" with what you lose, and "Stay"', async () => {
    renderWithProviders(<UserLeaveConfirm member={SELF} onClose={vi.fn()} />);
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Leave Cresence Skin?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      'You’ll lose access to Cresence Skin — its rooms, records and team — and go back to your clinics.',
    );
    expect(within(dialog).getByRole('button', { name: 'Stay' })).toBeInTheDocument();
    expect(await axeForDialog(dialog)).toHaveNoViolations();
  });

  it('leaves behind a 10s Undo, then lands on your clinics', async () => {
    const user = userEvent.setup();
    const onScheduled = vi.fn();
    const { router } = renderWithProviders(
      <UserLeaveConfirm member={SELF} onClose={vi.fn()} onScheduled={onScheduled} />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(scheduled.schedule).toHaveBeenCalledTimes(1));
    expect(onScheduled).toHaveBeenCalled();
    const input = scheduledInput();
    expect(input).toMatchObject({
      id: 'mbr_riya',
      pendingMessage: 'Leaving Cresence Skin…',
      committedMessage: 'You left Cresence Skin',
      delayMs: 10_000,
    });
    expect(leave.mutateAsync).not.toHaveBeenCalled();

    await input.commit();
    expect(leave.mutateAsync).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/organization');
  });

  it('stays — and leaves nothing scheduled — on "Stay"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<UserLeaveConfirm member={SELF} onClose={onClose} />);
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(onClose).toHaveBeenCalled();
    expect(scheduled.schedule).not.toHaveBeenCalled();
  });

  it('says "this clinic" while the clinic’s name is unknown', async () => {
    me.name = undefined;
    renderWithProviders(<UserLeaveConfirm member={SELF} onClose={vi.fn()} />);
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Leave this clinic?')).toBeInTheDocument();
  });
});
