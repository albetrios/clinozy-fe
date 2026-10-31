import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { savedViewsKey } from '@/shared/hooks/useSavedViews/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import {
  LEAD_CHAT_WIDTH,
  useDevicePrefsStore,
} from '@/shared/store/useDevicePrefsStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import type { RoomFilterFields } from './RoomFilters/index.ts';
import { RoomViewTabs } from './RoomTabs/index.ts';
import { RoomToolbar, type RoomToolbarProps } from './RoomToolbar.tsx';

/** A live viewport tier: setting it re-renders what reads it, as a resize does. */
const tier = vi.hoisted(() => {
  type Tier = 'phone' | 'tablet' | 'desktop';
  const listeners = new Set<() => void>();
  const store = { current: 'desktop' as Tier };
  return {
    get current(): Tier {
      return store.current;
    },
    set current(next: Tier) {
      store.current = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
});
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => useSyncExternalStore(tier.subscribe, () => tier.current),
}));

const FIELDS = {
  status: { kind: 'options', values: ['new', 'vip'] },
  created: { kind: 'date', presets: 'created' },
} as const satisfies RoomFilterFields;

const onNew = vi.fn();

function Toolbar(props: Partial<RoomToolbarProps>) {
  return (
    <RoomToolbar
      title="Patients"
      tableId="patients"
      tabs={
        <RoomViewTabs
          label="Patient views"
          tabs={[
            { id: 'all', label: 'All' },
            { id: 'today', label: 'In clinic today' },
          ]}
          value="all"
          onValueChange={vi.fn()}
          testIdPrefix="patients"
        />
      }
      search={{ placeholder: 'Name, mobile or #ID', label: 'Search patients' }}
      filters={{
        fields: FIELDS,
        copy: {
          status: {
            label: 'Status',
            options: {
              new: { label: 'New', tone: 'sky' },
              vip: { label: 'VIP', tone: 'butter' },
            },
          },
        },
      }}
      columns={<button type="button">Columns</button>}
      actions={<button type="button">Day close</button>}
      primary={{ action: { id: 'new-patient', label: 'New patient', onSelect: onNew } }}
      {...props}
    />
  );
}

function renderToolbar(props: Partial<RoomToolbarProps> = {}, initialEntries = ['/']) {
  return renderWithProviders(<Toolbar {...props} />, { initialEntries });
}

const toolbar = () => screen.getByTestId('patients-toolbar');
const fab = () => document.querySelector<HTMLElement>('[data-slot="fab"]');

beforeEach(() => {
  tier.current = 'desktop';
  onNew.mockReset();
  // Saved views are the signed-in person's (F-9).
  useAuthStore
    .getState()
    .setUser({ id: 'usr_ada', email: 'ada@clinic.test', role: 'user' });
  useDevicePrefsStore.setState({
    hiddenColumns: {},
    savedViews: {},
    photoSize: 'medium',
    leadChatWidth: LEAD_CHAT_WIDTH.initial,
  });
});

