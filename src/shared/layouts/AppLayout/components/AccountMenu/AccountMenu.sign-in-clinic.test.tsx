import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as PresenceApiModule from '@/shared/api/app/presence-api.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import type { UseSignInClinicResult } from '@/shared/hooks/useSignInClinic/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import type { MyOrganizationSummary } from '@/shared/tenancy/my-organization-summaries.ts';
import { presetMyRoles } from '@/tests/utils/app-preset-codes.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { AccountMenu } from './AccountMenu.tsx';

/*
 * "Opens at sign-in ▸" (feat-choose-default-clinic D3): the clinic used last or one pinned clinic,
 * chosen in one tap from the account menu, over a mocked useSignInClinic.
 */

vi.mock('@/shared/api/app/presence-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PresenceApiModule>()),
  fetchMyPresence: async () => 'online',
  saveMyPresence: async (next: string) => next,
}));
vi.mock('@/shared/auth/service.ts', () => ({ logout: vi.fn() }));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: () => ({ data: { myRoles: presetMyRoles('owner') } }),
}));
vi.mock('@/shared/components/OrganizationSwitcher/index.ts', () => ({
  OrganizationSwitcher: () => null,
}));
vi.mock('@/shared/tenancy/my-invitations.ts', () => ({
  useMyInvitations: () => ({ data: [] }),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function clinic(id: string, name: string, slug: string): MyOrganizationSummary {
  return {
    id,
    name,
    slug,
    type: 'TEAM',
    status: 'ACTIVE',
    logoUrl: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    isActive: false,
  };
}

const CLINICS = [
  clinic('org_ojas', 'Ojas Dermatology & Aesthetics', 'ojas-dermatology-aesthetics'),
  clinic('org_demo', 'Demo Organization', 'demo-org'),
];

const hook = vi.hoisted(() => ({
  value: undefined as unknown as UseSignInClinicResult,
  choose: vi.fn(),
}));
vi.mock('@/shared/hooks/useSignInClinic/index.ts', () => ({
  useSignInClinic: () => hook.value,
}));

function withHook(overrides: Partial<UseSignInClinicResult>) {
  hook.value = {
    clinics: CLINICS,
    pinnedId: null,
    canChoose: true,
    choose: hook.choose,
    ...overrides,
  };
}

async function openSignInSubmenu() {
  const user = userEvent.setup();
  await user.click(await screen.findByTestId('user-menu-trigger'));
  const row = await screen.findByTestId('account-menu-sign-in-clinic');
  await user.click(row);
  return {
    user,
    row,
    submenu: await screen.findByRole('menu', { name: /^Opens at sign-in/ }),
  };
}

beforeEach(() => {
  hook.choose.mockReset();
  withHook({});
  useAuthStore.setState({
    user: {
      id: 'usr_1',
      email: 'riya@acme.test',
      name: 'Riya Shah',
      role: 'user',
    } as AuthUser,
  });
});

describe('AccountMenu — Opens at sign-in', () => {
  it('shows the current choice on the row: "Last used" until a clinic is pinned', async () => {
    renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    const { row } = await openSignInSubmenu();

    expect(row).toHaveTextContent('Opens at sign-in');
    expect(row).toHaveTextContent('Last used');
  });

  it('names the pinned clinic on the row and checks it in the submenu', async () => {
    withHook({ pinnedId: 'org_demo' });
    renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    const { row, submenu } = await openSignInSubmenu();

    expect(row).toHaveTextContent('Demo Organization');
    expect(
      within(submenu).getByRole('menuitemradio', { name: /Demo Organization/ }),
    ).toBeChecked();
    expect(
      within(submenu).getByRole('menuitemradio', { name: /The clinic I used last/ }),
    ).not.toBeChecked();
  });

  it('pins a clinic in one tap, and goes back to automatic', async () => {
    renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    const { user, submenu } = await openSignInSubmenu();

    // By keyboard: jsdom has no layout for Radix's pointer grace area, so a pointer move from the
    // row into the submenu closes it before the click lands.
    within(submenu).getByTestId('account-menu-sign-in-clinic-demo-org').focus();
    await user.keyboard('{Enter}');
    expect(hook.choose).toHaveBeenLastCalledWith('org_demo');

    withHook({ pinnedId: 'org_demo' });
    const again = await openSignInSubmenu();
    within(again.submenu).getByTestId('account-menu-sign-in-clinic-automatic').focus();
    await again.user.keyboard('{Enter}');
    expect(hook.choose).toHaveBeenLastCalledWith(null);
  });

  it('is absent with nothing to choose', async () => {
    withHook({ canChoose: false, clinics: CLINICS.slice(0, 1) });
    renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('user-menu-trigger'));

    await screen.findByRole('menu', { name: 'Account' });
    expect(screen.queryByTestId('account-menu-sign-in-clinic')).not.toBeInTheDocument();
  });

  it('has no accessibility violations with the submenu open', async () => {
    renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    const { submenu } = await openSignInSubmenu();

    expect(await axe(submenu)).toHaveNoViolations();
  });
});
