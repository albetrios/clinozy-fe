import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetClinicAccessFixture } from '@/shared/api/clinic/access-api.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  member,
  PLATFORM_ROLES,
  renderUsersRoutes,
  resetUsersRoutes,
  SELF,
} from '../../../__tests__/integration/users-test-router.tsx';
import { BranchesPage } from '../../BranchesPage.tsx';

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

const api = vi.hoisted(() => ({ listMembers: vi.fn(), listRoles: vi.fn() }));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  ...api,
}));

const ROSTER = [
  member('riya', SELF.email, PLATFORM_ROLES.admin, { userId: SELF.userId }),
  member('reenal', 'reenal@cresence.skin'),
  member('nisha', 'nisha@cresence.skin', PLATFORM_ROLES.admin),
];

/** The open-branch state the header picker reads, beside the page. */
function Page() {
  const { isMultiBranch, openBranches } = useBranches();
  return (
    <>
      <output data-testid="probe">
        {String(isMultiBranch)}:{openBranches.length}
      </output>
      <BranchesPage />
    </>
  );
}

function renderBranches(url: string) {
  return renderUsersRoutes(url, () => null, { Branches: Page });
}

/** The drawer, once its form is up (the list, the Team and the access resolved). */
async function drawer() {
  await screen.findByTestId('branch-drawer-step-place');
  return screen.getByTestId('branch-drawer');
}

function branchNamed(name: string) {
  const branch = clinicFixtures.branches.snapshot((row) => row.name === name)[0];
  if (!branch) throw new Error(`no branch ${name}`);
  return branch;
}

function profileOf(email: string) {
  const profile = clinicFixtures.staff.snapshot((row) => row.email === email)[0];
  if (!profile) throw new Error(`no profile ${email}`);
  return profile;
}

beforeEach(() => {
  viewport.tier = 'desktop';
  resetClinicFixtures();
  resetClinicAccessFixture();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  api.listMembers.mockResolvedValue({ rows: ROSTER, next: null, hasMore: false });
  api.listRoles.mockResolvedValue({
    rows: Object.values(PLATFORM_ROLES),
    next: null,
    hasMore: false,
  });
});
afterEach(() => {
  resetUsersRoutes();
  resetClinicFixtures();
  resetClinicAccessFixture();
});

