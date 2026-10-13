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

import {
  listOf,
  matchOf,
  oneOf,
  PUBLIC_ID,
  queryOf,
} from '@/lib/routes/search-params.ts';
import {
  readCreatedFilter,
  readFollowUpFilter,
} from '@/shared/api/app/app-list-filters.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import {
  LEAD_CHAT_WIDTH,
  useDevicePrefsStore,
} from '@/shared/store/useDevicePrefsStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import type { RoomFilterFields } from './room-filters.ts';
import { type RoomFilterCopy, RoomFilters } from './RoomFilters.tsx';

const notify = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock('@/shared/notify/index.ts', () => ({ notify }));

const tier = vi.hoisted(() => ({ current: 'desktop' as 'phone' | 'tablet' | 'desktop' }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => tier.current,
}));

const GENDERS = ['female', 'male', 'other'] as const;
const TYPES = ['aesthetic', 'clinical'] as const;
const STATUSES = ['new', 'regular', 'vip'] as const;

/** A room's filters, over the values its `<room>.search.ts` declares. */
const FIELDS = {
  gender: { kind: 'options', values: GENDERS },
  type: { kind: 'options', values: TYPES },
  status: { kind: 'options', values: STATUSES, single: true },
  created: { kind: 'date', presets: 'created' },
} as const satisfies RoomFilterFields;

const COPY: Record<string, RoomFilterCopy> = {
  gender: {
    label: 'Gender',
    options: {
      female: { label: 'Female', tone: 'blush' },
      male: { label: 'Male', tone: 'sky' },
      other: { label: 'Other', tone: 'stone' },
    },
  },
  type: {
    label: 'Type',
    options: { aesthetic: { label: 'Aesthetic' }, clinical: { label: 'Clinical' } },
  },
  status: {
    label: 'Status',
    anyLabel: 'All',
    options: {
      new: { label: 'New', tone: 'sky' },
      regular: { label: 'Regular', tone: 'lav' },
      vip: { label: 'VIP', tone: 'butter' },
    },
  },
};

