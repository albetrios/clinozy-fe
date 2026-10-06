import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as RequireModule from '@/core/security/gates/require-module.ts';
import { resetPresenceFixture } from '@/shared/api/clinic/presence-api.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { AccountMenu } from './AccountMenu.tsx';

const { logoutMock, disabledModules, platformOverrides } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
  disabledModules: new Set<string>(),
  platformOverrides: { themeLock: false },
}));
vi.mock('@/shared/auth/service.ts', () => ({ logout: logoutMock }));
vi.mock('@/core/config/env.ts', async (importOriginal) => {
  const actual = await importOriginal<{ platformConfig: Record<string, unknown> }>();
  return {
    ...actual,
    platformConfig: {
      ...actual.platformConfig,
      get themeLock() {
        return platformOverrides.themeLock;
      },
    },
  };
});
// The deployment's module switch (`VITE_DISABLED_MODULES`), read through the
// same gate the Settings rail uses.
vi.mock('@/core/security/gates/require-module.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof RequireModule>()),
  isModuleEnabled: (moduleKey: string) => !disabledModules.has(moduleKey),
}));
vi.mock('@/shared/components/OrganizationSwitcher/index.ts', () => ({
  OrganizationSwitcher: () => null,
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  resetPresenceFixture();
  disabledModules.clear();
  platformOverrides.themeLock = false;
  logoutMock.mockReset().mockResolvedValue(undefined);
  useAuthStore.setState({
    user: {
      id: 'usr_1',
      email: 'riya@acme.test',
      name: 'Riya Shah',
      role: 'user',
    } as AuthUser,
  });
  useOrganizationStore
    .getState()
    .setPermissions(['organization:read', 'organization:delete']);
  useThemeStore.getState().setTheme('light');
});

async function openMenu() {
  const user = userEvent.setup();
  await user.click(await screen.findByTestId('user-menu-trigger'));
  return { user, menu: await screen.findByRole('menu', { name: 'Account' }) };
}

describe('AccountMenu', () => {
  it('names the avatar with the presence and shows the identity block', async () => {
    renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    expect(await screen.findByTestId('user-menu-trigger')).toHaveAccessibleName(
      'Riya Shah · Online',
    );
    const { menu } = await openMenu();
    const identity = within(menu).getByTestId('account-menu-identity');
    expect(identity).toHaveTextContent('Riya Shah');
    expect(identity).toHaveTextContent('riya@acme.test');
    expect(identity).toHaveTextContent(/owner/i);
  });

  it('switches the appearance from its radio pills', async () => {
    renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    const { user, menu } = await openMenu();
    await user.click(within(menu).getByTestId('account-menu-theme-dark'));
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('hides the mode pills on a theme-locked deployment, keeping the Appearance row', async () => {
    platformOverrides.themeLock = true;
    renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    const { menu } = await openMenu();
    expect(within(menu).queryByTestId('account-menu-theme-dark')).not.toBeInTheDocument();
    expect(within(menu).getByTestId('account-menu-appearance')).toBeInTheDocument();
  });

  it('opens the Appearance drawer from the row under the mode pills', async () => {
    useUIStore.setState({ appearanceOpen: false });
    renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    const { user, menu } = await openMenu();
    const row = within(menu).getByTestId('account-menu-appearance');
    expect(row).toHaveAccessibleName('Appearance & language');
    // Right under the Light · Dark · System pills, before the platform rows.
    const items = [...menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"]')];
    const systemPill = within(menu).getByTestId('account-menu-theme-system');
    expect(items.indexOf(row)).toBe(items.indexOf(systemPill) + 1);

    await user.click(row);

    expect(useUIStore.getState().appearanceOpen).toBe(true);
    act(() => useUIStore.setState({ appearanceOpen: false }));
  });

  it('opens the inbox and the shortcuts from their rows', async () => {
    const onOpenNotifications = vi.fn();
    renderWithProviders(<AccountMenu onOpenNotifications={onOpenNotifications} />);
    let { user, menu } = await openMenu();
    await user.click(within(menu).getByTestId('account-menu-notifications'));
    expect(onOpenNotifications).toHaveBeenCalled();
    ({ user, menu } = await openMenu());
    await user.click(within(menu).getByTestId('account-menu-shortcuts'));
    expect(useUIStore.getState().shortcutsOpen).toBe(true);
  });

  it('logs out with the reason', async () => {
    renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    const { user, menu } = await openMenu();
    await user.click(within(menu).getByTestId('logout-button'));
    await waitFor(() => expect(logoutMock).toHaveBeenCalledWith({ reason: 'logout' }));
  });

  it('has no axe violations when open', async () => {
    renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    const { menu } = await openMenu();
    expect(await axe(menu)).toHaveNoViolations();
  });
});

describe('AccountMenu — a module-gated row follows its module', () => {
  it('opens the Billing section from its row while billing is on', async () => {
    const { router } = renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    const { user, menu } = await openMenu();
    await user.click(within(menu).getByTestId('account-menu-billing'));
    await waitFor(() =>
      expect(router.state.location.hash).toBe('settings/account/billing'),
    );
  });

  it('drops the Billing row when the deployment disables billing, as the Settings rail does', async () => {
    disabledModules.add('billing');
    renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    const { menu } = await openMenu();

    expect(within(menu).queryByTestId('account-menu-billing')).not.toBeInTheDocument();
    // Sections without a module gate keep their rows.
    for (const id of [
      'user-menu-settings',
      'account-menu-security',
      'account-menu-devices',
    ]) {
      expect(within(menu).getByTestId(id)).toBeInTheDocument();
    }
  });

  it('keeps every row when only a module no row opens is off', async () => {
    disabledModules.add('members');
    renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
    const { menu } = await openMenu();

    expect(within(menu).getByTestId('account-menu-billing')).toBeInTheDocument();
  });
});
