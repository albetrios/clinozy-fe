import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as BranchesApiModule from '@/shared/api/clinic/branches-api.ts';
import type { BranchOption } from '@/shared/api/clinic/branches-api.ts';
import type { BranchSave, ClinicBranch } from '@/shared/api/clinic/branches-contracts.ts';
import type * as BranchesManageApiModule from '@/shared/api/clinic/branches-manage-api.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import type { Member } from '@/shared/api/organization-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { clinicBranch } from '@/tests/utils/branch-doubles.ts';

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

const api = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
  fetchBranches: vi.fn(),
  saveBranch: vi.fn(),
  fetchActiveBranches: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  listMembers: api.listMembers,
  listRoles: api.listRoles,
}));
vi.mock('@/shared/api/clinic/branches-manage-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof BranchesManageApiModule>()),
  fetchBranches: api.fetchBranches,
  saveBranch: api.saveBranch,
}));
vi.mock('@/shared/api/clinic/branches-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof BranchesApiModule>()),
  fetchActiveBranches: api.fetchActiveBranches,
}));

const ADAJAN = clinicBranch({
  id: 'brn_adajan000000000000000',
  name: 'Adajan',
  tone: 'mint',
  isMain: true,
  area: 'Adajan',
  createdAt: '2026-09-01T05:00:00.000Z',
});
const VESU = clinicBranch({ createdAt: '2026-09-02T05:00:00.000Z' });
const VARACHHA = clinicBranch({
  id: 'brn_varachha0000000000000',
  name: 'Varachha',
  tone: 'blush',
  area: 'Varachha',
  createdAt: '2026-09-03T05:00:00.000Z',
});

/** What clinozy-be holds for the run: the three branches and the roster. */
const server = { branches: [] as ClinicBranch[], roster: [] as Member[] };

const RIYA = member('riya', SELF.email, PLATFORM_ROLES.admin, {
  userId: SELF.userId,
  branchIds: [ADAJAN.id, VESU.id],
});
const REENAL = member('reenal', 'reenal@cresence.skin', PLATFORM_ROLES.doctor, {
  branchIds: [VESU.id],
});

/** clinozy-be's save: a taken name is a reasonless 409; the team moves with the branch. */
function serverSave({ save }: { save: BranchSave }): ClinicBranch {
  const name = save.input.name.toLowerCase();
  const taken = server.branches.some(
    (row) => row.name.toLowerCase() === name && row.id !== save.branch?.id,
  );
  if (taken) throw new HttpError('Conflict', 409, '/app/branches', 'POST', {});
  const before = server.branches.find((row) => row.id === save.branch?.id);
  const saved: ClinicBranch = {
    ...(before ?? clinicBranch({ id: `brn_${name.padEnd(21, '0')}`, isMain: false })),
    ...save.input,
    createdAt: before?.createdAt ?? '2026-10-10T05:00:00.000Z',
  };
  server.branches = before
    ? server.branches.map((row) => (row.id === saved.id ? saved : row))
    : [...server.branches, saved];
  server.roster = server.roster.map((person) => {
    const others = person.branchIds.filter((id) => id !== saved.id);
    return {
      ...person,
      branchIds: save.memberIds.includes(person.id) ? [...others, saved.id] : others,
    };
  });
  return saved;
}

/** `GET /app/branches/my` for an admin: every open branch, main first. */
const openBranches = (): BranchOption[] =>
  server.branches
    .filter((row) => row.active)
    .map(({ id, name, tone, isMain, opensAt, closesAt, workingDays }) => ({
      id,
      name,
      tone,
      isMain,
      opensAt,
      closesAt,
      workingDays,
    }));

/** The open-branch state the header picker reads, beside the page. */
function Page() {
  const { isMultiBranch, openBranches: open } = useBranches();
  return (
    <>
      <output data-testid="probe">
        {String(isMultiBranch)}:{open.length}
      </output>
      <BranchesPage />
    </>
  );
}

function renderBranches(url: string, codes?: Parameters<typeof renderUsersRoutes>[2]) {
  return renderUsersRoutes(url, () => null, { Branches: Page, ...codes });
}

/** The drawer, once its form is up (the list, the Team and the access resolved). */
async function drawer() {
  await screen.findByTestId('branch-drawer-step-place');
  return screen.getByTestId('branch-drawer');
}

/** The one save clinozy-be was sent. */
function sentSave(): BranchSave {
  expect(api.saveBranch).toHaveBeenCalledTimes(1);
  const [call] = api.saveBranch.mock.calls[0] as [{ save: BranchSave }];
  return call.save;
}

