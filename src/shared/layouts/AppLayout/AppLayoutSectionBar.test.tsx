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
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { organizationPermissionSchema } from '@/core/types/permissions.ts';
import type { PageManifest } from '@/lib/routes/page-manifest.ts';
import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import type { DirectoryRole } from '@/shared/api/app/directory-api.ts';
import type * as PresenceApiModule from '@/shared/api/app/presence-api.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useAppNav } from '@/shared/hooks/useAppNav/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { presetRoleId, previewPreset } from '@/tests/utils/app-preset-codes.ts';

import { SectionBarShell } from './AppLayoutSectionBar.tsx';

/** clinozy-be's copy of my presence (`GET /users/me`, `PUT /users/me/presence`). */
const presenceServer = vi.hoisted(() => ({ presence: 'online' }));
vi.mock('@/shared/api/app/presence-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PresenceApiModule>()),
  fetchMyPresence: async () => presenceServer.presence,
  saveMyPresence: async (next: string) => {
    presenceServer.presence = next;
    return next;
  },
}));

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
// The role directory View-as names the previewed role from (`GET /app/roles`).
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof DirectoryApiModule>()),
  fetchRoleDirectory: async (): Promise<DirectoryRole[]> => [
    {
      id: presetRoleId('therapist'),
      name: 'Therapist',
      tone: 'sage',
      isSystem: true,
      isLocked: false,
      preset: 'therapist',
    },
  ],
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
  const { entries } = useAppNav();
  return <SectionBarShell navItems={entries} organizationSlug="acme" />;
}

/** What a room renders instead of its heading — e.g. a drawer open over it. */
type RoomContent = Partial<Record<(typeof ROOMS)[number], () => ReactNode>>;