describe('RoomToolbar — desktop and tablet', () => {
  it('is one row: h1 · tabs · search · Filters · Columns · actions · primary', async () => {
    renderToolbar();
    const row = await screen.findByTestId('patients-toolbar');
    expect(row.className).toContain('p-(--room-toolbar-pad)');
    expect(row.className).toContain('flex-wrap');
    const heading = within(row).getByRole('heading', { level: 1, name: 'Patients' });
    expect(heading.className).toContain('max-md:sr-only');
    expect(heading.className).toContain('text-lg');
    expect(heading.className).toContain('xl:text-xl');

    const order = [
      heading,
      within(row).getByRole('tablist', { name: 'Patient views' }),
      within(row).getByRole('searchbox', { name: 'Search patients' }),
      screen.getByTestId('patients-filters-trigger'),
      within(row).getByRole('button', { name: 'Columns' }),
      within(row).getByRole('button', { name: 'Day close' }),
      within(row).getByRole('button', { name: 'New patient' }),
    ];
    for (const [index, element] of order.entries()) {
      const next = order[index + 1];
      if (!next) break;
      expect(
        element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
    expect(fab()).toBeNull();
  });

  it('gives the tabs the free space — at least 120px on a tablet', async () => {
    renderToolbar();
    const tabs = (await screen.findByRole('tablist', { name: 'Patient views' })).closest(
      '[data-slot="room-toolbar-tabs"]',
    );
    expect(tabs?.className).toContain('md:flex-1');
    expect(tabs?.className).toContain('md:min-w-30');
    expect(tabs?.className).toContain('xl:min-w-0');
  });

  it('pushes the controls to the inline end with a spacer when there are no tabs', async () => {
    renderToolbar({ tabs: undefined });
    const row = await screen.findByTestId('patients-toolbar');
    expect(row.querySelector('span[aria-hidden="true"].flex-1')).not.toBeNull();
  });

  it('draws the divider after the h1 only before views — none for a room without tabs', async () => {
    const { unmount } = renderToolbar();
    expect(
      (await screen.findByRole('heading', { level: 1, name: 'Patients' })).className,
    ).toContain('border-e');
    unmount();
    renderToolbar({ tabs: undefined });
    expect(
      (await screen.findByRole('heading', { level: 1, name: 'Patients' })).className,
    ).not.toContain('border-e');
  });

  it('puts a period right after the tabs, which then keep their width', async () => {
    renderToolbar({ period: <button type="button">Today</button> });
    const row = await screen.findByTestId('patients-toolbar');
    const tabs = within(row)
      .getByRole('tablist')
      .closest('[data-slot="room-toolbar-tabs"]');
    const period = row.querySelector('[data-slot="room-toolbar-period"]');
    expect(tabs?.nextElementSibling).toBe(period);
    expect(period).toContainElement(within(row).getByRole('button', { name: 'Today' }));
    expect(tabs?.className).toContain('md:max-w-max');
    expect(tabs?.className).not.toContain('md:basis-0');
    // The free space follows the period; on a phone it takes its own row.
    const spacer = period?.nextElementSibling;
    expect(spacer).toHaveAttribute('aria-hidden', 'true');
    expect(spacer?.className).toContain('flex-1');
    expect(period?.className).toContain('max-md:order-4');
  });

  it('puts a room’s own Filters in the Filters place, instead of the shared one', async () => {
    tier.current = 'phone';
    renderToolbar({ filtersSlot: <button type="button">Room filters</button> });
    const row = await screen.findByTestId('patients-toolbar');
    expect(screen.queryByTestId('patients-filters-trigger')).toBeNull();
    const slot = row.querySelector('[data-slot="room-toolbar-filters"]');
    expect(slot).toContainElement(
      within(row).getByRole('button', { name: 'Room filters' }),
    );
    // The Filters' phone placement: row 1, after the search.
    expect(slot?.className).toContain('max-md:order-2');
    expect(
      screen.getByTestId('patients-search').compareDocumentPosition(slot as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderToolbar();
    await screen.findByTestId('patients-toolbar');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('RoomToolbar — phone', () => {
  it('floats the primary out of the toolbar and publishes the "New" height', async () => {
    tier.current = 'phone';
    const user = userEvent.setup();
    renderToolbar();
    await screen.findByTestId('patients-toolbar');
    expect(within(toolbar()).queryByRole('button', { name: 'New patient' })).toBeNull();
    expect(fab()).not.toBeNull();
    expect(document.documentElement.matches(":root:has([data-slot='fab'])")).toBe(true);
    await user.click(
      within(fab() as HTMLElement).getByRole('button', { name: 'New patient' }),
    );
    expect(onNew).toHaveBeenCalledOnce();

    // Widened past md: the primary is back in the toolbar and nothing floats.
    act(() => {
      tier.current = 'tablet';
    });
    await waitFor(() => expect(fab()).toBeNull());
    expect(
      within(toolbar()).getByRole('button', { name: 'New patient' }),
    ).toBeInTheDocument();
    expect(document.documentElement.matches(":root:has([data-slot='fab'])")).toBe(false);
  });

  it('puts search + a 40px Filters on row 1 and the tabs on row 2 (default)', async () => {
    tier.current = 'phone';
    renderToolbar();
    const row = await screen.findByTestId('patients-toolbar');
    expect(row).toHaveAttribute('data-layout', 'default');
    expect(screen.getByTestId('patients-search').className).toContain('max-md:order-1');
    expect(screen.getByTestId('patients-search').className).toContain(
      'max-md:flex-[1_1_180px]',
    );
    const filters = screen.getByTestId('patients-filters-trigger').parentElement;
    expect(filters?.className).toContain('max-md:order-2');
    expect(filters?.className).toContain('max-md:h-10');
    const tabs = screen.getByRole('tablist').closest('[data-slot="room-toolbar-tabs"]');
    expect(tabs?.className).toContain('max-md:order-3');
    expect(tabs?.className).toContain('max-md:basis-full');
    // The track runs across the row (H:142).
    expect(tabs?.className).toContain('max-md:[&_[data-room-tabs-track]]:w-full');
  });

  it('puts the search alone on row 1, then the tabs + a 36px Filters (Leads)', async () => {
    tier.current = 'phone';
    renderToolbar({ layout: 'leads' });
    const row = await screen.findByTestId('patients-toolbar');
    expect(row).toHaveAttribute('data-layout', 'leads');
    const heading = within(row).getByRole('heading', { level: 1 });
    expect(heading.className).not.toContain('text-lg');
    // 6px before the divider and 2px after it (H:1681).
    expect(heading).toHaveClass('pe-1.5', 'me-0.5');
    expect(heading).not.toHaveClass('pe-2.5');
    expect(screen.getByTestId('patients-search').className).toContain(
      'max-md:basis-full',
    );
    const filters = screen.getByTestId('patients-filters-trigger').parentElement;
    expect(filters?.className).toContain('max-md:order-3');
    expect(filters?.className).not.toContain('max-md:h-10');
    const tabs = screen.getByRole('tablist').closest('[data-slot="room-toolbar-tabs"]');
    expect(tabs?.className).toContain('max-md:order-2');
    expect(tabs?.className).toContain('max-md:flex-1');
    // The track keeps its own width; the rest of the row is space (H:83–88).
    expect(tabs?.className).not.toContain('[data-room-tabs-track]');
  });

  it('puts the room’s actions beside the tabs on row 2 (Payments’ Day close)', async () => {
    tier.current = 'phone';
    renderToolbar({ layout: 'actions' });
    const row = await screen.findByTestId('patients-toolbar');
    expect(row).toHaveAttribute('data-layout', 'actions');
    // The rows' 10px is the later rows' top margin, so the break's line adds none.
    expect(row.className).toContain('max-md:gap-y-0');
    const tabs = screen.getByRole('tablist').closest('[data-slot="room-toolbar-tabs"]');
    expect(tabs?.className).toContain('max-md:order-4');
    expect(tabs?.className).toContain('max-md:flex-1');
    expect(tabs?.className).not.toContain('max-md:basis-full');
    const actions = within(row).getByRole('button', { name: 'Day close' }).parentElement;
    expect(actions?.className).toContain('max-md:order-4');
    expect(actions?.className).toContain('max-md:mt-2.5');
    // The line break ends the search row.
    expect(row.querySelector('.max-md\\:basis-full.max-md\\:order-3')).not.toBeNull();
  });

  it('puts the search alone, the views + the room’s filter, then the actions on row 3 (Tasks)', async () => {
    tier.current = 'phone';
    renderToolbar({
      layout: 'tasks',
      filters: undefined,
      filtersSlot: <button type="button">All types</button>,
      search: {
        placeholder: 'Search tasks or people',
        label: 'Search tasks',
        width: 'wide',
        keyHint: false,
      },
    });
    const row = await screen.findByTestId('patients-toolbar');
    expect(row).toHaveAttribute('data-layout', 'tasks');
    // The h1 keeps the default sizes (18px on a tablet, `tasks.md:17`).
    expect(within(row).getByRole('heading', { level: 1 }).className).toContain('text-lg');
    expect(screen.getByTestId('patients-search').className).toContain(
      'max-md:basis-full',
    );
    const slot = screen.getByRole('button', { name: 'All types' }).parentElement;
    expect(slot?.className).toContain('max-md:order-3');
    const actions = screen
      .getByRole('button', { name: 'Day close' })
      .closest('[data-slot="room-toolbar-actions"]');
    expect(actions?.className).toContain('max-md:order-5');
    expect(actions?.className).toContain('max-md:basis-full');
  });

  it('opens the Tasks search 220px wide with no key hint (H:2133)', async () => {
    renderToolbar({
      search: {
        placeholder: 'Search tasks or people',
        label: 'Search tasks',
        width: 'wide',
        keyHint: false,
      },
    });
    const search = await screen.findByTestId('patients-search');
    await userEvent.setup().click(screen.getByRole('searchbox'));
    expect(search.className).toContain('md:flex-[0_1_220px]');
    expect(search.className).toContain('md:max-w-none');
    expect(search.textContent).not.toContain('/');
  });

  it('opens Filters as the bottom sheet', async () => {
    tier.current = 'phone';
    const user = userEvent.setup();
    renderToolbar();
    await user.click(await screen.findByTestId('patients-filters-trigger'));
    expect(await screen.findByTestId('patients-filters')).toHaveAttribute(
      'data-picker-surface',
      'sheet',
    );
  });
});

describe('RoomToolbar — saved views', () => {
  it('shows the saved views once one exists, and applies one into the URL', async () => {
    useDevicePrefsStore.setState({
      savedViews: {
        [savedViewsKey('usr_ada', 'patients')]: [
          { id: 'v1', name: 'VIP', filters: { status: ['vip'] } },
        ],
      },
    });
    const user = userEvent.setup();
    const { router } = renderToolbar({}, ['/?created=today']);
    const track = await screen.findByTestId('patients-saved-views');
    const view = within(track).getByRole('button', { name: 'VIP' });
    expect(view).toHaveAttribute('aria-pressed', 'false');

    await user.click(view);
    // A view replaces every filter: its own on, the rest off.
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ status: ['vip'] }),
    );
    expect(within(track).getByRole('button', { name: 'VIP' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('patients-filters-trigger')).toHaveTextContent('Filters1');
  });

  it('has no saved views or "Save as view" when the room turns them off', async () => {
    useDevicePrefsStore.setState({
      savedViews: {
        [savedViewsKey('usr_ada', 'patients')]: [
          { id: 'v1', name: 'VIP', filters: { status: ['vip'] } },
        ],
      },
    });
    const user = userEvent.setup();
    renderToolbar(
      {
        filters: { fields: FIELDS, copy: {}, savedViews: false },
      },
      ['/?status=%5B%22vip%22%5D'],
    );
    await screen.findByTestId('patients-toolbar');
    expect(screen.queryByTestId('patients-saved-views')).toBeNull();
    await user.click(screen.getByTestId('patients-filters-trigger'));
    const panel = await screen.findByTestId('patients-filters');
    expect(within(panel).queryByRole('button', { name: /as view/ })).toBeNull();
  });
});
