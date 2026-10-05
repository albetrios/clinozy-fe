import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { LeadView } from '@/shared/api/clinic/leads-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NIDHI, NOW, RIYA } from '../../__tests__/integration/leads-test-data.ts';
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
      staff={[RIYA, NIDHI]}
      table={table}
      canCreate={canCreate}
      onNewLead={onNewLead}
    />
  );
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
    expect(screen.getByText('2 unreplied')).toHaveClass('sr-only');
  });

  it('switches the view', async () => {
    const onViewChange = vi.fn();
    renderWithProviders(<Harness onViewChange={onViewChange} />);
    await userEvent.setup().click(await screen.findByRole('tab', { name: 'All' }));
    expect(onViewChange).toHaveBeenCalledWith('all');
  });

  it('hides the Unreplied chip at zero', async () => {
    renderWithProviders(<Harness />);
    expect(await screen.findByRole('tab', { name: 'Unreplied' })).toBeInTheDocument();
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

  it('searches name, phone and #ID, and shows hidden columns on the Columns button', async () => {
    renderWithProviders(<Harness />);
    expect(
      await screen.findByPlaceholderText('Search name, phone, #ID'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show or hide columns' })).toHaveAttribute(
      'title',
      'Columns · 5 of 5 shown',
    );
  });

  it('lists the Filters in the design’s order, the Team section with the team', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.click(await screen.findByTestId('leads-filters-trigger'));
    const panel = await screen.findByTestId('leads-filters');
    expect(
      within(panel)
        .getAllByRole('group')
        .map(
          (group) =>
            document.getElementById(group.getAttribute('aria-labelledby') ?? '')
              ?.textContent,
        ),
    ).toEqual([
      'Status',
      'Source · pick any',
      'Ownership · hold after idle days',
      'Team · assigned or involved',
      'Created',
      'Follow-up date',
    ]);
    // "Any" stands for no ownership filter; the statuses and sources in their tones.
    const ownership = within(panel).getByRole('group', {
      name: 'Ownership · hold after idle days',
    });
    expect(within(ownership).getByRole('button', { name: 'Any' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(panel).getByRole('button', { name: 'Phone call' })).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Anyone on the team' }));
    expect(
      within(panel).getByRole('button', { name: 'Nidhi Kapoor Counsellor' }),
    ).toBeInTheDocument();
    // Leads keeps no saved views: Apply is the footer's only action.
    expect(within(panel).queryByRole('button', { name: 'Save as view' })).toBeNull();
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
