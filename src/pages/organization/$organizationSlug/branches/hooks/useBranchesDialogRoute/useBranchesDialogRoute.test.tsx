import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appBranch } from '@/tests/utils/branch-doubles.ts';

import {
  renderBranchesRoutes,
  resetBranchesRoutes,
} from '../../__tests__/integration/branches-test-router.tsx';
import type { BranchRow } from '../useBranchRows/index.ts';
import { useBranchesDialogRoute } from './useBranchesDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const VESU: BranchRow = {
  branch: appBranch(),
  team: [],
  defaults: [],
};

/** The page under test: what the hook says, as text. */
function probe(list: { rows: BranchRow[]; isPending: boolean }, canCreate = true) {
  return function Probe() {
    const { dialog } = useBranchesDialogRoute(list, { canCreate, accessResolved: true });
    const name = dialog.kind === 'edit' ? (dialog.row?.branch.name ?? 'loading') : '';
    return (
      <output>
        {dialog.kind}
        {name ? `:${name}` : ''}
      </output>
    );
  };
}

function renderAt(url: string, Probe: () => React.ReactNode) {
  return renderBranchesRoutes(url, Probe);
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});
afterEach(() => resetBranchesRoutes());

describe('useBranchesDialogRoute (KICKOFF §4, D24)', () => {
  it('reads no dialog on Branches itself, New branch on create', async () => {
    const { unmount } = renderAt(
      '/organization/acme/branches',
      probe({ rows: [], isPending: false }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('none');
    unmount();
    renderAt('/organization/acme/branches/create', probe({ rows: [], isPending: false }));
    expect(await screen.findByRole('status')).toHaveTextContent('create');
  });

  it('opens a branch on its edit route — loading until the list has answered', async () => {
    const { unmount } = renderAt(
      '/organization/acme/branches/brn_vesu00000000000000000/edit',
      probe({ rows: [], isPending: true }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('edit:loading');
    unmount();
    renderAt(
      '/organization/acme/branches/brn_vesu00000000000000000/edit',
      probe({ rows: [VESU], isPending: false }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('edit:Vesu');
  });

  it('leaves a dead branch link with "Branch not found", keeping the filter', async () => {
    const { router } = renderAt(
      '/organization/acme/branches/brn_gone0000000000000000/edit?created=today',
      probe({ rows: [VESU], isPending: false }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/branches'),
    );
    expect(router.state.location.search).toEqual({ created: 'today' });
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Branch not found · it may have been deleted',
    );
  });

  it('sends a create link back with the permission toast to a viewer who may not create', async () => {
    const { router } = renderAt(
      '/organization/acme/branches/create',
      probe({ rows: [], isPending: false }, false),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/branches'),
    );
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
  });
});
