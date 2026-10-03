import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { resetPresenceFixture } from '@/shared/api/clinic/presence-api.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { AccountMenu } from './AccountMenu.tsx';

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }));
vi.mock('@/shared/auth/service.ts', () => ({ logout: logoutMock }));
vi.mock('@/shared/components/OrganizationSwitcher/index.ts', () => ({
  OrganizationSwitcher: () => null,
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  resetPresenceFixture();
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
