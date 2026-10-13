import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { holdPreset } from '@/tests/utils/app-preset-codes.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

/*
 * The members' setup notice (feat-clinic-setup KICKOFF §3; BRIEF.md:117–121): a member of a team
 * clinic who cannot manage it, while the clinic has no open branch.
 */

const branches = vi.hoisted(() => ({
  openBranches: [] as BranchOption[],
  isPending: false,
}));
vi.mock('@/shared/hooks/useBranches/index.ts', () => ({
  useBranches: () => ({
    openBranches: branches.openBranches,
    isMultiBranch: branches.openBranches.length > 1,
    isPending: branches.isPending,
  }),
}));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: () => ({ data: undefined }),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { NoticeStack } from './NoticeStack.tsx';

const NOTICE = "Your clinic is still being set up — bookings open once it's ready.";

const MAIN: BranchOption = {
  id: 'brn_mainaaaaaaaaaaaaaaaaa',
  name: 'Vesu',
  tone: 'sage',
  isMain: true,
  opensAt: '10:00',
  closesAt: '20:00',
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
};

async function renderStack() {
  const view = renderWithProviders(<NoticeStack />);
  await act(async () => {});
  return view;
}

beforeEach(() => {
  branches.openBranches = [];
  branches.isPending = false;
  useAuthStore.setState({
    user: { id: 'usr_me', email: 'doctor@acme.test', role: 'user' } as AuthUser,
  });
  useOrganizationStore.getState().clearOrganization();
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore.setState({ organizationType: 'TEAM' });
  // A Doctor — no `organization:update`.
  holdPreset('doctor');
  useUIStore.getState().setPreviewRole(null);
});
afterEach(() => {
  useAuthStore.setState({ user: null });
});

describe('NoticeStack — the members’ setup notice', () => {
  it('tells a member the clinic is still being set up while it has no open branch', async () => {
    const { container } = await renderStack();

    const notice = await screen.findByTestId('setup-member-notice');
    expect(notice).toHaveTextContent(NOTICE);
    expect(notice).toHaveAttribute('data-slot', 'notice-pill');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is gone once a branch is open', async () => {
    branches.openBranches = [MAIN];
    await renderStack();
    expect(screen.queryByTestId('setup-member-notice')).not.toBeInTheDocument();
  });

  it('waits for the branches before saying anything', async () => {
    branches.isPending = true;
    await renderStack();
    expect(screen.queryByTestId('setup-member-notice')).not.toBeInTheDocument();
  });

  it('is never shown to a manager — they get the drawer and the ring', async () => {
    holdPreset('owner');
    await renderStack();
    expect(screen.queryByTestId('setup-member-notice')).not.toBeInTheDocument();
  });

  it('is never shown in a personal workspace', async () => {
    useOrganizationStore.setState({ organizationType: 'PERSONAL' });
    await renderStack();
    expect(screen.queryByTestId('setup-member-notice')).not.toBeInTheDocument();
  });

  it('says nothing until the permission set is known', async () => {
    useOrganizationStore.getState().clearPermissions();
    await renderStack();
    expect(screen.queryByTestId('setup-member-notice')).not.toBeInTheDocument();
  });
});
