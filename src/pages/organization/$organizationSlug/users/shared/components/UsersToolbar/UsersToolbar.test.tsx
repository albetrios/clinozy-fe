import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  renderUsersRoutes,
  resetUsersRoutes,
} from '../../../__tests__/integration/users-test-router.tsx';
import { UsersToolbar } from './UsersToolbar.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

afterEach(() => {
  viewport.tier = 'desktop';
  resetUsersRoutes();
});

describe('UsersToolbar (users.md:17)', () => {
  it('draws the h1, the tabs as links, the search and "New user"', async () => {
    const onNew = vi.fn();
    const { container } = renderUsersRoutes('/organization/acme/users', () => (
      <UsersToolbar
        tab="team"
        search
        primary={{ id: 'new-user', label: 'New user', onSelect: onNew }}
      />
    ));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Users' }),
    ).toBeInTheDocument();
    const team = screen.getByRole('link', { name: 'Team' });
    expect(team).toHaveAttribute('href', '/organization/acme/users');
    expect(team).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('searchbox', { name: 'Search users' })).toBeInTheDocument();
    screen.getByTestId('users-team-new-user').click();
    expect(onNew).toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('floats "New user" as the 52px pill on a phone', async () => {
    viewport.tier = 'phone';
    renderUsersRoutes('/organization/acme/users', () => (
      <UsersToolbar
        tab="team"
        primary={{ id: 'new-user', label: 'New user', onSelect: vi.fn() }}
      />
    ));
    expect(await screen.findByTestId('users-team-fab')).toHaveAttribute(
      'data-slot',
      'fab',
    );
  });

  it('links Roles & access and marks it current on its page', async () => {
    renderUsersRoutes('/organization/acme/users/roles', vi.fn(), {
      Roles: () => <UsersToolbar tab="roles" />,
    });
    const roles = await screen.findByRole('link', { name: 'Roles & access' });
    expect(roles).toHaveAttribute('href', '/organization/acme/users/roles');
    expect(roles).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Team' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('has no Branches tab — Branches is its own room', async () => {
    renderUsersRoutes('/organization/acme/users', () => <UsersToolbar tab="team" />);
    await screen.findByRole('link', { name: 'Team' });
    expect(screen.queryByRole('link', { name: 'Branches' })).not.toBeInTheDocument();
  });

  it('keeps Roles & access current behind a drawer opened from it', async () => {
    renderUsersRoutes('/organization/acme/users/mbr_riya/edit?from=roles', () => (
      <UsersToolbar tab="roles" />
    ));
    expect(await screen.findByRole('link', { name: 'Roles & access' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('has no search without the Team and no "New …" without the right to create', async () => {
    renderUsersRoutes('/organization/acme/users', () => <UsersToolbar tab="team" />);
    await screen.findByRole('heading', { level: 1, name: 'Users' });
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByTestId('users-team-new-user')).toBeNull();
  });
});
