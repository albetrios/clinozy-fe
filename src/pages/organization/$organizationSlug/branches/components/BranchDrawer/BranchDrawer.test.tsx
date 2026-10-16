import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import type * as BranchPlacesApiModule from '@/shared/api/app/branch-places-api.ts';
import type {
  BranchHoliday,
  BranchPlace,
  BranchPlaceKind,
} from '@/shared/api/app/branch-places-contracts.ts';
import type * as BranchesApiModule from '@/shared/api/app/branches-api.ts';
import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import type { AppBranch, BranchSave } from '@/shared/api/app/branches-contracts.ts';
import type * as BranchesManageApiModule from '@/shared/api/app/branches-manage-api.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import type { Member } from '@/shared/api/organization-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { appBranch } from '@/tests/utils/branch-doubles.ts';
import { member, PLATFORM_ROLES, SELF } from '@/tests/utils/team-doubles.ts';

import {
  renderBranchesRoutes,
  resetBranchesRoutes,
} from '../../__tests__/integration/branches-test-router.tsx';
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
vi.mock('@/shared/api/app/branches-manage-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof BranchesManageApiModule>()),
  fetchBranches: api.fetchBranches,
  saveBranch: api.saveBranch,
}));
vi.mock('@/shared/api/app/branches-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof BranchesApiModule>()),
  fetchActiveBranches: api.fetchActiveBranches,
}));

/** "Places & days" on clinozy-be: a branch's rooms, machines and holidays. */
const placesApi = vi.hoisted(() => ({
  fetchBranchPlaces: vi.fn(),
  addBranchPlace: vi.fn(),
  changeBranchPlace: vi.fn(),
  removeBranchPlace: vi.fn(),
  restoreBranchPlace: vi.fn(),
  fetchBranchHolidays: vi.fn(),
  addBranchHoliday: vi.fn(),
  removeBranchHoliday: vi.fn(),
  restoreBranchHoliday: vi.fn(),
}));
vi.mock('@/shared/api/app/branch-places-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof BranchPlacesApiModule>()),
  ...placesApi,
}));

const ADAJAN = appBranch({
  id: 'brn_adajan000000000000000',
  name: 'Adajan',
  tone: 'mint',
  isMain: true,
  area: 'Adajan',
  createdAt: '2026-09-01T05:00:00.000Z',
});
const VESU = appBranch({ createdAt: '2026-09-02T05:00:00.000Z' });
const VARACHHA = appBranch({
  id: 'brn_varachha0000000000000',
  name: 'Varachha',
  tone: 'blush',
  area: 'Varachha',
  createdAt: '2026-09-03T05:00:00.000Z',
});

/** What clinozy-be holds for the run: the three branches and the roster. */
const server = { branches: [] as AppBranch[], roster: [] as Member[] };

const RIYA = member('riya', SELF.email, PLATFORM_ROLES.admin, {
  userId: SELF.userId,
  branchIds: [ADAJAN.id, VESU.id],
});
const REENAL = member('reenal', 'reenal@cresence.skin', PLATFORM_ROLES.doctor, {
  branchIds: [VESU.id],
});

/** clinozy-be's save: a taken name is a reasonless 409; the team moves with the branch. */
function serverSave({ save }: { save: BranchSave }): AppBranch {
  const name = save.input.name.toLowerCase();
  const taken = server.branches.some(
    (row) => row.name.toLowerCase() === name && row.id !== save.branch?.id,
  );
  if (taken) throw new HttpError('Conflict', 409, '/app/branches', 'POST', {});
  const before = server.branches.find((row) => row.id === save.branch?.id);
  const saved: AppBranch = {
    ...(before ?? appBranch({ id: `brn_${name.padEnd(21, '0')}`, isMain: false })),
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
      branchIds: save.memberIds?.includes(person.id) ? [...others, saved.id] : others,
    };
  });
  return saved;
}

