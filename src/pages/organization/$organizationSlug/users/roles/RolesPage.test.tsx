import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import { member, PLATFORM_ROLES, SELF } from '@/tests/utils/team-doubles.ts';

import {
  renderUsersRoutes,
  resetUsersRoutes,
} from '../__tests__/integration/users-test-router.tsx';
import { RolesPage } from './RolesPage.tsx';

// jsdom has no layout: pin the desktop tier, where both panes show.
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
  readViewportTier: () => 'desktop',
}));

const api = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
  getRolePermissions: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  ...api,
}));

beforeEach(() => {
  api.listMembers.mockResolvedValue({
    rows: [member('riya', SELF.email, PLATFORM_ROLES.admin, { userId: SELF.userId })],
    next: null,
    hasMore: false,
  });
  api.listRoles.mockResolvedValue({
    rows: Object.values(PLATFORM_ROLES),
    next: null,
    hasMore: false,
  });
  api.getRolePermissions.mockResolvedValue(['organization:read']);
});
afterEach(() => resetUsersRoutes());

describe('RolesPage (users/roles, S:107)', () => {
  it('is the Roles & access tab, on Front desk until the URL names a role by its id', async () => {
    const { container } = renderUsersRoutes('/organization/acme/users/roles', vi.fn(), {
      Roles: RolesPage,
    });
    const page = await screen.findByTestId('users-roles-page');
    expect(
      within(page).getByRole('heading', { level: 1, name: 'Users' }),
    ).toBeInTheDocument();
    expect(within(page).getByRole('link', { name: 'Roles & access' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      await within(page).findByRole('heading', { level: 2, name: 'Front desk' }),
    ).toBeInTheDocument();
    expect(within(page).getByTestId('users-roles-new-role')).toHaveTextContent(
      'New role',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens the role the URL names by its id', async () => {
    renderUsersRoutes(
      `/organization/acme/users/roles?role=${PLATFORM_ROLES.accountant.id}`,
      vi.fn(),
      { Roles: RolesPage },
    );
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Accountant' }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`users-roles-item-${PLATFORM_ROLES.accountant.id}`),
    ).toHaveAttribute('aria-current', 'true');
  });
});
