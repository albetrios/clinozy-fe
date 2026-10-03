import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { PageManifest } from '@/lib/routes/page-manifest.ts';
import { resetPreferencesFixture } from '@/shared/api/clinic/preferences-api.ts';
import { resetPresenceFixture } from '@/shared/api/clinic/presence-api.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAppNav } from '@/shared/hooks/useAppNav/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { SectionBarShell } from './AppLayoutSectionBar.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/components/OrganizationSwitcher/index.ts', () => ({
  OrganizationSwitcher: () => null,
}));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: () => ({ data: undefined }),
}));

const ORG = '/organization/$organizationSlug';
const ROOMS = [
  'today',
  'leads',
  'appointments',
  'patients',
  'medical',
  'stock',
  'payments',
  'tasks',
  'offerings',
  'users',
] as const;

function roomManifest(section: string): PageManifest {
  return {
    segment: section,
    path: `${ORG}/${section}`,
    title: section,
    testId: `${section}-page`,
    permission: 'organization:read',
    kind: 'leaf',
    children: [],
    nav: { id: section, section },
  };
}

function Shell() {
  const { entries } = useAppNav('organization');
  return <SectionBarShell navItems={entries} organizationSlug="acme" />;
}

function renderShell(path = '/organization/acme/leads') {
  const root = createRootRoute({ component: () => <Outlet /> });
  const org = createRoute({ getParentRoute: () => root, path: ORG, component: Shell });
  const rooms = ROOMS.map((section) =>
    createRoute({
      getParentRoute: () => org,
      path: section,
      staticData: { manifest: roomManifest(section) },
      component: () => <h1>{section}</h1>,
    }),
  );
  const router = createRouter({
    routeTree: root.addChildren([org.addChildren(rooms)]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const header = () => screen.findByTestId('header');

beforeEach(() => {
  resetPreferencesFixture();
  resetPresenceFixture();
  notifyMock.success.mockReset();
  notifyMock.info.mockReset();
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
  useUIStore.getState().setPreviewRole(null);
});

describe('SectionBarShell — header', () => {
  it('draws the mark, All sections and the default pins in pin order', async () => {
    renderShell();
    const tabs = await within(await header()).findAllByRole('link');
    expect(tabs.map((tab) => tab.dataset.testid)).toEqual([
      'nav-appointments',
      'nav-leads',
      'nav-patients',
      'nav-payments',
    ]);
    expect(
      within(await header()).getByRole('img', { name: /clinozy/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('all-sections-trigger')).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
  });

  it('marks the pinned current room and tints its tab', async () => {
    renderShell('/organization/acme/leads');
    const leads = await within(await header()).findByTestId('nav-leads');
    expect(leads).toHaveAttribute('aria-current', 'page');
    expect(leads.className).toContain('bg-tone-lav');
    expect(within(await header()).getByTestId('nav-patients')).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByTestId('all-sections-trigger')).not.toHaveAttribute(
      'data-current-unpinned',
    );
  });

  it('shows an unpinned current room through the All sections button', async () => {
    renderShell('/organization/acme/today');
    await within(await header()).findByTestId('nav-leads');
    expect(screen.getByTestId('all-sections-trigger')).toHaveAttribute(
      'data-current-unpinned',
      'true',
    );
    expect(within(await header()).queryByTestId('nav-today')).toBeNull();
    expect(screen.getByTestId('section-chip')).toHaveTextContent(/today/i);
  });
});

describe('SectionBarShell — All sections', () => {
  it('lists every viewable room and pins one to the bar', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(await screen.findByTestId('all-sections-trigger'));
    const dialog = await screen.findByRole('dialog', { name: /all sections/i });
    expect(within(dialog).getAllByRole('link')).toHaveLength(ROOMS.length);
    const pin = within(dialog).getByTestId('all-sections-pin-tasks');
    expect(pin).toHaveAttribute('aria-pressed', 'false');
    await user.click(pin);
    await waitFor(() => expect(pin).toHaveAttribute('aria-pressed', 'true'));
    expect(within(await header()).getByTestId('nav-tasks')).toBeInTheDocument();
  });

  it('narrows to the View-as role and shows the pill until Exit', async () => {
    const user = userEvent.setup();
    renderShell();
    await within(await header()).findByTestId('nav-leads');
    act(() => useUIStore.getState().setPreviewRole('doctor'));
    const pill = await screen.findByTestId('view-as-bar');
    expect(pill).toHaveTextContent(/previewing as doctor/i);
    expect(within(await header()).queryByTestId('nav-payments')).toBeNull();
    await user.click(within(pill).getByTestId('view-as-exit'));
    expect(screen.queryByTestId('view-as-bar')).toBeNull();
    expect(notifyMock.success).toHaveBeenCalledWith('Back to your own access');
  });
});

describe('SectionBarShell — Account menu', () => {
  it('sets the presence from the Status pills', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(await screen.findByTestId('user-menu-trigger'));
    const menu = await screen.findByRole('menu', { name: /account/i });
    expect(within(menu).getByText('riya@acme.test')).toBeInTheDocument();
    await user.click(within(menu).getByTestId('account-menu-status-away'));
    await waitFor(() =>
      expect(screen.getByTestId('user-menu-trigger')).toHaveAccessibleName(
        'Riya Shah · Away',
      ),
    );
    expect(notifyMock.success).toHaveBeenCalledWith('Status · Away');
  });

  it('carries the relocated platform rows and Log out', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(await screen.findByTestId('user-menu-trigger'));
    const menu = await screen.findByRole('menu', { name: /account/i });
    for (const id of [
      'account-menu-notifications',
      'user-menu-settings',
      'account-menu-security',
      'account-menu-billing',
      'account-menu-devices',
      'account-menu-shortcuts',
      'logout-button',
    ]) {
      expect(within(menu).getByTestId(id)).toBeInTheDocument();
    }
  });
});

describe('SectionBarShell — phone tab bar', () => {
  it('holds the first four pins and "More", which names an unpinned current room', async () => {
    renderShell('/organization/acme/tasks');
    const bar = await screen.findByTestId('mobile-bottom-bar');
    await within(bar).findByTestId('nav-appointments');
    expect(within(bar).getAllByRole('link')).toHaveLength(4);
    const more = within(bar).getByTestId('nav-more-sections');
    expect(more).toHaveTextContent(/tasks/i);
    expect(more).toHaveAttribute('aria-current', 'page');
  });

  it('reads "More" when the current room is pinned', async () => {
    renderShell('/organization/acme/patients');
    const bar = await screen.findByTestId('mobile-bottom-bar');
    await within(bar).findByTestId('nav-patients');
    expect(within(bar).getByTestId('nav-more-sections')).toHaveTextContent('More');
  });
});

describe('SectionBarShell — keyboard (shell.md:46)', () => {
  it('toggles All sections on G', async () => {
    const user = userEvent.setup();
    renderShell();
    await screen.findByTestId('all-sections-trigger');
    await user.keyboard('g');
    expect(
      await screen.findByRole('dialog', { name: /all sections/i }),
    ).toBeInTheDocument();
    await user.keyboard('g');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /all sections/i })).toBeNull(),
    );
  });

  it('opens the 1st room on 1 and the 10th on 0, in list order', async () => {
    const user = userEvent.setup();
    const router = renderShell('/organization/acme/leads');
    await screen.findByTestId('all-sections-trigger');
    await user.keyboard('1');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/today'),
    );
    await user.keyboard('0');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users'),
    );
  });

  it('is typing, not a shortcut, inside a text field', async () => {
    const user = userEvent.setup();
    const router = renderShell('/organization/acme/leads');
    await screen.findByTestId('all-sections-trigger');
    const field = document.createElement('input');
    document.body.append(field);
    field.focus();
    await user.keyboard('g1');
    expect(screen.queryByRole('dialog', { name: /all sections/i })).toBeNull();
    expect(router.state.location.pathname).toBe('/organization/acme/leads');
    field.remove();
  });

  it('stands down with Ctrl held and under a modal surface', async () => {
    const user = userEvent.setup();
    const router = renderShell('/organization/acme/leads');
    await screen.findByTestId('all-sections-trigger');
    await user.keyboard('{Control>}1{/Control}');
    expect(router.state.location.pathname).toBe('/organization/acme/leads');
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.append(modal);
    await user.keyboard('2');
    expect(router.state.location.pathname).toBe('/organization/acme/leads');
    modal.remove();
  });
});

describe('SectionBarShell — accessibility', () => {
  // One region at a time: the header nav and the tab bar are both "Sections",
  // and below / above `md` CSS hides one of them, which jsdom does not apply.
  it('has no axe violations in the header', async () => {
    renderShell();
    await within(await header()).findByTestId('nav-leads');
    expect(await axe(await header())).toHaveNoViolations();
  });

  it('has no axe violations in the tab bar', async () => {
    renderShell();
    const bar = await screen.findByTestId('mobile-bottom-bar');
    await within(bar).findByTestId('nav-leads');
    expect(await axe(bar)).toHaveNoViolations();
  });
});
