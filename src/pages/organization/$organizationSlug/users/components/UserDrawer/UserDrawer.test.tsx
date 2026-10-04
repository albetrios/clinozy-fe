import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetClinicAccessFixture } from '@/shared/api/clinic/access-api.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import {
  PLATFORM_ROLES,
  USERS_ADMIN_CODES,
} from '../../__tests__/integration/users-test-router.tsx';
import { UserDrawer } from './UserDrawer.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const api = vi.hoisted(() => ({ listMembers: vi.fn(), listRoles: vi.fn() }));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  ...api,
}));

const ACCESS = { resolved: true, canWrite: true, canDelete: false, canResend: false };

beforeEach(() => {
  viewport.tier = 'desktop';
  resetClinicFixtures();
  resetClinicAccessFixture();
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
});
afterEach(() => {
  useOrganizationStore.getState().clearPermissions();
  useAuthStore.getState().clearAuth();
  resetClinicFixtures();
  resetClinicAccessFixture();
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
    expect(within(panel).getByTestId('user-drawer-roles-front_desk')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Front desk's access in the seeded matrix (US_PERM0 with Q-K2's stock use).
    expect(within(panel).getByTestId('user-drawer-access')).toHaveTextContent(
      'Leads · Appointments · Patients · Clinic stock · Payments · Tasks',
    );
    expect(within(panel).getByTestId('user-drawer-summary')).toHaveTextContent(
      /^New user · Front desk/,
    );
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('keeps the roles in pick order — the first is the main role — and widens access', async () => {
    const user = userEvent.setup();
    const panel = await openCreate();
    await user.click(within(panel).getByTestId('user-drawer-roles-pharmacist'));
    expect(within(panel).getByTestId('user-drawer-summary')).toHaveTextContent(
      'Front desk + Pharmacist',
    );
    expect(within(panel).getByTestId('user-drawer-access')).toHaveTextContent(
      'Leads · Appointments · Patients · Medical · Clinic stock · Payments · Tasks',
    );
    await user.click(within(panel).getByTestId('user-drawer-roles-front_desk'));
    await user.click(within(panel).getByTestId('user-drawer-roles-pharmacist'));
    expect(within(panel).getByTestId('user-drawer-access')).toHaveTextContent(
      'Pick a role',
    );
  });

  it('gives Admin access to all nine sections', async () => {
    const user = userEvent.setup();
    const panel = await openCreate();
    await user.click(within(panel).getByTestId('user-drawer-roles-admin'));
    expect(within(panel).getByTestId('user-drawer-access')).toHaveTextContent(
      'Leads · Appointments · Patients · Medical · Clinic stock · Payments · Tasks · Offerings · Users',
    );
  });

  it('fills roles, days, hours and commission from Quick fill — not the colour', async () => {
    const user = userEvent.setup();
    const panel = await openCreate();
    await user.click(within(panel).getByTestId('user-drawer-colour-plum'));
    await user.click(within(panel).getByTestId('user-drawer-quick-fill-pharmacist'));
    const badges = within(panel).getByTestId('user-drawer-badges');
    expect(badges).toHaveTextContent('Pharmacist');
    expect(badges).toHaveTextContent('Every day · 09:00–21:00');
    expect(within(panel).getByTestId('user-drawer-colour-plum')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('shows the picked colour with the person’s initials once a name is typed', async () => {
    const user = userEvent.setup();
    const panel = await openCreate();
    expect(within(panel).getByTestId('user-drawer-colour-sky')).toHaveTextContent('✓');
    await user.type(within(panel).getByTestId('user-drawer-name'), 'Dr. Nisha Mavani');
    expect(within(panel).getByTestId('user-drawer-colour-sky')).toHaveTextContent('NM');
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
