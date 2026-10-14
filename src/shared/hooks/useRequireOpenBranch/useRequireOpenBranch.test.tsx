import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const state = vi.hoisted(() => ({
  openBranches: [] as BranchOption[],
  isPending: false,
  canManageSetup: true,
}));
vi.mock('@/shared/hooks/useBranches/index.ts', () => ({
  useBranches: () => ({
    openBranches: state.openBranches,
    isMultiBranch: state.openBranches.length > 1,
    isPending: state.isPending,
  }),
}));
vi.mock('@/shared/hooks/useOnboardingSetup/index.ts', () => ({
  useSetupAccess: () => ({ canManageSetup: state.canManageSetup, isResolved: true }),
}));

import { useRequireOpenBranch } from './useRequireOpenBranch.ts';

const MAIN: BranchOption = {
  id: 'brn_mainaaaaaaaaaaaaaaaaa',
  name: 'Vesu',
  tone: 'sage',
  isMain: true,
  opensAt: '10:00',
  closesAt: '20:00',
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
};

/** A room's "New booking", wrapped as the rooms wrap it. */
function NewBooking({ onBook }: { onBook: () => void }) {
  const requireOpenBranch = useRequireOpenBranch();
  return (
    <button
      type="button"
      data-testid="new-booking"
      onClick={() => requireOpenBranch(onBook)}
    >
      New booking
    </button>
  );
}

async function press(onBook: () => void) {
  const view = renderWithProviders(<NewBooking onBook={onBook} />, {
    initialEntries: ['/?view=week'],
  });
  await userEvent.setup().click(await screen.findByTestId('new-booking'));
  return view;
}

beforeEach(() => {
  state.openBranches = [];
  state.isPending = false;
  state.canManageSetup = true;
});

describe('useRequireOpenBranch', () => {
  it('lands a manager with no open branch on “Where is your clinic?”, not the action', async () => {
    const onBook = vi.fn();
    const { router } = await press(onBook);

    await waitFor(() => expect(router.state.location.hash).toBe('setup/location'));
    // The room stays as it was — its search kept.
    expect(router.state.location.search).toEqual({ view: 'week' });
    expect(onBook).not.toHaveBeenCalled();
  });

  it('runs the action for a member — the room says why it cannot book', async () => {
    state.canManageSetup = false;
    const onBook = vi.fn();
    const { router } = await press(onBook);

    expect(onBook).toHaveBeenCalledTimes(1);
    expect(router.state.location.hash).toBe('');
  });

  it('runs the action while the branches load — the server still refuses it', async () => {
    state.isPending = true;
    const onBook = vi.fn();
    const { router } = await press(onBook);

    expect(onBook).toHaveBeenCalledTimes(1);
    expect(router.state.location.hash).toBe('');
  });

  it('runs the action with an open branch', async () => {
    state.openBranches = [MAIN];
    const onBook = vi.fn();
    const { router } = await press(onBook);

    expect(onBook).toHaveBeenCalledTimes(1);
    expect(router.state.location.hash).toBe('');
  });

  it('has no axe violations around the wrapped action', async () => {
    const { container } = renderWithProviders(<NewBooking onBook={vi.fn()} />);
    await screen.findByTestId('new-booking');
    expect(await axe(container)).toHaveNoViolations();
  });
});