/** A room or machine of Vesu, as clinozy-be keeps it. */
const place = (
  kind: BranchPlaceKind,
  name: string,
  patch: Partial<BranchPlace> = {},
) => ({
  id: `${kind === 'room' ? 'brm' : 'bmc'}_${name.toLowerCase().replaceAll(' ', '').padEnd(21, '0')}`,
  branchId: VESU.id,
  name,
  active: true,
  createdAt: '2026-10-01T05:00:00.000Z',
  updatedAt: '2026-10-01T05:00:00.000Z',
  ...patch,
});

/** What clinozy-be holds of Vesu's places and days for the run. */
const placesServer = {
  room: [] as BranchPlace[],
  machine: [] as BranchPlace[],
  holiday: [] as BranchHoliday[],
};

/** A reasonless 409 — a name (or a day) the branch already has. */
const taken = () => new HttpError('Conflict', 409, '/app/branches', 'POST', {});

/** clinozy-be's places routes over `placesServer`: a taken name or day is a reasonless 409. */
function servePlaces() {
  placesApi.fetchBranchPlaces.mockImplementation(
    async ({ kind }: { kind: BranchPlaceKind }) => [...placesServer[kind]],
  );
  placesApi.fetchBranchHolidays.mockImplementation(async () => [...placesServer.holiday]);
  placesApi.addBranchPlace.mockImplementation(
    async ({ kind, name }: { kind: BranchPlaceKind; name: string }) => {
      if (
        placesServer[kind].some((row) => row.name.toLowerCase() === name.toLowerCase())
      ) {
        throw taken();
      }
      const added = place(kind, name, { updatedAt: '2026-10-13T05:00:00.000Z' });
      placesServer[kind] = [...placesServer[kind], added];
      return added;
    },
  );
  placesApi.changeBranchPlace.mockImplementation(
    async ({
      kind,
      place: before,
      change,
    }: {
      kind: BranchPlaceKind;
      place: BranchPlace;
      change: { name: string } | { active: boolean };
    }) => {
      const saved = { ...before, ...change, updatedAt: '2026-10-13T06:00:00.000Z' };
      placesServer[kind] = placesServer[kind].map((row) =>
        row.id === saved.id ? saved : row,
      );
      return saved;
    },
  );
  placesApi.removeBranchPlace.mockImplementation(
    async ({ kind, place: gone }: { kind: BranchPlaceKind; place: BranchPlace }) => {
      placesServer[kind] = placesServer[kind].filter((row) => row.id !== gone.id);
    },
  );
  placesApi.addBranchHoliday.mockImplementation(
    async ({ date, label }: { date: string; label: string }) => {
      if (placesServer.holiday.some((row) => row.date === date)) throw taken();
      const added: BranchHoliday = {
        id: `bhd_${label.toLowerCase().padEnd(21, '0')}`,
        branchId: VESU.id,
        date,
        label,
        createdAt: '2026-10-13T05:00:00.000Z',
        updatedAt: '2026-10-13T05:00:00.000Z',
      };
      placesServer.holiday = [...placesServer.holiday, added];
      return added;
    },
  );
  placesApi.removeBranchHoliday.mockImplementation(
    async ({ holiday }: { holiday: BranchHoliday }) => {
      placesServer.holiday = placesServer.holiday.filter((row) => row.id !== holiday.id);
    },
  );
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

/** The member's codes for one run (the Owner's when absent). */
interface RunCodes {
  codes?: OrganizationPermission[];
}

function renderBranches(url: string, run?: RunCodes) {
  return renderBranchesRoutes(url, Page, run?.codes);
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
  for (const fn of Object.values(placesApi)) fn.mockReset();
  placesServer.room = [
    place('room', 'Room 1'),
    place('room', 'Room 2', { active: false }),
  ];
  placesServer.machine = [];
  placesServer.holiday = [];
  servePlaces();
});
afterEach(() => resetBranchesRoutes());