function renderShell(path = '/organization/acme/leads', content: RoomContent = {}) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const org = createRoute({ getParentRoute: () => root, path: ORG, component: Shell });
  const rooms = ROOMS.map((section) =>
    createRoute({
      getParentRoute: () => org,
      path: section,
      staticData: { manifest: roomManifest(section) },
      component: content[section] ?? (() => <h1>{section}</h1>),
    }),
  );
  const router = createRouter({
    routeTree: root.addChildren([org.addChildren(rooms)]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

/** The query client of the shell rendered last. */
let queryClient: QueryClient;

const header = () => screen.findByTestId('header');

beforeEach(() => {
  presenceServer.presence = 'online';
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
  // The org owner holds every clinozy-be code (the Users room reads them, D17).
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore
    .getState()
    .setPermissions([...organizationPermissionSchema.options]);
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

  it('fits a 320px phone: the controls never shrink, the section chip gives way (L-64)', async () => {
    renderShell();
    const bar = await header();
    const controls = bar.querySelector('[data-slot="header-controls"]');
    expect(controls).toHaveClass('flex-[1_0_auto]', 'md:min-w-0', 'md:flex-1');
    expect(controls).not.toHaveClass('min-w-0');
    expect(controls).toContainElement(within(bar).getByTestId('search-trigger'));
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
    act(() => previewPreset(queryClient, 'therapist'));
    const pill = await screen.findByTestId('view-as-bar');
    await waitFor(() => expect(pill).toHaveTextContent(/previewing as therapist/i));
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

describe('SectionBarShell — floating tab bar (change-floating-tab-bar)', () => {
  /** The lens behind the current slot, and the slots in bar order. */
  async function tabBar(path: string) {
    renderShell(path);
    const bar = await screen.findByTestId('mobile-bottom-bar');
    await within(bar).findByTestId('nav-appointments');
    const lens = bar.querySelector<HTMLElement>('[data-lens]');
    if (!lens) throw new Error('the tab bar draws no lens');
    const slots = [
      ...within(bar).getAllByRole('link'),
      within(bar).getByTestId('nav-more-sections'),
    ];
    return { bar, lens, slots };
  }

  /** The tone whose ink a slot is drawn in. */
  function toneOf(slot: HTMLElement) {
    const tone = Object.values(TONE_CLASSES).find((entry) =>
      slot.classList.contains(entry.ink),
    );
    if (!tone) throw new Error(`${slot.dataset.testid} carries no tone ink`);
    return tone;
  }

  it('floats the capsule inside a nav that takes no taps', async () => {
    const { bar } = await tabBar('/organization/acme/patients');
    const nav = bar.closest('nav');
    expect(nav).toHaveAttribute('data-slot', 'mobile-nav');
    expect(nav).toHaveClass('fixed', 'bottom-0', 'pointer-events-none', 'md:hidden');
    // The theme axes own it: Sharp squares `floating-edge`, Elevation shadows it.
    // Its glass, height and lift are `index.css`'s (bottom-stack-css.test.ts).
    expect(bar).toHaveAttribute('data-slot', 'floating-edge');
    expect(nav?.firstElementChild).toBe(bar);
    expect(bar).toHaveClass(
      'pointer-events-auto',
      'rounded-full',
      'overflow-hidden',
      'inset-x-3',
      'max-w-md',
      'grid-cols-5',
    );
  });

  it('puts the lens under a pinned current room, in its tone', async () => {
    const { lens, slots } = await tabBar('/organization/acme/patients');
    const index = slots.findIndex((slot) => slot.dataset.testid === 'nav-patients');
    expect(index).toBe(2);
    expect(lens).toHaveAttribute('data-lens', '2');
    expect(lens).toHaveAttribute('aria-hidden', 'true');
    expect(lens).toHaveAttribute('data-slot', 'pill');
    // `index.css` places it from `data-lens`, a fifth of the bar per slot.
    expect(lens).toHaveClass('absolute', toneOf(slots[index] as HTMLElement).bg);
    expect(lens).not.toHaveClass('opacity-0');
  });

  it('slides the lens to the room chosen, with its tone', async () => {
    const user = userEvent.setup();
    const { lens, slots } = await tabBar('/organization/acme/patients');
    await user.click(slots[1] as HTMLElement);
    await waitFor(() => expect(lens).toHaveAttribute('data-lens', '1'));
    expect(lens).toHaveClass(toneOf(slots[1] as HTMLElement).bg);
  });

  it('carries the lens to "More" when it names an unpinned current room', async () => {
    const { lens, slots } = await tabBar('/organization/acme/tasks');
    const more = slots[4] as HTMLElement;
    expect(more).toHaveAttribute('aria-current', 'page');
    expect(lens).toHaveAttribute('data-lens', '4');
    expect(lens).toHaveClass(toneOf(more).bg);
  });

  it('fades the lens out when no room is current', async () => {
    const { lens, slots } = await tabBar('/organization/acme');
    expect(slots.some((slot) => slot.hasAttribute('aria-current'))).toBe(false);
    expect(lens).toHaveAttribute('data-lens', 'none');
    expect(lens).toHaveClass('opacity-0');
  });

  it('presses "More" while its sheet is open over a pinned room', async () => {
    const user = userEvent.setup();
    const { slots } = await tabBar('/organization/acme/patients');
    const more = slots[4] as HTMLElement;
    expect(more.querySelector('[data-slot="pill"]')).toBeNull();
    await user.click(more);
    await screen.findByRole('dialog', { name: /all sections/i });
    expect(more.querySelector('[data-slot="pill"]')).toHaveClass(
      'bg-muted',
      'rounded-full',
    );
  });

  it('draws 22px icons over their labels, wrapped as the content that dips when pressed', async () => {
    const { slots } = await tabBar('/organization/acme/patients');
    for (const slot of slots) {
      const icon = slot.querySelector('svg');
      expect(icon).toHaveClass('size-5.5');
      // The icon and its label dip together (`index.css`): their wrapper.
      expect(icon?.parentElement).toHaveAttribute('data-slot', 'tab-content');
    }
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

  it('stands down while a drawer holds focus — a room never switches out from under it', async () => {
    // Radix drawers carry no `aria-modal`: the key is the drawer's because it
    // was pressed inside it, as "/" and j / k read it.
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const router = renderShell('/organization/acme/leads', {
      leads: () => <RecordDrawer open title="New lead" testId="ld" onClose={() => {}} />,
    });
    await waitFor(() => expect(screen.getByTestId('ld-title')).toHaveFocus());

    await user.keyboard('g');
    expect(
      screen.queryByRole('dialog', { name: /all sections/i, hidden: true }),
    ).toBeNull();

    await user.keyboard('1');
    expect(router.state.location.pathname).toBe('/organization/acme/leads');
    expect(screen.getByTestId('ld')).toBeInTheDocument();
  });

  it('from md up, G closes All sections from inside it, and a number pressed there opens a room', async () => {
    // The popover takes focus as it opens, so the keys come from inside it:
    // the bar's own surface, not another layer's (setup's matchMedia says phone).
    const matchMedia = window.matchMedia;
    window.matchMedia = (query: string) => ({ ...matchMedia(query), matches: true });
    try {
      const user = userEvent.setup();
      const router = renderShell('/organization/acme/leads');
      await screen.findByTestId('all-sections-trigger');

      await user.keyboard('g');
      const popover = await screen.findByTestId('all-sections');
      await waitFor(() =>
        expect(popover).toContainElement(document.activeElement as HTMLElement),
      );
      await user.keyboard('g');
      await waitFor(() => expect(screen.queryByTestId('all-sections')).toBeNull());

      await user.keyboard('g');
      await screen.findByTestId('all-sections');
      await user.keyboard('1');
      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/organization/acme/today'),
      );
    } finally {
      window.matchMedia = matchMedia;
    }
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