/** Fill a new branch's required fields — PIN code, phone and email included. */
async function fillRequired(
  user: ReturnType<typeof userEvent.setup>,
  panel: HTMLElement,
  name: string,
) {
  await user.type(within(panel).getByTestId('branch-drawer-name'), name);
  await user.type(
    within(panel).getByTestId('branch-drawer-line1'),
    '4th floor, Piplod Plaza',
  );
  await user.type(within(panel).getByTestId('branch-drawer-area'), 'Piplod');
  await user.type(within(panel).getByTestId('branch-drawer-pin'), '395007');
  await user.click(within(panel).getByTestId('branch-drawer-step-contact-trigger'));
  await user.type(await within(panel).findByTestId('branch-drawer-phone'), '9825044120');
  await user.type(within(panel).getByTestId('branch-drawer-email'), 'piplod@clinic.com');
}

beforeEach(() => {
  viewport.tier = 'desktop';
  server.branches = [ADAJAN, VESU, VARACHHA];
  server.roster = [RIYA, REENAL];
  for (const fn of [...Object.values(notifyMock), ...Object.values(api)]) fn.mockReset();
  api.listMembers.mockImplementation(async () => ({
    rows: server.roster,
    next: null,
    hasMore: false,
  }));
  api.listRoles.mockResolvedValue({
    rows: Object.values(PLATFORM_ROLES),
    next: null,
    hasMore: false,
  });
  api.fetchBranches.mockImplementation(async () => [...server.branches]);
  api.fetchActiveBranches.mockImplementation(async () => openBranches());
  api.saveBranch.mockImplementation(async (input: { save: BranchSave }) =>
    serverSave(input),
  );
});
afterEach(() => resetUsersRoutes());

describe('the branch drawer — New branch (users.md:176–198)', () => {
  it('starts not main, Open, Mon–Sat 10:00–19:00, the main branch’s City and State, you on its team', async () => {
    renderBranches('/organization/acme/users/branches/create');
    const panel = await drawer();
    expect(within(panel).getByText('New branch', { selector: 'h2' })).toBeInTheDocument();
    expect(within(panel).getByTestId('branch-drawer-name')).toHaveValue('');
    expect(within(panel).getByTestId('branch-drawer-city')).toHaveValue('Surat');
    expect(within(panel).getByTestId('branch-drawer-state')).toHaveValue('Gujarat');
    // Main is set when the clinic opens, never from here.
    expect(within(panel).getByTestId('branch-drawer-main')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(within(panel).getByTestId('branch-drawer-main')).toBeDisabled();
    expect(within(panel).getByText('one per clinic · set when it opened')).toBeVisible();
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

  it('asks for the name, then the address, then the contact — before anything is sent', async () => {
    const user = userEvent.setup();
    renderBranches('/organization/acme/users/branches/create');
    const panel = await drawer();
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Name the branch');
    await user.type(within(panel).getByTestId('branch-drawer-name'), 'Piplod');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith(
      'Add the address, area, city and PIN code',
    );
    await user.type(within(panel).getByTestId('branch-drawer-line1'), 'Shop 1');
    await user.type(within(panel).getByTestId('branch-drawer-area'), 'Piplod');
    await user.type(within(panel).getByTestId('branch-drawer-pin'), '395007');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Add the phone and email');
    expect(api.saveBranch).not.toHaveBeenCalled();
  });

  it('adds the branch with its team in one save and says so; the list stays', async () => {
    const user = userEvent.setup();
    const { router } = renderBranches('/organization/acme/users/branches/create');
    const panel = await drawer();
    await fillRequired(user, panel, 'Piplod');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Piplod branch added'),
    );
    const save = sentSave();
    expect(save.branch).toBeUndefined();
    expect(save.input).toMatchObject({
      name: 'Piplod',
      tone: 'peach',
      active: true,
      addressLine1: '4th floor, Piplod Plaza',
      area: 'Piplod',
      city: 'Surat',
      state: 'Gujarat',
      pin: '395007',
      phone: '+919825044120',
      email: 'piplod@clinic.com',
    });
    expect(save.memberIds).toEqual([RIYA.id]);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users/branches'),
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('users-branches-table-row')).toHaveLength(4),
    );
  });

  it('refuses a name another branch has (409), outlining Name', async () => {
    const user = userEvent.setup();
    renderBranches('/organization/acme/users/branches/create');
    const panel = await drawer();
    await fillRequired(user, panel, 'vesu');
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
    expect(server.branches).toHaveLength(3);
  });

  it('checks a PIN code of six digits, a phone of ten and an email that reads as one', async () => {
    const user = userEvent.setup();
    renderBranches('/organization/acme/users/branches/create');
    const panel = await drawer();
    await fillRequired(user, panel, 'Piplod');
    await user.click(within(panel).getByTestId('branch-drawer-step-place-trigger'));
    const pin = await within(panel).findByTestId('branch-drawer-pin');
    await user.clear(pin);
    await user.type(pin, '3950');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('PIN code needs 6 digits');
    await user.type(within(panel).getByTestId('branch-drawer-pin'), '07');
    await user.click(within(panel).getByTestId('branch-drawer-step-contact-trigger'));
    const phone = await within(panel).findByTestId('branch-drawer-phone');
    await user.clear(phone);
    await user.type(phone, '98250');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Phone needs 10 digits');
    await user.type(within(panel).getByTestId('branch-drawer-phone'), '44120');
    const email = within(panel).getByTestId('branch-drawer-email');
    await user.clear(email);
    await user.type(email, 'not-an-email');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Enter a valid email address');
    expect(api.saveBranch).not.toHaveBeenCalled();
  });
});