describe('the branch drawer — New branch (users.md:176–198)', () => {
  it('starts not main, Open, Mon–Sat 10:00–19:00, the main branch’s City and State, you on its team', async () => {
    renderBranches('/organization/acme/branches/create');
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
    renderBranches('/organization/acme/branches/create');
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
    const { router } = renderBranches('/organization/acme/branches/create');
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
      expect(router.state.location.pathname).toBe('/organization/acme/branches'),
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('branches-table-row')).toHaveLength(4),
    );
  });

  it('refuses a name another branch has (409), outlining Name', async () => {
    const user = userEvent.setup();
    renderBranches('/organization/acme/branches/create');
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

  it('fills City, State and a single Area from the PIN, from the bundled directory (feat-write-less)', async () => {
    const user = userEvent.setup();
    renderBranches('/organization/acme/branches/create');
    const panel = await drawer();
    expect(within(panel).getByTestId('branch-drawer-city')).toHaveValue('Surat');
    // 390011 is Manjalpur, Vadodara — one area.
    await user.type(within(panel).getByTestId('branch-drawer-pin'), '390011');
    await waitFor(() =>
      expect(within(panel).getByTestId('branch-drawer-city')).toHaveValue('Vadodara'),
    );
    expect(within(panel).getByTestId('branch-drawer-state')).toHaveValue('Gujarat');
    expect(within(panel).getByTestId('branch-drawer-area')).toHaveValue('Manjalpur');
    expect(within(panel).queryByTestId('branch-drawer-area-pick')).toBeNull();

    // A PIN of several areas clears the one the last PIN filled, and offers its own.
    const pin = within(panel).getByTestId('branch-drawer-pin');
    await user.clear(pin);
    await user.type(pin, '395007');
    await within(panel).findByTestId('branch-drawer-area-pick');
    expect(within(panel).getByTestId('branch-drawer-area')).toHaveValue('');
  });

  it('offers a PIN’s areas as chips, and says so for a PIN it does not know', async () => {
    const user = userEvent.setup();
    renderBranches('/organization/acme/branches/create');
    const panel = await drawer();
    const pin = within(panel).getByTestId('branch-drawer-pin');
    await user.type(pin, '395007');
    await within(panel).findByTestId('branch-drawer-area-pick');
    await user.click(within(panel).getByTestId('branch-drawer-area-pick-Piplod'));
    expect(within(panel).getByTestId('branch-drawer-area')).toHaveValue('Piplod');

    await user.clear(pin);
    await user.type(pin, '395999');
    expect(
      await within(panel).findByTestId('branch-drawer-pin-unknown'),
    ).toHaveTextContent("We don't know this PIN");
  });

  it('checks a PIN code of six digits, a phone of ten and an email that reads as one', async () => {
    const user = userEvent.setup();
    renderBranches('/organization/acme/branches/create');
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
    renderBranches(`/organization/acme/branches/${VESU.id}/edit`);
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

  it('opens on the step a link names, and saves the Google review link from it', async () => {
    const user = userEvent.setup();
    renderBranches(`/organization/acme/branches/${VESU.id}/edit?step=contact`);
    const link = await screen.findByTestId('branch-drawer-review-link');
    expect(screen.queryByTestId('branch-drawer-name')).not.toBeInTheDocument();
    await user.type(link, 'https://g.page/r/vesu/review');
    // A link is not prose: its first letter stays as typed.
    expect(link).toHaveValue('https://g.page/r/vesu/review');
    await user.click(screen.getByTestId('branch-drawer-save'));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalledWith('Vesu saved'));
    expect(sentSave().input).toMatchObject({
      reviewLink: 'https://g.page/r/vesu/review',
    });
  });

  it('closing all but one branch turns the branch UI off app-wide', async () => {
    const user = userEvent.setup();
    renderBranches(`/organization/acme/branches/${VESU.id}/edit`);
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('true:3'));
    let panel = await drawer();
    await user.click(within(panel).getByTestId('branch-drawer-status'));
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('true:2'));
    await waitFor(() => expect(screen.queryByTestId('branch-drawer')).toBeNull());

    const rows = screen.getAllByTestId('branches-table-row');
    const varachha = rows.find((row) => within(row).queryByText('Varachha'));
    if (!varachha) throw new Error('Varachha');
    await user.click(varachha);
    panel = await drawer();
    await user.click(within(panel).getByTestId('branch-drawer-status'));
    await user.click(within(panel).getByTestId('branch-drawer-save'));
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('false:1'));
    // The Branches tab itself still lists the closed ones.
    await waitFor(() => expect(screen.getAllByText('Closed')).toHaveLength(2));
    expect(screen.getAllByTestId('branches-table-row')).toHaveLength(3);
  });

  it('moves people on and off the branch with the Team field — the whole set', async () => {
    const user = userEvent.setup();
    renderBranches(`/organization/acme/branches/${VARACHHA.id}/edit`);
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
    renderBranches(`/organization/acme/branches/${VESU.id}/edit`);
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
    renderBranches(`/organization/acme/branches/${VESU.id}/edit`);
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
    renderBranches(`/organization/acme/branches/${VESU.id}/edit`, {
      codes: ['organization:read', 'membership:read', 'role:read', 'branch:read'],
    });
    const panel = await drawer();
    expect(within(panel).getByTestId('branch-drawer-name')).toBeDisabled();
    expect(within(panel).queryByTestId('branch-drawer-save')).toBeNull();
  });
});