/** The room's route: its `validateSearch` reads with the shared readers, as `leads.search.ts` does. */
function renderFilters(path = '/patients') {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const patients = createRoute({
    getParentRoute: () => rootRoute,
    path: '/patients',
    validateSearch: (search: Record<string, unknown>) => ({
      q: queryOf(search.q, 80),
      gender: listOf(search.gender, (entry) => oneOf(GENDERS, entry) !== undefined),
      type: listOf(search.type, (entry) => oneOf(TYPES, entry) !== undefined),
      status: oneOf(STATUSES, search.status),
      created: readCreatedFilter(search.created),
    }),
    component: () => (
      <RoomFilters
        fields={FIELDS}
        copy={COPY}
        savedViewsTableId="patients"
        testIdPrefix="patients"
      />
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([patients]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, user: userEvent.setup(), ...view };
}

/** The URL's filters: the route's validated search without the empty keys. */
function urlFilters(router: ReturnType<typeof renderFilters>['router']) {
  return Object.fromEntries(
    Object.entries(router.state.location.search).filter(
      ([, value]) => value !== undefined,
    ),
  );
}

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId('patients-filters-trigger'));
  return screen.findByTestId('patients-filters');
}

const chip = (panel: HTMLElement, name: string) =>
  within(panel).getByRole('button', { name, pressed: undefined });

beforeEach(() => {
  tier.current = 'desktop';
  notify.success.mockReset();
  useDevicePrefsStore.setState({
    hiddenColumns: {},
    savedViews: {},
    photoSize: 'medium',
    leadChatWidth: LEAD_CHAT_WIDTH.initial,
  });
});

describe('RoomFilters — pending → Apply → URL (the acceptance)', () => {
  it('keeps choices pending until "Apply filter", then writes them to the URL', async () => {
    const { router, user } = renderFilters();
    const panel = await openFilters(user);
    expect(panel).toHaveAttribute('data-picker-surface', 'popover');

    await user.click(chip(panel, 'Female'));
    await user.click(chip(panel, 'Aesthetic'));
    await user.click(chip(panel, 'VIP'));
    expect(chip(panel, 'Female')).toHaveAttribute('aria-pressed', 'true');
    expect(chip(panel, 'VIP')).toHaveAttribute('aria-pressed', 'true');
    // Nothing has reached the URL yet, and the button counts nothing.
    expect(urlFilters(router)).toEqual({});
    expect(screen.getByTestId('patients-filters-trigger')).toHaveTextContent(/^Filters$/);

    await user.click(within(panel).getByRole('button', { name: 'Apply filter' }));

    await waitFor(() =>
      expect(urlFilters(router)).toEqual({
        gender: ['female'],
        type: ['aesthetic'],
        status: 'vip',
      }),
    );
    expect(screen.queryByTestId('patients-filters')).toBeNull();
    const trigger = screen.getByTestId('patients-filters-trigger');
    expect(trigger).toHaveTextContent('Filters3');
    expect(trigger).toHaveAccessibleName('Filters 3 applied');
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
  });

  it('keeps every pick made before the next render', async () => {
    const { user } = renderFilters();
    const panel = await openFilters(user);
    act(() => {
      chip(panel, 'Female').click();
      chip(panel, 'Male').click();
      chip(panel, 'Clinical').click();
    });
    expect(chip(panel, 'Female')).toHaveAttribute('aria-pressed', 'true');
    expect(chip(panel, 'Male')).toHaveAttribute('aria-pressed', 'true');
    expect(chip(panel, 'Clinical')).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens on the applied filters and drops unapplied picks on Esc', async () => {
    const { router, user } = renderFilters('/patients?gender=%5B%22male%22%5D');
    let panel = await openFilters(user);
    expect(chip(panel, 'Male')).toHaveAttribute('aria-pressed', 'true');

    await user.click(chip(panel, 'Female'));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('patients-filters')).toBeNull());
    expect(urlFilters(router)).toEqual({ gender: ['male'] });

    panel = await openFilters(user);
    expect(chip(panel, 'Female')).toHaveAttribute('aria-pressed', 'false');
    expect(chip(panel, 'Male')).toHaveAttribute('aria-pressed', 'true');
  });

  it('"Clear all" empties the URL at once and keeps the popover open', async () => {
    const { router, user } = renderFilters(
      '/patients?gender=%5B%22female%22%5D&status=vip&q=asha',
    );
    const panel = await openFilters(user);
    await user.click(within(panel).getByRole('button', { name: 'Clear all' }));

    await waitFor(() => expect(urlFilters(router)).toEqual({ q: 'asha' }));
    expect(screen.getByTestId('patients-filters')).toBe(panel);
    expect(chip(panel, 'Female')).toHaveAttribute('aria-pressed', 'false');
    expect(chip(panel, 'All')).toHaveAttribute('aria-pressed', 'true');
  });

  it('the joined × clears every filter, and leaves with them', async () => {
    const { router, user } = renderFilters(
      '/patients?gender=%5B%22female%22%5D&created=today',
    );
    await user.click(await screen.findByRole('button', { name: 'Clear all filters' }));

    await waitFor(() => expect(urlFilters(router)).toEqual({}));
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).toBeNull();
    expect(screen.getByTestId('patients-filters-trigger')).toHaveTextContent(/^Filters$/);
  });

  it('a single filter keeps one pick; its "All" chip clears it', async () => {
    const { router, user } = renderFilters('/patients?status=new');
    const panel = await openFilters(user);
    expect(chip(panel, 'All')).toHaveAttribute('aria-pressed', 'false');

    await user.click(chip(panel, 'Regular'));
    expect(chip(panel, 'New')).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip(panel, 'All'));
    expect(chip(panel, 'Regular')).toHaveAttribute('aria-pressed', 'false');
    await user.click(within(panel).getByRole('button', { name: 'Apply filter' }));
    await waitFor(() => expect(urlFilters(router)).toEqual({}));
  });

  it('"Custom range" adds From / To pickers starting today, applied as from..to', async () => {
    const today = appToday();
    const { router, user } = renderFilters();
    const panel = await openFilters(user);
    const created = within(panel).getByRole('group', { name: 'Created' });
    expect(chip(created, 'Any')).toHaveAttribute('aria-pressed', 'true');
    expect(within(created).queryByTestId('filter-created-from')).toBeNull();

    await user.click(chip(created, 'Custom range'));
    expect(chip(created, 'Custom range')).toHaveAttribute('aria-pressed', 'true');
    expect(within(created).getByTestId('filter-created-from')).toBeInTheDocument();
    expect(within(created).getByTestId('filter-created-to')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Apply filter' }));

    await waitFor(() =>
      expect(urlFilters(router)).toEqual({ created: `${today}..${today}` }),
    );
    expect(screen.getByTestId('patients-filters-trigger')).toHaveTextContent('Filters1');
  });

  it('opens on an applied range with its ends in the pickers', async () => {
    const { user } = renderFilters('/patients?created=2026-09-01..2026-09-30');
    const panel = await openFilters(user);
    const created = within(panel).getByRole('group', { name: 'Created' });
    expect(chip(created, 'Custom range')).toHaveAttribute('aria-pressed', 'true');
    expect(within(created).getByTestId('filter-created-from')).toHaveTextContent('Sep');
    expect(within(created).getByTestId('filter-created-to')).toHaveTextContent('30');
  });
});

