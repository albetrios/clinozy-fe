import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { presetOfRole } from '@/shared/api/clinic/access-contracts.ts';
import { teamMemberOf } from '@/shared/api/clinic/users-api.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { PRESET_CODES } from '@/tests/utils/clinic-preset-codes.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import {
  member,
  PLATFORM_ROLES,
  USERS_ADMIN_CODES,
} from '../../__tests__/integration/users-test-router.tsx';
import { UserDrawer } from './UserDrawer.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const api = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
  getRolePermissions: vi.fn(),
}));
const writes = vi.hoisted(() => ({ resend: vi.fn() }));
vi.mock('@/shared/hooks/useInvitations/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useResendInvitation: () => ({ mutate: writes.resend, isPending: false }),
}));

vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  ...api,
}));

const ACCESS = {
  resolved: true,
  canWrite: true,
  canDelete: false,
  canLeave: false,
  canResend: false,
};

/** A role's codes, as clinozy-be provisions the preset it is. */
function codesOf(roleId: string) {
  const role = Object.values(PLATFORM_ROLES).find((each) => each.id === roleId);
  const preset = role ? presetOfRole(role) : null;
  return Promise.resolve(preset ? [...PRESET_CODES[preset]] : ['organization:read']);
}

const roleChip = (role: keyof typeof PLATFORM_ROLES) =>
  `user-drawer-roles-${PLATFORM_ROLES[role].id}`;

beforeEach(() => {
  viewport.tier = 'desktop';
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore.getState().setPermissions(USERS_ADMIN_CODES);
  useAuthStore.getState().setUser({
    id: 'usr_riya',
    email: 'riya@cresence.skin',
    role: 'user',
    name: 'Riya Shah',
  });
  api.listMembers.mockResolvedValue({ rows: [], next: null, hasMore: false });
  api.listRoles.mockResolvedValue({
    rows: Object.values(PLATFORM_ROLES),
    next: null,
    hasMore: false,
  });
  api.getRolePermissions.mockImplementation(codesOf);
});
afterEach(() => {
  useOrganizationStore.getState().clearPermissions();
  useAuthStore.getState().clearAuth();
});

/** The New user drawer, once its form is up. */
async function openCreate(access = ACCESS) {
  renderWithProviders(
    <UserDrawer
      mode="create"
      open
      access={access}
      onClose={vi.fn()}
      onCreated={vi.fn()}
    />,
  );
  await screen.findByTestId('user-drawer-step-profile');
  return screen.getByTestId('user-drawer');
}

