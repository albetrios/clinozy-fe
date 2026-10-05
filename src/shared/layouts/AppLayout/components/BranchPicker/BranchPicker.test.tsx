import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import * as branchesApi from '@/shared/api/clinic/branches-api.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import {
  fetchMyPreferences,
  resetPreferencesFixture,
} from '@/shared/api/clinic/preferences-api.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { BranchPicker } from './BranchPicker.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

beforeEach(() => {
  resetClinicFixtures();
  resetPreferencesFixture();
  notifyMock.success.mockReset();
  notifyMock.info.mockReset();
  vi.restoreAllMocks();
});

describe('BranchPicker', () => {
  it('starts on all branches', async () => {
    renderWithProviders(<BranchPicker />);
    const trigger = await screen.findByTestId('branch-picker');
    expect(trigger).toHaveAccessibleName('Branch · All branches');
  });

  it('narrows to one branch, then names two with a +N count', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchPicker />);
    const [main, second] = await branchesApi.fetchActiveBranches();
    if (!(main && second)) throw new Error('the seed has two branches');

    await user.click(await screen.findByTestId('branch-picker'));
    await user.click(await screen.findByTestId('branch-picker-all'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(`Showing ${main.name}`),
    );
    expect((await fetchMyPreferences()).branchFilter).toEqual([main.id]);

    await user.click(screen.getByTestId(`branch-picker-${second.id}`));
    await waitFor(() =>
      expect(screen.getByTestId('branch-picker')).toHaveTextContent(`${main.name}+1`),
    );
  });

  it('is the compact pin on a phone: the name hides below md, the button keeps it (L-64)', async () => {
    renderWithProviders(<BranchPicker />);
    const trigger = await screen.findByTestId('branch-picker');
    const label = screen.getByTestId('branch-picker-label');
    expect(label).toHaveTextContent('All branches');
    expect(label).toHaveClass('hidden', 'md:inline');
    expect(trigger).toHaveAccessibleName('Branch · All branches');
    expect(trigger).toHaveClass('flex-none');
  });

  it('keeps at least one branch', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchPicker />);
    const [main] = await branchesApi.fetchActiveBranches();
    if (!main) throw new Error('the seed has a branch');
    await user.click(await screen.findByTestId('branch-picker'));
    await user.click(await screen.findByTestId('branch-picker-all'));
    await user.click(screen.getByTestId(`branch-picker-${main.id}`));
    expect(notifyMock.info).toHaveBeenCalledWith('Keep at least one branch');
  });

  it('is absent for a single-branch clinic', async () => {
    const [only] = await branchesApi.fetchActiveBranches();
    vi.spyOn(branchesApi, 'fetchActiveBranches').mockResolvedValue(only ? [only] : []);
    const { container } = renderWithProviders(<BranchPicker />);
    await waitFor(() => expect(screen.queryByTestId('branch-picker')).toBeNull());
    expect(await axe(container)).toHaveNoViolations();
  });
});
