import { act, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { staffRef } from '@/shared/api/clinic/fixtures/staff.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { renderLeadsRoutes } from '../../__tests__/integration/leads-test-router.tsx';
import { type LeadsListState, useLeadsList } from './useLeadsList.ts';

const LEADS = '/organization/acme/leads';
/** What the probe page last rendered with. */
const probe: { state: LeadsListState | null } = { state: null };

/** A page that only reads the hook, handing its state to the test after each render. */
function Probe() {
  const state = useLeadsList();
  useEffect(() => {
    probe.state = state;
  });
  return <output data-testid="rows">{state.list.rows.length}</output>;
}

const state = () => {
  if (!probe.state) throw new Error('the probe has not rendered');
  return probe.state;
};

beforeEach(() => {
  probe.state = null;
  resetClinicFixtures();
});
afterEach(() => resetClinicFixtures());

describe('useLeadsList', () => {
  it('reads Mine for the signed-in member — the fixture server’s own when no profile matches', async () => {
    renderLeadsRoutes(LEADS, Probe);
    await waitFor(() => expect(state().viewer?.id).toBe(staffRef('RS')));
    expect(state().view).toBe('mine');
    expect(state().params).toMatchObject({ view: 'mine', viewerId: staffRef('RS') });
    await waitFor(() =>
      expect(Number(screen.getByTestId('rows').textContent)).toBeGreaterThan(0),
    );
    expect(state().list.rows.every((lead) => lead.ownerId === staffRef('RS'))).toBe(true);
    expect(state().unreplied).toBe(2);
    expect(state().filtered).toBe(false);
  });

  it('writes the view, keeping Mine out of the URL', async () => {
    const { router } = renderLeadsRoutes(LEADS, Probe);
    await waitFor(() => expect(state().viewer).not.toBeNull());
    act(() => state().setView('all'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ view: 'all' }),
    );
    act(() => state().setView('mine'));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('view'));
  });

  it('reads and writes the sort as the shared table’s `column:direction`', async () => {
    const { router } = renderLeadsRoutes(`${LEADS}?sort=status:desc`, Probe);
    await waitFor(() => expect(state().sorting).toEqual([{ id: 'status', desc: true }]));
    act(() => state().setSorting([{ id: 'name', desc: false }]));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'name:asc' }),
    );
    act(() => state().setSorting([]));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('sort'));
  });

  it('knows when filters apply, and clears them all — the view stays', async () => {
    const { router } = renderLeadsRoutes(
      `${LEADS}?view=all&q=asha&hold=open&source=instagram`,
      Probe,
    );
    await waitFor(() => expect(state().filtered).toBe(true));
    act(() => state().clearFilters());
    await waitFor(() => expect(router.state.location.search).toEqual({ view: 'all' }));
    expect(state().filtered).toBe(false);
  });

  it('lists the team for the owners, the involved people and the Team filter', async () => {
    renderLeadsRoutes(LEADS, Probe);
    await waitFor(() => expect(state().staff.length).toBeGreaterThan(0));
    expect(state().staffById.get(staffRef('NK'))?.firstName).toBe('Nidhi');
    expect(state().staffUpdatedAt).not.toBeNull();
  });
});
