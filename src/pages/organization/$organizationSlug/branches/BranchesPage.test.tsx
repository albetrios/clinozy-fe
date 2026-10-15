import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type * as CsvModule from '@/lib/csv.ts';
import type * as BranchPlacesApiModule from '@/shared/api/app/branch-places-api.ts';
import type * as BranchesManageApiModule from '@/shared/api/app/branches-manage-api.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { appBranch } from '@/tests/utils/branch-doubles.ts';
import { member, PLATFORM_ROLES, SELF } from '@/tests/utils/team-doubles.ts';

import {
  BRANCHES_ADMIN_CODES,
  renderBranchesRoutes,
  resetBranchesRoutes,
} from './__tests__/integration/branches-test-router.tsx';
import { BranchesPage } from './BranchesPage.tsx';

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
vi.mock('@/shared/notify/notify.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

const api = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
  fetchBranches: vi.fn(),
  downloadCsv: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  listMembers: api.listMembers,
  listRoles: api.listRoles,
}));
vi.mock('@/shared/api/app/branches-manage-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof BranchesManageApiModule>()),
  fetchBranches: api.fetchBranches,
}));
vi.mock('@/lib/csv.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof CsvModule>()),
  downloadCsv: api.downloadCsv,
}));
// An edit drawer reads its branch's rooms, machines and holidays ("Places & days"): none here.
vi.mock('@/shared/api/app/branch-places-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof BranchPlacesApiModule>()),
  fetchBranchPlaces: async () => [],
  fetchBranchHolidays: async () => [],
}));

const NISHA = member('nisha', 'nisha@cresence.skin', PLATFORM_ROLES.doctor, {
  name: 'Dr. Nisha Mavani',
  branchIds: ['brn_adajan000000000000000'],
});
const RIYA = member('riya', SELF.email, PLATFORM_ROLES.admin, {
  userId: SELF.userId,
  name: 'Riya Shah',
  branchIds: ['brn_adajan000000000000000'],
});

const ADAJAN = appBranch({
  id: 'brn_adajan000000000000000',
  name: 'Adajan',
  tone: 'mint',
  isMain: true,
  addressLine1: '3rd floor, Shree Hari Complex',
  addressLine2: 'Near Star Bazaar, Adajan Gam Road',
  area: 'Adajan',
  pin: '395009',
  phone: '+917490020099',
  email: 'adajan@clinic.com',
  closesAt: '20:00',
  defaultDoctorId: NISHA.id,
  createdAt: '2026-09-01T05:00:00.000Z',
});
const VESU = appBranch({
  workingDays: ['tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  opensAt: '11:00',
  closesAt: '20:00',
});
const VARACHHA = appBranch({
  id: 'brn_varachha0000000000000',
  name: 'Varachha',
  tone: 'blush',
  active: false,
  createdAt: '2026-09-03T05:00:00.000Z',
});

/** The list's rows, once they are in. */
async function rows() {
  await waitFor(() =>
    expect(screen.getAllByTestId('branches-table-row')).toHaveLength(3),
  );
  return screen.getAllByTestId('branches-table-row');
}

function renderBranches(
  url = '/organization/acme/branches',
  codes: OrganizationPermission[] = BRANCHES_ADMIN_CODES,
) {
  return renderBranchesRoutes(url, BranchesPage, codes);
}

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of [...Object.values(notifyMock), ...Object.values(api)]) fn.mockReset();
  api.listMembers.mockResolvedValue({ rows: [RIYA, NISHA], next: null, hasMore: false });
  api.listRoles.mockResolvedValue({
    rows: Object.values(PLATFORM_ROLES),
    next: null,
    hasMore: false,
  });
  api.fetchBranches.mockResolvedValue([ADAJAN, VESU, VARACHHA]);
});
afterEach(() => resetBranchesRoutes());

