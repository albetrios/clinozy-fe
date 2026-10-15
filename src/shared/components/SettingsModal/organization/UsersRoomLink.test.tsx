import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { UsersRoomLink, UsersRoomLinkCard } from './UsersRoomLink.tsx';

function hold(codes: OrganizationPermission[]) {
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore.getState().setPermissions(codes);
}

/** The link inside Settings (the hash) over a page, beside the three room routes. */
function renderLink(section: 'members' | 'roles' | 'branches') {
  const root = createRootRoute();
  const page = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/today',
    // Branches has no section of its own: Settings › Clinic draws its card.
    component: () =>
      section === 'branches' ? (
        <UsersRoomLinkCard target="branches" />
      ) : (
        <UsersRoomLink section={section} />
      ),
  });
  const team = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/users',
    component: () => <p data-testid="room">team</p>,
  });
  const roles = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/users/roles',
    component: () => <p data-testid="room">roles</p>,
  });
  const branches = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/branches',
    component: () => <p data-testid="room">branches</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([page, team, roles, branches]),
    history: createMemoryHistory({
      initialEntries: [
        `/organization/acme/today#settings/organization/${section === 'branches' ? 'clinic' : section}`,
      ],
    }),
  });
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

afterEach(() => {
  // Still mounted here: the store write re-renders whatever reads it.
  act(() => useOrganizationStore.getState().clearOrganization());
});

describe('UsersRoomLink', () => {
  it('says what moved and opens the Team, leaving the Settings hash behind', async () => {
    const user = userEvent.setup();
    hold(['membership:read', 'role:read']);
    const { router, container } = renderLink('members');
    const section = await screen.findByTestId('settings-organization-members');
    expect(section).toHaveTextContent('Members now live in Users');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByTestId('settings-members-open-users'));
    await waitFor(() => expect(screen.getByTestId('room')).toHaveTextContent('team'));
    expect(router.state.location.pathname).toBe('/organization/acme/users');
    expect(router.state.location.hash).toBe('');
  });

  it('opens Roles & access from the Roles section', async () => {
    const user = userEvent.setup();
    hold(['membership:read', 'role:read']);
    const { router } = renderLink('roles');
    expect(await screen.findByTestId('settings-organization-roles')).toHaveTextContent(
      'Roles now live in Users',
    );
    await user.click(screen.getByTestId('settings-roles-open-users'));
    await waitFor(() => expect(screen.getByTestId('room')).toHaveTextContent('roles'));
    expect(router.state.location.pathname).toBe('/organization/acme/users/roles');
  });

  it('opens the Branches room from the Clinic section, leaving the Settings hash behind', async () => {
    const user = userEvent.setup();
    hold(['organization:read', 'branch:read']);
    const { router, container } = renderLink('branches');
    const open = await screen.findByTestId('settings-branches-open-branches');
    expect(open.closest('section')).toHaveTextContent('Each branch holds the rest');
    expect(await axe(container)).toHaveNoViolations();
    await user.click(open);
    await waitFor(() => expect(screen.getByTestId('room')).toHaveTextContent('branches'));
    expect(router.state.location.pathname).toBe('/organization/acme/branches');
    expect(router.state.location.hash).toBe('');
  });
});
