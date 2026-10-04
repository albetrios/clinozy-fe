import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { LeadsPage } from '../../LeadsPage.tsx';
import { renderLeadsRoutes } from './leads-test-router.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { info: vi.fn(), success: vi.fn(), error: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
}));
vi.mock('@/shared/hooks/useClinicAccess/index.ts', () => ({
  useClinicAccess: () => ({
    roles: ['front_desk'],
    previewRole: null,
    can: () => true,
    canAbility: () => true,
    viewableSections: [],
    isResolved: true,
  }),
}));

const LEADS = '/organization/acme/leads';
/** The prototype's own day, 10:00 clinic time: the seeds sit where the design drew them. */
const SEED_NOW = new Date(clinicInstant('2026-09-27', '10:00'));

/** The names of the rows on screen, in order. */
const rowNames = () =>
  screen
    .getAllByTestId('leads-table-row')
    .map(
      (row) =>
        row.querySelector(
          '[data-slot="person-chip"] > span:last-child > span:first-child',
        )?.textContent,
    );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SEED_NOW);
  for (const mock of Object.values(notifyMock)) mock.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('the Leads list (KICKOFF §6.3)', () => {
  it('opens on Mine — the signed-in member’s leads — with the Unreplied count', async () => {
    renderLeadsRoutes(LEADS, LeadsPage);
    expect(await screen.findByText('Anaya Desai')).toBeInTheDocument();
    // Riya's: never Nidhi's Kabir Mehta.
    expect(screen.queryByText('Kabir Mehta')).toBeNull();
    expect(await screen.findByText('2 unreplied')).toBeInTheDocument();
  });

  it('shows every lead on All, and writes the view to the URL', async () => {
    const { router } = renderLeadsRoutes(LEADS, LeadsPage);
    await screen.findByText('Anaya Desai');
    await userEvent.setup().click(screen.getByRole('tab', { name: 'All' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ view: 'all' }),
    );
    expect(await screen.findByText('Kabir Mehta')).toBeInTheDocument();
    // Seventeen leads; never a contact thread.
    expect(screen.getAllByTestId('leads-table-row')).toHaveLength(17);
    expect(screen.queryByText('Neha Gupta')).toBeNull();
  });

  it('filters the Ownership buckets on the hold: open, releasing today, held', async () => {
    const { unmount } = renderLeadsRoutes(`${LEADS}?view=all&hold=open`, LeadsPage);
    await screen.findByText('Poonam Balar');
    // Asha has left the clinic: her lead is open to the team.
    expect(rowNames()).toEqual(['Poonam Balar']);
    unmount();

    const soon = renderLeadsRoutes(`${LEADS}?view=all&hold=soon`, LeadsPage);
    await screen.findByText('Mehul Solanki');
    expect(rowNames()).toEqual(['Mehul Solanki', 'Akshar Gajera']);
    expect(screen.getAllByTestId('leads-hold-dot')).toHaveLength(2);
    soon.unmount();

    renderLeadsRoutes(`${LEADS}?view=all&hold=held`, LeadsPage);
    await screen.findByText('Kabir Mehta');
    expect(rowNames()).not.toContain('Poonam Balar');
    expect(rowNames()).toContain('Mehul Solanki');
    // Closed leads hold nothing.
    expect(rowNames()).not.toContain('Tulsi');
  });

  it('says "No leads match" and clears the filters it has', async () => {
    const { router } = renderLeadsRoutes(
      `${LEADS}?view=all&q=zzzz&status=lost`,
      LeadsPage,
    );
    expect(await screen.findByText('No leads match')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('q'));
    expect(router.state.location.search).not.toHaveProperty('status');
    expect(router.state.location.search).toMatchObject({ view: 'all' });
  });

  it('claims an open lead from its row, offering Undo', async () => {
    renderLeadsRoutes(`${LEADS}?view=all&hold=open`, LeadsPage);
    await screen.findByText('Poonam Balar');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Open to team · Join' }));
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        'You now own Poonam Balar · Asha M. stays involved',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
  });

  it('opens a lead from its row, keeping the list’s view', async () => {
    const { router } = renderLeadsRoutes(`${LEADS}?view=all`, LeadsPage);
    await userEvent.setup().click(await screen.findByText('Kabir Mehta'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${LEADS}/${ref.lead(2364)}`),
    );
    expect(router.state.location.search).toMatchObject({ view: 'all' });
  });

  it('marks an unread lead read as it opens', async () => {
    renderLeadsRoutes(LEADS, LeadsPage);
    const name = await screen.findByText('Anaya Desai');
    expect(name).toHaveClass('font-semibold');
    await userEvent.setup().click(name);
    await waitFor(() =>
      expect(screen.getByText('Anaya Desai')).toHaveClass('font-medium'),
    );
  });

  it('sorts from the headers through the URL — Updated newest first, then off', async () => {
    const { router } = renderLeadsRoutes(`${LEADS}?view=all`, LeadsPage);
    await screen.findByText('Kabir Mehta');
    const header = screen.getByTestId('leads-table-header');
    const user = userEvent.setup();
    await user.click(within(header).getByRole('button', { name: 'Updated' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'updated:desc' }),
    );
    await user.click(within(header).getByRole('button', { name: 'Updated' }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('sort'));
    await user.click(within(header).getByRole('button', { name: 'Lead' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'name:asc' }),
    );
    expect(rowNames()[0]).toBe('Akshar Gajera');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderLeadsRoutes(`${LEADS}?view=all`, LeadsPage);
    await screen.findByText('Kabir Mehta');
    expect(await axe(container)).toHaveNoViolations();
  });
});