describe('RoomFilters — saved views', () => {
  it('saves the applied filters as a view named by its first two chips', async () => {
    const { user } = renderFilters(
      '/patients?gender=%5B%22female%22%5D&type=%5B%22aesthetic%22%5D&status=vip',
    );
    const panel = await openFilters(user);
    await user.click(within(panel).getByRole('button', { name: 'Save as view' }));

    expect(notify.success).toHaveBeenCalledWith('View “Female + Aesthetic” saved');
    await waitFor(() => expect(screen.queryByTestId('patients-filters')).toBeNull());
    expect(useDevicePrefsStore.getState().savedViews.patients).toEqual([
      expect.objectContaining({
        name: 'Female + Aesthetic',
        filters: { gender: ['female'], status: ['vip'], type: ['aesthetic'] },
      }),
    ]);

    // The same filters read "Saved as view"; a second tap removes the view.
    const again = await openFilters(user);
    const saved = within(again).getByRole('button', { name: 'Saved as view' });
    expect(saved).toHaveAttribute('aria-pressed', 'true');
    await user.click(saved);
    expect(notify.success).toHaveBeenLastCalledWith('View removed');
    expect(useDevicePrefsStore.getState().savedViews.patients).toEqual([]);
  });

  it('names a view of date presets by their labels, and offers no save without filters', async () => {
    const { user } = renderFilters('/patients?created=last_7');
    let panel = await openFilters(user);
    await user.click(within(panel).getByRole('button', { name: 'Save as view' }));
    expect(notify.success).toHaveBeenCalledWith('View “Last 7 days” saved');

    await user.click(await screen.findByRole('button', { name: 'Clear all filters' }));
    panel = await openFilters(user);
    expect(within(panel).queryByRole('button', { name: /as view/ })).toBeNull();
  });
});