describe('the Branches room (users.md:79–95)', () => {
  it('lists every branch, the main one first with "Main", each with its address, contact and hours', async () => {
    const { container } = renderBranches();
    const [adajan, vesu] = await rows();
    if (!(adajan && vesu)) throw new Error('two rows');
    expect(within(adajan).getByText('Adajan')).toBeInTheDocument();
    expect(within(adajan).getByText('Main')).toBeInTheDocument();
    expect(within(adajan).getByText('3rd floor, Shree Hari Complex')).toBeInTheDocument();
    expect(
      within(adajan).getByText('Near Star Bazaar, Adajan Gam Road, Adajan, Surat 395009'),
    ).toBeInTheDocument();
    expect(within(adajan).getByText('+91 74900 20099')).toBeInTheDocument();
    expect(within(adajan).getByText('adajan@clinic.com')).toBeInTheDocument();
    expect(within(adajan).getByText('Mon–Sat · 10:00–20:00')).toBeInTheDocument();
    expect(within(adajan).getByText('Open')).toBeInTheDocument();
    expect(within(vesu).getByText('Tue–Sun · 11:00–20:00')).toBeInTheDocument();
    // The Team who work there (each membership's branches) and the default people it has.
    expect(within(adajan).getByText('Riya S.')).toBeInTheDocument();
    // The member's name isolated beside the role.
    expect(
      within(adajan).getByText(`Doctor · ${fsi('Dr. Nisha Mavani')}`),
    ).toBeInTheDocument();
    expect(within(vesu).getByText('Not set')).toBeInTheDocument();
    expect(screen.getByText('All branches loaded')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('lists a closed branch as "Closed", and offers Edit — never Delete — on every row', async () => {
    renderBranches();
    const all = await rows();
    expect(within(all[2] as HTMLElement).getByText('Closed')).toBeInTheDocument();
    for (const row of all) {
      expect(within(row).queryByRole('button', { name: 'Delete' })).toBeNull();
    }
  });

  it('opens a branch’s drawer from its row, and New branch from the toolbar', async () => {
    const user = userEvent.setup();
    const { router } = renderBranches();
    const [adajan] = await rows();
    if (!adajan) throw new Error('a row');
    await user.click(adajan);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/branches/${ADAJAN.id}/edit`,
      ),
    );
    expect(await screen.findByTestId('branch-drawer-name')).toHaveValue('Adajan');
    await user.click(screen.getByTestId('branch-drawer-close'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/branches'),
    );
    await user.click(screen.getByTestId('branches-new-branch'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/branches/create'),
    );
  });

  it('filters by Created, with the filtered empty state', async () => {
    renderBranches('/organization/acme/branches?created=today');
    expect(await screen.findByText('Clear filters')).toBeInTheDocument();
    expect(screen.queryAllByTestId('branches-table-row')).toHaveLength(0);
  });

  it('exports the selected rows as CSV with branch:read', async () => {
    renderBranches();
    const [adajan, vesu] = await rows();
    if (!(adajan && vesu)) throw new Error('two rows');
    fireEvent.click(within(adajan).getByRole('checkbox'));
    fireEvent.click(within(vesu).getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('branches-table-bulk-export'));
    expect(api.downloadCsv).toHaveBeenCalledTimes(1);
    const [fileName, content] = api.downloadCsv.mock.calls[0] as [string, string];
    expect(fileName).toBe('branches.csv');
    expect(content.split('\n')).toHaveLength(3);
    expect(notifyMock.success).toHaveBeenCalledTimes(1);
  });

  it('offers no "New branch" and no Export without their codes', async () => {
    renderBranches('/organization/acme/branches', [
      'organization:read',
      'membership:read',
      'role:read',
    ]);
    const [adajan] = await rows();
    if (!adajan) throw new Error('a row');
    expect(screen.queryByTestId('branches-new-branch')).toBeNull();
    fireEvent.click(within(adajan).getByRole('checkbox'));
    expect(screen.queryByTestId('branches-table-bulk-export')).toBeNull();
  });

  it('sends a create link back with the permission toast to a viewer who may not create', async () => {
    const { router } = renderBranches('/organization/acme/branches/create', [
      'organization:read',
      'membership:read',
      'branch:read',
    ]);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/branches'),
    );
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
  });

  it('leaves a dead branch link with "Branch not found"', async () => {
    const { router } = renderBranches(
      '/organization/acme/branches/brn_gone0000000000000000/edit',
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/branches'),
    );
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Branch not found · it may have been deleted',
    );
  });

  it('keeps the list and says so when its read fails', async () => {
    api.fetchBranches.mockRejectedValue(new Error('down'));
    renderBranches();
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledTimes(1));
    expect(screen.queryAllByTestId('branches-table-row')).toHaveLength(0);
  });

  it('puts the chip first and the address block, with the rest, at the end on a phone', async () => {
    viewport.tier = 'phone';
    renderBranches();
    const [adajan] = await rows();
    if (!adajan) throw new Error('a row');
    const [chip, address] = within(adajan).getAllByRole('cell');
    expect(chip).toHaveTextContent('AdajanMain');
    expect(address).toHaveTextContent('3rd floor, Shree Hari Complex');
    expect(address).toHaveTextContent('Contact');
    expect(address).toHaveTextContent('Opening hours');
  });
});
