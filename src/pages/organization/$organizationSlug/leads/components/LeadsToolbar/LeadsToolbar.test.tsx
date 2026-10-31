import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { LeadView } from '@/shared/api/app/leads-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NIDHI, NOW, RIYA, TEAM } from '../../__tests__/integration/leads-test-data.ts';
import { useLeadsTable } from '../LeadsTable/index.ts';
import { LeadsToolbar } from './LeadsToolbar.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

function Harness({
  view = 'mine',
  unreplied = 0,
  canCreate = true,
  onViewChange = () => undefined,
  onNewLead = () => undefined,
}: {
  view?: LeadView;
  unreplied?: number;
  canCreate?: boolean;
  onViewChange?: (view: LeadView) => void;
  onNewLead?: () => void;
}) {
  const table = useLeadsTable({
    rows: [],
    sorting: [],
    onSortingChange: () => undefined,
    now: NOW,
  });
  return (
    <LeadsToolbar
      view={view}
      onViewChange={onViewChange}
      unreplied={unreplied}
      members={TEAM}
      table={table}
      canCreate={canCreate}
      onNewLead={onNewLead}
    />
  );
}

/** Each Filters section's label, in order. */
const sectionLabels = (panel: HTMLElement) =>
  within(panel)
    .getAllByRole('group')
    .map(
      (group) =>
        document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent,
    );

/** Open the Filters popover. */
async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId('leads-filters-trigger'));
  return screen.findByTestId('leads-filters');
}

beforeEach(() => {
  viewport.tier = 'desktop';
});

describe('LeadsToolbar (leads.md:17)', () => {
  it('names the room and offers Mine · Unreplied · All, Mine first', async () => {
    renderWithProviders(<Harness unreplied={2} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Leads' }),
    ).toBeInTheDocument();
    const views = screen.getByRole('tablist', { name: 'Lead views' });
    expect(
      within(views)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Mine', 'Unreplied22 unreplied', 'All']);
    expect(within(views).getByRole('tab', { name: 'Mine' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The chip is read out in words; its digits are hidden from a screen reader.
    expect(screen.getByText('2 unreplied')).toHaveClass('sr-only');
  });

  it('marks the view the URL holds and switches it', async () => {
    const onViewChange = vi.fn();
    renderWithProviders(<Harness view="unreplied" onViewChange={onViewChange} />);
    expect(await screen.findByRole('tab', { name: 'Unreplied' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.setup().click(screen.getByRole('tab', { name: 'All' }));
    expect(onViewChange).toHaveBeenCalledWith('all');
  });

  it('hides the Unreplied chip at zero', async () => {
    renderWithProviders(<Harness />);
    const tab = await screen.findByRole('tab', { name: 'Unreplied' });
    expect(tab).toHaveTextContent(/^Unreplied$/);
  });

  it('offers "New lead" only with Create', async () => {
    const onNewLead = vi.fn();
    const { unmount } = renderWithProviders(<Harness onNewLead={onNewLead} />);
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'New lead' }));
    expect(onNewLead).toHaveBeenCalled();
    unmount();
    renderWithProviders(<Harness canCreate={false} />);
    await screen.findByRole('heading', { level: 1, name: 'Leads' });
    expect(screen.queryByRole('button', { name: 'New lead' })).toBeNull();
  });

  it('searches name, phone and #ID into the URL', async () => {
    const { router } = renderWithProviders(<Harness />);
    const search = await screen.findByPlaceholderText('Search name, phone, #ID');
    expect(search).toHaveAccessibleName('Search leads');
    await userEvent.setup().type(search, 'anaya');
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ q: 'anaya' }),
    );
  });

  it('counts the shown columns on the Columns button', async () => {
    renderWithProviders(<Harness />);
    expect(
      await screen.findByRole('button', { name: 'Show or hide columns' }),
    ).toHaveAttribute('title', 'Columns · 5 of 5 shown');
  });

  it('lists the Filters in the design’s order, with no saved views', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    const panel = await openFilters(user);
    expect(sectionLabels(panel)).toEqual([
      'Status',
      'Source · pick any',
      'Ownership · held after a claim',
      'Team · assigned or involved',
      'Age',
      'Created',
      'Follow-up date',
    ]);
    // "Any" stands for no ownership filter.
    const ownership = within(panel).getByRole('group', {
      name: 'Ownership · held after a claim',
    });
    expect(
      within(ownership)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Any', 'Open to claim', 'Releasing today', 'Held']);
    expect(within(ownership).getByRole('button', { name: 'Any' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The sources the API keeps — never the design's "Phone call".
    const source = within(panel).getByRole('group', { name: 'Source · pick any' });
    expect(within(source).getByRole('button', { name: 'Walk-in' })).toBeInTheDocument();
    expect(within(source).queryByRole('button', { name: 'Phone call' })).toBeNull();
    // Leads keeps no saved views: Apply is the footer's only action.
    expect(within(panel).queryByRole('button', { name: 'Save as view' })).toBeNull();
  });

  it('offers no "Not set" follow-up: the API cannot filter by it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    const panel = await openFilters(user);
    const followUp = within(panel).getByRole('group', { name: 'Follow-up date' });
    expect(
      within(followUp)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Any', 'Overdue', 'Today', 'Tomorrow', 'Next 7 days', 'Custom range']);
  });

  it('lists the team in the Team section — one member at a time — and applies to the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderWithProviders(<Harness />);
    const panel = await openFilters(user);
    await user.click(within(panel).getByRole('button', { name: 'Anyone on the team' }));
    const riya = within(panel).getByRole('button', { name: 'Riya Shah' });
    const nidhi = within(panel).getByRole('button', { name: 'Nidhi Kapoor' });
    await user.click(riya);
    expect(riya).toHaveAttribute('aria-pressed', 'true');
    // A second pick replaces the first.
    await user.click(nidhi);
    expect(nidhi).toHaveAttribute('aria-pressed', 'true');
    expect(riya).toHaveAttribute('aria-pressed', 'false');
    await user.click(within(panel).getByRole('button', { name: 'Apply filter' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ member: NIDHI.id }),
    );
    expect(router.state.location.search).not.toMatchObject({ member: RIYA.id });
  });

  it('puts the search alone on the first phone row and floats "New lead"', async () => {
    viewport.tier = 'phone';
    renderWithProviders(<Harness />);
    const toolbar = await screen.findByTestId('leads-toolbar');
    expect(toolbar).toHaveAttribute('data-layout', 'leads');
    expect(await screen.findByTestId('leads-fab')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<Harness unreplied={1} />);
    await screen.findByRole('heading', { level: 1, name: 'Leads' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