describe('the branch drawer — New branch (users.md:176–198)', () => {
  it('starts not main, Open, Mon–Sat 10:00–19:00, the main branch’s City and State, you on its team', async () => {
    renderBranches('/organization/acme/users/branches/create');
    const panel = await drawer();
    expect(within(panel).getByText('New branch', { selector: 'h2' })).toBeInTheDocument();
    expect(within(panel).getByTestId('branch-drawer-name')).toHaveValue('');
    expect(within(panel).getByTestId('branch-drawer-city')).toHaveValue('Surat');
    expect(within(panel).getByTestId('branch-drawer-state')).toHaveValue('Gujarat');
    expect(within(panel).getByTestId('branch-drawer-main')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(within(panel).getByTestId('branch-drawer-status')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Three branches already: the fourth tone of mint · lav · blush · peach · plum.
    expect(within(panel).getByTestId('branch-drawer-colour-peach')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(panel).getByText('New branch · Surat · 1 person')).toBeInTheDocument();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('opens step 1 for the name, then for the address, before anything is sent', async () => {
    const user = userEvent.setup();
    renderBranches('/organization/acme/users/branches/create');
    const panel = await drawer();
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Name the branch');
    await user.type(within(panel).getByTestId('branch-drawer-name'), 'Piplod');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Add the address');
    expect(clinicFixtures.branches.snapshot()).toHaveLength(3);
  });

  it('adds the branch with its team and says so; the list stays', async () => {
    const user = userEvent.setup();
    const { router } = renderBranches('/organization/acme/users/branches/create');
    const panel = await drawer();
    await user.type(within(panel).getByTestId('branch-drawer-name'), 'Piplod');
    await user.type(
      within(panel).getByTestId('branch-drawer-line1'),
      '4th floor, Piplod Plaza',
    );
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Piplod branch added'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users/branches'),
    );
    const piplod = branchNamed('Piplod');
    expect(piplod).toMatchObject({
      city: 'Surat',
      isMain: false,
      active: true,
      phone: '',
    });
    expect(profileOf(SELF.email).branchIds).toContain(piplod.id);
    await waitFor(() =>
      expect(screen.getAllByTestId('users-branches-table-row')).toHaveLength(4),
    );
  });

  it('refuses a name another branch has, outlining Name', async () => {
    const user = userEvent.setup();
    renderBranches('/organization/acme/users/branches/create');
    const panel = await drawer();
    await user.type(within(panel).getByTestId('branch-drawer-name'), 'vesu');
    await user.type(within(panel).getByTestId('branch-drawer-line1'), 'Shop 1');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    // The Name box capitalises the first letter as it is typed.
    await waitFor(() =>
      expect(notifyMock.warning).toHaveBeenCalledWith(
        'A branch called Vesu already exists',
      ),
    );
    expect(within(panel).getByTestId('branch-drawer-name')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('checks a filled phone has ten digits and a filled email reads as one', async () => {
    const user = userEvent.setup();
    renderBranches('/organization/acme/users/branches/create');
    const panel = await drawer();
    await user.type(within(panel).getByTestId('branch-drawer-name'), 'Piplod');
    await user.type(within(panel).getByTestId('branch-drawer-line1'), 'Shop 1');
    await user.click(within(panel).getByTestId('branch-drawer-step-contact-trigger'));
    await user.type(await within(panel).findByTestId('branch-drawer-phone'), '98250');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Phone needs 10 digits');
    await user.type(within(panel).getByTestId('branch-drawer-phone'), '44120');
    await user.type(within(panel).getByTestId('branch-drawer-email'), 'not-an-email');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Enter a valid email address');
  });
});

describe('the branch drawer — Edit branch', () => {
  it('saves a branch as main, clearing main on the old one', async () => {
    const user = userEvent.setup();
    const vesu = branchNamed('Vesu');
    renderBranches(`/organization/acme/users/branches/${vesu.id}/edit`);
    const panel = await drawer();
    expect(within(panel).getByTestId('branch-drawer-name')).toHaveValue('Vesu');
    await user.click(within(panel).getByTestId('branch-drawer-main'));
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalledWith('Vesu saved'));
    expect(branchNamed('Vesu').isMain).toBe(true);
    expect(branchNamed('Adajan').isMain).toBe(false);
  });

  it('closing all but one branch turns the branch UI off app-wide', async () => {
    const user = userEvent.setup();
    renderBranches(`/organization/acme/users/branches/${branchNamed('Vesu').id}/edit`);
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('true:3'));
    let panel = await drawer();
    await user.click(within(panel).getByTestId('branch-drawer-status'));
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('true:2'));
    await waitFor(() => expect(screen.queryByTestId('branch-drawer')).toBeNull());

    const rows = screen.getAllByTestId('users-branches-table-row');
    const varachha = rows.find((row) => within(row).queryByText('Varachha'));
    if (!varachha) throw new Error('Varachha');
    await user.click(varachha);
    panel = await drawer();
    await user.click(within(panel).getByTestId('branch-drawer-status'));
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('false:1'));
    // The Branches tab itself still lists the closed ones.
    expect(screen.getAllByTestId('users-branches-table-row')).toHaveLength(3);
    expect(screen.getAllByText('Closed')).toHaveLength(2);
  });

  it('moves people on and off the branch with the Team field', async () => {
    const user = userEvent.setup();
    const varachha = branchNamed('Varachha');
    renderBranches(`/organization/acme/users/branches/${varachha.id}/edit`);
    const panel = await drawer();
    await user.click(within(panel).getByTestId('branch-drawer-step-people-trigger'));
    await user.click(await within(panel).findByTestId('branch-drawer-team'));
    await user.click(
      await screen.findByTestId(
        `branch-drawer-team-option-${profileOf('reenal@cresence.skin').id}`,
      ),
    );
    await user.keyboard('{Escape}');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Varachha saved'),
    );
    expect(profileOf('reenal@cresence.skin').branchIds).toContain(varachha.id);
  });

  it('offers Delete on a branch but never on the main one', async () => {
    renderBranches(`/organization/acme/users/branches/${branchNamed('Adajan').id}/edit`);
    const panel = await drawer();
    expect(within(panel).queryByTestId('branch-drawer-delete')).toBeNull();
  });

  it('is view only without the Users row’s Edit', async () => {
    resetUsersRoutes();
    renderUsersRoutes(
      `/organization/acme/users/branches/${branchNamed('Vesu').id}/edit`,
      () => null,
      { Branches: Page, codes: ['organization:read', 'membership:read', 'role:read'] },
    );
    const panel = await drawer();
    expect(within(panel).getByTestId('branch-drawer-name')).toBeDisabled();
    expect(within(panel).queryByTestId('branch-drawer-save')).toBeNull();
  });
});