describe('RoomFilters — surfaces', () => {
  it('is the 82% bottom sheet on a phone, over a transparent layer', async () => {
    tier.current = 'phone';
    const { user } = renderFilters();
    const sheet = await openFilters(user);
    expect(sheet).toHaveAttribute('data-picker-surface', 'sheet');
    expect(sheet.className).toContain('data-[vaul-drawer-direction=bottom]:max-h-[82%]');
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBe(sheet);
    expect(
      screen.getByTestId('patients-filters-trigger').parentElement?.className,
    ).toContain('max-md:h-10');
  });

  it('is a 340px popover under the button, end-aligned, and focuses its first chip', async () => {
    const { user } = renderFilters();
    const panel = await openFilters(user);
    expect(panel.className).toContain('w-85');
    expect(panel).toHaveAttribute('data-align', 'end');
    await waitFor(() => expect(chip(panel, 'Female')).toHaveFocus());
  });

  it('has no accessibility violations while open', async () => {
    const { baseElement, user } = renderFilters('/patients?status=vip');
    await openFilters(user);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});

describe('RoomFilters — a people section (the Leads "Team")', () => {
  // Team members by membership id (`mem_` + 21 lowercase alphanumerics), as clinozy-be names them.
  const RIYA = 'mem_riya00000000000000000';
  const NIDHI = 'mem_nidhi0000000000000000';
  const SOURCES = ['instagram', 'whatsapp'] as const;
  const TEAM_FIELDS = {
    source: { kind: 'options', values: SOURCES },
    owner: { kind: 'people' },
  } as const satisfies RoomFilterFields;
  const TEAM = {
    members: [
      { id: RIYA, name: 'Riya Shah', tone: 'blush', role: 'Front desk' },
      { id: NIDHI, name: 'Nidhi Kapoor', tone: 'sage', role: 'Counsellor' },
    ],
    anyone: 'Anyone on the team',
    count: (count: number) => `${count} people`,
    search: 'Search team',
    noMatch: 'No match',
  } as const satisfies RoomFilterCopy['people'];
  const TEAM_COPY: Record<string, RoomFilterCopy> = {
    source: {
      label: 'Source · pick any',
      clearLabel: 'Clear',
      options: {
        instagram: { label: 'Instagram', tone: 'blush' },
        whatsapp: { label: 'WhatsApp', tone: 'sage' },
      },
    },
    owner: {
      label: 'Team · assigned or involved',
      clearLabel: 'Clear',
      options: {},
      people: TEAM,
    },
  };

  /** A `/leads` route over `fields`, its search read by `validateSearch`. */
  function renderLeads({
    path = '/leads',
    fields = TEAM_FIELDS,
    copy = TEAM_COPY,
    validateSearch = (search: Record<string, unknown>) => ({
      source: listOf(search.source, (entry) => oneOf(SOURCES, entry) !== undefined),
      owner: listOf(search.owner, (entry) => PUBLIC_ID.test(entry)),
    }),
  }: {
    path?: string;
    fields?: RoomFilterFields;
    copy?: Record<string, RoomFilterCopy>;
    validateSearch?: (search: Record<string, unknown>) => Record<string, unknown>;
  } = {}) {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const leads = createRoute({
      getParentRoute: () => rootRoute,
      path: '/leads',
      validateSearch,
      component: () => <RoomFilters fields={fields} copy={copy} testIdPrefix="leads" />,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([leads]),
      history: createMemoryHistory({ initialEntries: [path] }),
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    return { router, user: userEvent.setup() };
  }

  async function openTeam(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByTestId('leads-filters-trigger'));
    return screen.findByTestId('leads-filters');
  }

  it('picks anyone on the team from the expanding list, then writes their membership ids', async () => {
    const { router, user } = renderLeads();
    const panel = await openTeam(user);
    const picker = within(panel).getByRole('button', { name: 'Anyone on the team' });
    expect(picker).toHaveAttribute('aria-expanded', 'false');

    await user.click(picker);
    expect(picker).toHaveAttribute('aria-expanded', 'true');
    await user.click(within(panel).getByRole('button', { name: 'Riya Shah Front desk' }));
    expect(
      within(panel).getByRole('button', { name: 'Riya Shah Front desk' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(picker).toHaveTextContent('Riya Shah');
    await user.click(
      within(panel).getByRole('button', { name: 'Nidhi Kapoor Counsellor' }),
    );
    expect(picker).toHaveTextContent('2 people');

    await user.click(within(panel).getByRole('button', { name: 'Apply filter' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ owner: [RIYA, NIDHI] }),
    );
    expect(screen.getByTestId('leads-filters-trigger')).toHaveTextContent('2');
  });

  it('searches the team by name or role, and says "No match"', async () => {
    const { user } = renderLeads();
    const panel = await openTeam(user);
    await user.click(within(panel).getByRole('button', { name: 'Anyone on the team' }));
    const search = within(panel).getByRole('searchbox', { name: 'Search team' });
    await user.type(search, 'couns');
    expect(
      within(panel).queryByRole('button', { name: 'Riya Shah Front desk' }),
    ).toBeNull();
    expect(
      within(panel).getByRole('button', { name: 'Nidhi Kapoor Counsellor' }),
    ).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'zz');
    expect(within(panel).getByText('No match')).toBeInTheDocument();
  });

  it('offers "Clear" on a section only while it has picks', async () => {
    const { user } = renderLeads({ path: `/leads?source=instagram&owner=${RIYA}` });
    const panel = await openTeam(user);
    const clears = within(panel).getAllByRole('button', { name: 'Clear' });
    expect(clears).toHaveLength(2);
    await user.click(clears[0] as HTMLElement);
    expect(within(panel).getAllByRole('button', { name: 'Clear' })).toHaveLength(1);
    expect(
      within(panel).getByRole('button', { name: 'Instagram', pressed: false }),
    ).toBeInTheDocument();
  });

  it('keeps one member in a single people filter — a pick replaces the last', async () => {
    const { router, user } = renderLeads({
      path: `/leads?member=${RIYA}`,
      fields: { member: { kind: 'people', single: true } },
      copy: {
        member: {
          label: 'Team · assigned or involved',
          clearLabel: 'Clear',
          options: {},
          people: TEAM,
        },
      },
      validateSearch: (search) => ({
        member: matchOf(
          PUBLIC_ID,
          Array.isArray(search.member) ? search.member[0] : search.member,
        ),
      }),
    });
    const panel = await openTeam(user);
    const picker = within(panel).getByRole('button', { name: 'Riya Shah' });
    await user.click(picker);
    expect(
      within(panel).getByRole('button', { name: 'Riya Shah Front desk' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await user.click(
      within(panel).getByRole('button', { name: 'Nidhi Kapoor Counsellor' }),
    );
    expect(
      within(panel).getByRole('button', { name: 'Riya Shah Front desk' }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      within(panel).getByRole('button', { name: 'Nidhi Kapoor Counsellor' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(picker).toHaveTextContent('Nidhi Kapoor');

    await user.click(within(panel).getByRole('button', { name: 'Apply filter' }));
    // One member is a plain value in the URL, not a list.
    await waitFor(() => expect(router.state.location.search).toEqual({ member: NIDHI }));
    expect(screen.getByTestId('leads-filters-trigger')).toHaveTextContent('Filters1');
  });
});

describe('RoomFilters — a date section without some presets', () => {
  const FOLLOW_UP_FIELDS = {
    followUp: { kind: 'date', presets: 'followUp', without: ['not_set'] },
  } as const satisfies RoomFilterFields;

  function renderFollowUp(path = '/leads') {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const leads = createRoute({
      getParentRoute: () => rootRoute,
      path: '/leads',
      validateSearch: (search: Record<string, unknown>) => ({
        followUp: readFollowUpFilter(search.followUp),
      }),
      component: () => (
        <RoomFilters fields={FOLLOW_UP_FIELDS} copy={{}} testIdPrefix="leads" />
      ),
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([leads]),
      history: createMemoryHistory({ initialEntries: [path] }),
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    return { user: userEvent.setup() };
  }

  it('does not offer a preset the room’s API cannot filter by, nor read it from the URL', async () => {
    const { user } = renderFollowUp('/leads?followUp=not_set');
    // "Not set" in the URL is no filter: nothing to count, nothing to clear.
    const trigger = await screen.findByTestId('leads-filters-trigger');
    expect(trigger).toHaveTextContent(/^Filters$/);
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).toBeNull();

    await user.click(trigger);
    const panel = await screen.findByTestId('leads-filters');
    const followUp = within(panel).getByRole('group', { name: 'Follow-up date' });
    expect(
      within(followUp)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Any', 'Overdue', 'Today', 'Tomorrow', 'Next 7 days', 'Custom range']);
    expect(within(followUp).queryByRole('button', { name: 'Not set' })).toBeNull();
    expect(chip(followUp, 'Any')).toHaveAttribute('aria-pressed', 'true');
  });
});