/** Vesu's drawer with "Places & days" open, its lists read. */
async function openPlaces(user: ReturnType<typeof userEvent.setup>, codes?: RunCodes) {
  renderBranches(`/organization/acme/branches/${VESU.id}/edit`, codes);
  const panel = await drawer();
  await user.click(await within(panel).findByTestId('branch-drawer-step-places-trigger'));
  await within(panel).findByTestId('branch-drawer-places');
  return panel;
}

/** The list's rows, by what each reads. */
const rowTexts = (list: HTMLElement, testId: string) =>
  within(list)
    .queryAllByTestId(testId)
    .map((row) => row.textContent);

describe('the branch drawer — Places & days (KICKOFF §6.6, D23)', () => {
  it('is a fourth step on an existing branch only', async () => {
    renderBranches('/organization/acme/branches/create');
    const panel = await drawer();
    expect(within(panel).queryByTestId('branch-drawer-step-places')).toBeNull();
    expect(placesApi.fetchBranchPlaces).not.toHaveBeenCalled();
  });

  it('peeks at each list while collapsed, then lists them — switched-off rooms too', async () => {
    const user = userEvent.setup();
    renderBranches(`/organization/acme/branches/${VESU.id}/edit`);
    const panel = await drawer();
    const step = within(panel).getByTestId('branch-drawer-step-places');
    expect(within(step).getByText('Places & days')).toBeInTheDocument();
    // The shared step pattern: each list's names as chips, an empty list counted as not filled;
    // a step with a peek shows no sub line.
    await waitFor(() =>
      expect(
        within(step).getByTestId('branch-drawer-step-places-peek'),
      ).toHaveTextContent('Rooms: Room 1Room 2'),
    );
    expect(within(step).getByTestId('branch-drawer-step-places-peek')).toHaveTextContent(
      'Not filled: Machines, Holidays',
    );
    expect(placesApi.fetchBranchPlaces).toHaveBeenCalledWith({
      kind: 'room',
      branchId: VESU.id,
    });
    expect(placesApi.fetchBranchHolidays).toHaveBeenCalledWith({
      branchId: VESU.id,
      from: appToday(),
    });

    await user.click(within(panel).getByTestId('branch-drawer-step-places-trigger'));
    await within(panel).findByTestId('branch-drawer-places');
    const rooms = within(panel).getByTestId('branch-drawer-rooms');
    const rows = within(rooms).getAllByTestId('branch-drawer-rooms-row');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Room 1'),
      expect.stringContaining('Room 2'),
    ]);
    expect(
      within(rows[0] as HTMLElement).getByRole('switch', { name: 'Room 1 in use' }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      within(rows[1] as HTMLElement).getByTestId('branch-drawer-rooms-active'),
    ).toHaveAttribute('aria-checked', 'false');
    expect(within(panel).getByTestId('branch-drawer-machines-empty')).toHaveTextContent(
      'No machines yet',
    );
    expect(within(panel).getByTestId('branch-drawer-holidays-empty')).toHaveTextContent(
      'No holidays coming up',
    );
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('adds a room on its own — never through the drawer’s Save — and clears the row', async () => {
    const user = userEvent.setup();
    const panel = await openPlaces(user);
    const add = within(panel).getByTestId('branch-drawer-rooms-add');
    await user.type(
      within(add).getByTestId('branch-drawer-rooms-add-name'),
      'laser room',
    );
    await user.click(within(add).getByTestId('branch-drawer-rooms-add-submit'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Laser room added',
        expect.anything(),
      ),
    );
    expect(placesApi.addBranchPlace).toHaveBeenCalledWith({
      kind: 'room',
      branchId: VESU.id,
      name: 'Laser room',
      idempotencyKey: expect.any(String),
    });
    await waitFor(() =>
      expect(rowTexts(panel, 'branch-drawer-rooms-row')).toEqual([
        expect.stringContaining('Room 1'),
        expect.stringContaining('Room 2'),
        expect.stringContaining('Laser room'),
      ]),
    );
    expect(within(add).getByTestId('branch-drawer-rooms-add-name')).toHaveValue('');
    expect(api.saveBranch).not.toHaveBeenCalled();
  });

  it('asks for a name, and refuses one the branch already has (409) at the field', async () => {
    const user = userEvent.setup();
    const panel = await openPlaces(user);
    const add = within(panel).getByTestId('branch-drawer-rooms-add');
    await user.click(within(add).getByTestId('branch-drawer-rooms-add-submit'));
    expect(
      await within(add).findByTestId('branch-drawer-rooms-add-error'),
    ).toHaveTextContent('Add a name');
    expect(placesApi.addBranchPlace).not.toHaveBeenCalled();

    const name = within(add).getByTestId('branch-drawer-rooms-add-name');
    await user.type(name, 'room 2');
    await user.click(within(add).getByTestId('branch-drawer-rooms-add-submit'));
    await waitFor(() =>
      expect(within(add).getByTestId('branch-drawer-rooms-add-error')).toHaveTextContent(
        'A room called Room 2 already exists',
      ),
    );
    expect(name).toHaveAttribute('aria-invalid', 'true');
    // The text is kept to fix.
    expect(name).toHaveValue('Room 2');
    expect(placesServer.room).toHaveLength(2);
  });

  it('renames a room in its row with the read’s updated_at; Esc cancels without closing the drawer', async () => {
    const user = userEvent.setup();
    const panel = await openPlaces(user);
    const [first] = within(panel).getAllByTestId('branch-drawer-rooms-row');
    await user.click(
      within(first as HTMLElement).getByTestId('branch-drawer-rooms-row-action-rename'),
    );
    let input = await within(panel).findByTestId('branch-drawer-rooms-rename-name');
    expect(input).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(within(panel).queryByTestId('branch-drawer-rooms-rename')).toBeNull();
    expect(screen.getByTestId('branch-drawer')).toBeInTheDocument();

    const [again] = within(panel).getAllByTestId('branch-drawer-rooms-row');
    await user.click(
      within(again as HTMLElement).getByTestId('branch-drawer-rooms-row-action-rename'),
    );
    input = await within(panel).findByTestId('branch-drawer-rooms-rename-name');
    await user.clear(input);
    await user.type(input, 'Consultation room');
    await user.click(within(panel).getByTestId('branch-drawer-rooms-rename-submit'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Consultation room renamed',
        expect.anything(),
      ),
    );
    expect(placesApi.changeBranchPlace).toHaveBeenCalledWith({
      kind: 'room',
      place: expect.objectContaining({
        name: 'Room 1',
        updatedAt: '2026-10-01T05:00:00.000Z',
      }),
      change: { name: 'Consultation room' },
      idempotencyKey: expect.any(String),
    });
    await waitFor(() =>
      expect(within(panel).queryByTestId('branch-drawer-rooms-rename')).toBeNull(),
    );
    expect(rowTexts(panel, 'branch-drawer-rooms-row')[0]).toContain('Consultation room');
  });

  it('switches a room off and back on, each on its own', async () => {
    const user = userEvent.setup();
    const panel = await openPlaces(user);
    const toggle = within(panel).getByRole('switch', { name: 'Room 1 in use' });
    await user.click(toggle);
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Room 1 switched off',
        expect.anything(),
      ),
    );
    expect(placesApi.changeBranchPlace).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'room', change: { active: false } }),
    );
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Room 1 switched on',
        expect.anything(),
      ),
    );
    // The second change carries the first one's updated_at.
    expect(placesApi.changeBranchPlace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        place: expect.objectContaining({ updatedAt: '2026-10-13T06:00:00.000Z' }),
        change: { active: true },
      }),
    );
  });

  it('puts the switch back and says why when someone else changed the room first', async () => {
    const user = userEvent.setup();
    placesApi.changeBranchPlace.mockRejectedValue(
      new HttpError('Conflict', 409, '/app/branches', 'PATCH', {
        error: { reason: 'record_changed', detail: 'Someone else changed this room' },
      }),
    );
    const panel = await openPlaces(user);
    const toggle = within(panel).getByRole('switch', { name: 'Room 1 in use' });
    const reads = placesApi.fetchBranchPlaces.mock.calls.length;
    await user.click(toggle);
    // Our own words for someone else's change first (the reason, mapped), as a toast.
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    // The list is read again.
    await waitFor(() =>
      expect(placesApi.fetchBranchPlaces.mock.calls.length).toBeGreaterThan(reads),
    );
  });

  it('removes a machine through the reason confirm, with Undo', async () => {
    const user = userEvent.setup();
    placesServer.machine = [place('machine', 'Laser')];
    const panel = await openPlaces(user);
    const [laser] = within(panel).getAllByTestId('branch-drawer-machines-row');
    await user.click(
      within(laser as HTMLElement).getByTestId(
        'branch-drawer-machines-row-action-remove',
      ),
    );
    const confirm = await screen.findByTestId('confirm-dialog');
    expect(within(confirm).getByText('Remove this machine?')).toBeInTheDocument();
    expect(within(confirm).getByTestId('confirm-record')).toHaveTextContent('Laser');
    await user.click(within(confirm).getByTestId('confirm-reason-not-needed'));
    await user.click(within(confirm).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(placesApi.removeBranchPlace).toHaveBeenCalledWith({
        kind: 'machine',
        place: expect.objectContaining({ name: 'Laser' }),
        reason: 'not_needed',
        note: null,
      }),
    );
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith('Laser removed', expect.anything()),
    );
    await waitFor(() =>
      expect(
        within(panel).getByTestId('branch-drawer-machines-empty'),
      ).toBeInTheDocument(),
    );
  });

  it('adds a holiday with its date and label, and refuses a second one on that day', async () => {
    const user = userEvent.setup();
    const today = appToday();
    const panel = await openPlaces(user);
    const add = within(panel).getByTestId('branch-drawer-holidays-add');
    await user.type(
      within(add).getByTestId('branch-drawer-holidays-add-label'),
      'Diwali',
    );
    await user.click(within(add).getByTestId('branch-drawer-holidays-add-submit'));
    expect(
      await within(add).findByTestId('branch-drawer-holidays-add-error'),
    ).toHaveTextContent('Pick the date');
    expect(placesApi.addBranchHoliday).not.toHaveBeenCalled();

    await user.click(within(add).getByTestId('branch-drawer-holidays-add-date'));
    await user.click(
      await screen.findByTestId(`branch-drawer-holidays-add-date-option-${today}`),
    );
    await user.click(within(add).getByTestId('branch-drawer-holidays-add-submit'));
    await waitFor(() =>
      expect(placesApi.addBranchHoliday).toHaveBeenCalledWith({
        branchId: VESU.id,
        date: today,
        label: 'Diwali',
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(rowTexts(panel, 'branch-drawer-holidays-row')).toEqual([
        expect.stringContaining('Diwali'),
      ]),
    );
    expect(within(add).getByTestId('branch-drawer-holidays-add-label')).toHaveValue('');

    await user.type(
      within(add).getByTestId('branch-drawer-holidays-add-label'),
      'Bhai dooj',
    );
    await user.click(within(add).getByTestId('branch-drawer-holidays-add-date'));
    await user.click(
      await screen.findByTestId(`branch-drawer-holidays-add-date-option-${today}`),
    );
    await user.click(within(add).getByTestId('branch-drawer-holidays-add-submit'));
    await waitFor(() =>
      expect(
        within(add).getByTestId('branch-drawer-holidays-add-error'),
      ).toHaveTextContent('is already a holiday'),
    );
    expect(placesServer.holiday).toHaveLength(1);
  });

  it('removes a holiday through the reason confirm', async () => {
    const user = userEvent.setup();
    placesServer.holiday = [
      {
        id: 'bhd_diwali00000000000000',
        branchId: VESU.id,
        date: appToday(),
        label: 'Diwali',
        createdAt: '2026-10-01T05:00:00.000Z',
        updatedAt: '2026-10-01T05:00:00.000Z',
      },
    ];
    const panel = await openPlaces(user);
    const [diwali] = within(panel).getAllByTestId('branch-drawer-holidays-row');
    await user.click(
      within(diwali as HTMLElement).getByTestId(
        'branch-drawer-holidays-row-action-remove',
      ),
    );
    const confirm = await screen.findByTestId('confirm-dialog');
    await user.click(within(confirm).getByTestId('confirm-reason-mistake'));
    await user.click(within(confirm).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(placesApi.removeBranchHoliday).toHaveBeenCalledWith({
        holiday: expect.objectContaining({ label: 'Diwali' }),
        reason: 'mistake',
        note: null,
      }),
    );
    await waitFor(() =>
      expect(
        within(panel).getByTestId('branch-drawer-holidays-empty'),
      ).toBeInTheDocument(),
    );
  });

  it('offers each control on its own code: add on branch:create, rename and the switch on branch:update, remove on branch:delete', async () => {
    const user = userEvent.setup();
    const panel = await openPlaces(user, {
      codes: ['organization:read', 'membership:read', 'role:read', 'branch:read'],
    });
    expect(within(panel).getAllByTestId('branch-drawer-rooms-row')).toHaveLength(2);
    expect(within(panel).queryByTestId('branch-drawer-rooms-add')).toBeNull();
    expect(within(panel).queryByTestId('branch-drawer-holidays-add')).toBeNull();
    expect(
      within(panel).queryByTestId('branch-drawer-rooms-row-action-rename'),
    ).toBeNull();
    expect(
      within(panel).queryByTestId('branch-drawer-rooms-row-action-remove'),
    ).toBeNull();
    // The switch still says whether the room is in use.
    expect(within(panel).getByRole('switch', { name: 'Room 1 in use' })).toBeDisabled();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('adds without editing: branch:create alone offers the add rows and nothing else', async () => {
    const user = userEvent.setup();
    const panel = await openPlaces(user, {
      codes: [
        'organization:read',
        'membership:read',
        'role:read',
        'branch:read',
        'branch:create',
      ],
    });
    expect(within(panel).getByTestId('branch-drawer-rooms-add')).toBeInTheDocument();
    expect(within(panel).getByTestId('branch-drawer-holidays-add')).toBeInTheDocument();
    expect(
      within(panel).queryByTestId('branch-drawer-rooms-row-action-rename'),
    ).toBeNull();
    expect(
      within(panel).queryByTestId('branch-drawer-rooms-row-action-remove'),
    ).toBeNull();
  });

  it('asks before closing over a name typed and not added', async () => {
    const user = userEvent.setup();
    const panel = await openPlaces(user);
    await user.type(within(panel).getByTestId('branch-drawer-rooms-add-name'), 'Room 3');
    await user.click(within(panel).getByTestId('branch-drawer-close'));
    expect(await screen.findByText('Discard')).toBeInTheDocument();
  });

  it('says when the lists could not be read, and reads again on Retry', async () => {
    const user = userEvent.setup();
    placesApi.fetchBranchPlaces.mockRejectedValueOnce(new Error('offline'));
    renderBranches(`/organization/acme/branches/${VESU.id}/edit`);
    const panel = await drawer();
    await user.click(within(panel).getByTestId('branch-drawer-step-places-trigger'));
    expect(
      await within(panel).findByText("Couldn't load the rooms, machines and holidays"),
    ).toBeInTheDocument();
    await user.click(within(panel).getByTestId('retry-button'));
    expect(await within(panel).findByTestId('branch-drawer-places')).toBeInTheDocument();
    expect(within(panel).getAllByTestId('branch-drawer-rooms-row')).toHaveLength(2);
  });
});