describe('the branch drawer — Edit branch', () => {
  it('saves the fields with the read’s updated_at, and the team only when it changed', async () => {
    const user = userEvent.setup();
    renderBranches(`/organization/acme/users/branches/${VESU.id}/edit`);
    const panel = await drawer();
    expect(within(panel).getByTestId('branch-drawer-name')).toHaveValue('Vesu');
    expect(within(panel).getByTestId('branch-drawer-main')).toBeDisabled();
    await user.type(within(panel).getByTestId('branch-drawer-line2'), 'Near the park');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalledWith('Vesu saved'));
    const save = sentSave();
    expect(save.branch).toMatchObject({ id: VESU.id, updatedAt: VESU.updatedAt });
    expect(save.input).toMatchObject({ addressLine2: 'Near the park' });
    expect(save.memberIds).toEqual(save.memberIdsBefore);
  });

  it('closing all but one branch turns the branch UI off app-wide', async () => {
    const user = userEvent.setup();
    renderBranches(`/organization/acme/users/branches/${VESU.id}/edit`);
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
    await waitFor(() => expect(screen.getAllByText('Closed')).toHaveLength(2));
    expect(screen.getAllByTestId('users-branches-table-row')).toHaveLength(3);
  });

  it('moves people on and off the branch with the Team field — the whole set', async () => {
    const user = userEvent.setup();
    renderBranches(`/organization/acme/users/branches/${VARACHHA.id}/edit`);
    const panel = await drawer();
    await user.click(within(panel).getByTestId('branch-drawer-step-people-trigger'));
    await user.click(await within(panel).findByTestId('branch-drawer-team'));
    await user.click(await screen.findByTestId(`branch-drawer-team-option-${REENAL.id}`));
    await user.keyboard('{Escape}');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Varachha saved'),
    );
    const save = sentSave();
    expect(save.memberIdsBefore).toEqual([]);
    expect(save.memberIds).toEqual([REENAL.id]);
    expect(server.roster.find((person) => person.id === REENAL.id)?.branchIds).toContain(
      VARACHHA.id,
    );
  });

  it('never offers Delete — a branch is closed, not deleted', async () => {
    renderBranches(`/organization/acme/users/branches/${VESU.id}/edit`);
    const panel = await drawer();
    expect(within(panel).queryByTestId('branch-drawer-delete')).toBeNull();
  });

  it('says why another conflict refused the save, leaving Name alone', async () => {
    const user = userEvent.setup();
    api.saveBranch.mockRejectedValue(
      new HttpError('Conflict', 409, `/app/branches/${VESU.id}`, 'PATCH', {
        error: { reason: 'branch_main_exists', detail: 'A main branch exists' },
      }),
    );
    renderBranches(`/organization/acme/users/branches/${VESU.id}/edit`);
    const panel = await drawer();
    await user.type(within(panel).getByTestId('branch-drawer-line2'), 'Near the park');
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    await waitFor(() => expect(notifyMock.warning).toHaveBeenCalledTimes(1));
    expect(notifyMock.warning).not.toHaveBeenCalledWith(
      'A branch called Vesu already exists',
    );
    expect(within(panel).getByTestId('branch-drawer-name')).not.toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('is view only without branch:update', async () => {
    renderBranches(`/organization/acme/users/branches/${VESU.id}/edit`, {
      codes: ['organization:read', 'membership:read', 'role:read', 'branch:read'],
    });
    const panel = await drawer();
    expect(within(panel).getByTestId('branch-drawer-name')).toBeDisabled();
    expect(within(panel).queryByTestId('branch-drawer-save')).toBeNull();
  });
});