describe('UserDrawer — New user (users.md:99–124)', () => {
  it('opens on step 1 with the header, badges, Quick fill and the starting values', async () => {
    const panel = await openCreate();
    expect(within(panel).getByText('New user')).toBeInTheDocument();
    expect(
      within(panel).getByText('Sign-in, roles, branches and working hours'),
    ).toBeInTheDocument();
    const badges = within(panel).getByTestId('user-drawer-badges');
    expect(badges).toHaveTextContent('Front desk');
    expect(badges).toHaveTextContent('Mon–Sat · 10:00–19:00');
    expect(badges).toHaveTextContent('Active');
    expect(within(panel).getByTestId(roleChip('front_desk'))).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The rooms the Front desk preset's codes view.
    expect(await within(panel).findByTestId('user-drawer-access')).toHaveTextContent(
      'Leads · Appointments · Patients · Clinic stock · Payments · Tasks · Offerings',
    );
    // A new user is invited by email: their name is theirs to set.
    expect(within(panel).queryByTestId('user-drawer-name')).toBeNull();
    expect(within(panel).getByTestId('user-drawer-summary')).toHaveTextContent(
      /^New user · Front desk/,
    );
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('keeps the roles in pick order — the first is the main role — and widens access', async () => {
    const user = userEvent.setup();
    const panel = await openCreate();
    await user.click(within(panel).getByTestId(roleChip('pharmacist')));
    expect(within(panel).getByTestId('user-drawer-summary')).toHaveTextContent(
      'Front desk + Pharmacist',
    );
    await waitFor(() =>
      expect(within(panel).getByTestId('user-drawer-access')).toHaveTextContent(
        'Leads · Appointments · Patients · Medical · Clinic stock · Payments · Tasks · Offerings',
      ),
    );
    await user.click(within(panel).getByTestId(roleChip('front_desk')));
    await user.click(within(panel).getByTestId(roleChip('pharmacist')));
    expect(within(panel).getByTestId('user-drawer-access')).toHaveTextContent(
      'Pick a role',
    );
  });

  it('gives Admin access to all nine sections', async () => {
    const user = userEvent.setup();
    const panel = await openCreate();
    await user.click(within(panel).getByTestId(roleChip('admin')));
    await waitFor(() =>
      expect(within(panel).getByTestId('user-drawer-access')).toHaveTextContent(
        'Leads · Appointments · Patients · Medical · Clinic stock · Payments · Tasks · Offerings · Users',
      ),
    );
  });

  it('fills the preset’s role, days, hours and commission from Quick fill — not the colour', async () => {
    const user = userEvent.setup();
    const panel = await openCreate();
    await user.click(within(panel).getByTestId('user-drawer-colour-plum'));
    await user.click(within(panel).getByTestId('user-drawer-quick-fill-pharmacist'));
    const badges = within(panel).getByTestId('user-drawer-badges');
    expect(badges).toHaveTextContent('Pharmacist');
    expect(badges).toHaveTextContent('Every day · 09:00–21:00');
    expect(within(panel).getByTestId(roleChip('pharmacist'))).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(panel).getByTestId(roleChip('front_desk'))).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(panel).getByTestId('user-drawer-colour-plum')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('marks the picked colour "✓" while the person has no name yet', async () => {
    const panel = await openCreate();
    expect(within(panel).getByTestId('user-drawer-colour-sky')).toHaveTextContent('✓');
  });

  it('is view only without the right to invite, with the read-only note', async () => {
    const panel = await openCreate({ ...ACCESS, canWrite: false });
    expect(within(panel).queryByTestId('user-drawer-save')).toBeNull();
    expect(within(panel).queryByTestId('user-drawer-quick-fill')).toBeNull();
    expect(
      within(panel).getByText('View only · your role can’t change this'),
    ).toBeInTheDocument();
  });

  it('shows its skeleton, not "View only", until the access is known', async () => {
    renderWithProviders(
      <UserDrawer
        mode="create"
        open
        access={{ ...ACCESS, resolved: false, canWrite: false }}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );
    const panel = await screen.findByTestId('user-drawer');
    expect(within(panel).getByTestId('skeleton-rows')).toBeInTheDocument();
    expect(
      within(panel).queryByText('View only · your role can’t change this'),
    ).toBeNull();
  });

  it('is the full screen on a phone, its × inside the header', async () => {
    viewport.tier = 'phone';
    const panel = await openCreate();
    expect(within(panel).getByTestId('user-drawer-close').className).toContain('end-2');
  });
});

/** The Edit user drawer for `teamMember`, once its form is up. */
async function openEdit(teamMember: TeamMember, access = { ...ACCESS, canResend: true }) {
  renderWithProviders(
    <UserDrawer
      mode="edit"
      open
      member={teamMember}
      access={access}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onDelete={vi.fn()}
      onLeave={vi.fn()}
    />,
  );
  await screen.findByTestId('user-drawer-step-profile');
  return screen.getByTestId('user-drawer');
}

describe('UserDrawer — Edit user', () => {
  it('shows the name read-only — the person sets it on their own profile — and the roles held', async () => {
    const panel = await openEdit(
      teamMemberOf(
        member('reenal', 'reenal@cresence.skin', [PLATFORM_ROLES.doctor], {
          name: 'Dr. Reenal Chaniyara',
          staffNumber: 11,
        }),
        null,
      ),
    );
    expect(within(panel).getByTestId('user-drawer-name')).toHaveValue(
      'Dr. Reenal Chaniyara',
    );
    expect(within(panel).getByTestId('user-drawer-name')).toHaveAttribute('readonly');
    expect(within(panel).getByTestId('user-drawer-email')).toHaveAttribute('readonly');
    expect(within(panel).getByTestId(roleChip('doctor'))).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(panel).getByTestId('user-drawer-colour-sky')).toHaveTextContent('RC');
  });

  it('keeps the owner’s roles as they are', async () => {
    const panel = await openEdit(
      teamMemberOf(member('owner', 'owner@cresence.skin', [PLATFORM_ROLES.owner]), null),
    );
    expect(within(panel).getByTestId(roleChip('doctor'))).toBeDisabled();
  });

  it('resends an expired invitation by the membership', async () => {
    const user = userEvent.setup();
    const invited = teamMemberOf(
      member('new', 'new@clinic.com', [PLATFORM_ROLES.front_desk], {
        status: 'invited',
        joinedAt: '',
        invitation: { id: 'inv_new', expiresAt: '2020-01-01T00:00:00.000Z' },
      }),
      null,
    );
    const panel = await openEdit(invited);
    await user.click(within(panel).getByTestId('user-drawer-step-hours-trigger'));
    expect(await within(panel).findByText('Invitation expired')).toBeInTheDocument();
    await user.click(within(panel).getByTestId('user-drawer-resend'));
    expect(writes.resend).toHaveBeenCalledWith(invited.membershipId);
  });
});
