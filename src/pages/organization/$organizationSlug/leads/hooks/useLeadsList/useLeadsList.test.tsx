import { act, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DirectoryApiModule from '@/shared/api/clinic/directory-api.ts';
import { fetchTeamDirectory } from '@/shared/api/clinic/directory-api.ts';
import type * as LeadsApiModule from '@/shared/api/clinic/leads-api.ts';
import { listLeads } from '@/shared/api/clinic/leads-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import type * as MyMembershipModule from '@/shared/tenancy/my-membership.ts';
import { findMyMembershipId } from '@/shared/tenancy/my-membership.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import {
  KABIR,
  type LeadsWorld,
  NIDHI,
  RIYA,
  seededLeadsWorld,
} from '../../__tests__/integration/leads-test-data.ts';
import { renderLeadsRoutes } from '../../__tests__/integration/leads-test-router.tsx';
import { type LeadsListState, useLeadsList } from './useLeadsList.ts';

const world = vi.hoisted(() => ({}) as LeadsWorld);
/** The membership read, held open until a test lets it answer. */
const membership = vi.hoisted(() => ({
  answer: null as ((id: string | null) => void) | null,
}));
vi.mock('@/shared/api/clinic/leads-api.ts', async (importOriginal) => {
  const { leadsApiDouble } =
    await import('../../__tests__/integration/leads-test-data.ts');
  return { ...(await importOriginal<typeof LeadsApiModule>()), ...leadsApiDouble(world) };
});
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => {
  const { directoryApiDouble } =
    await import('../../__tests__/integration/leads-test-data.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    ...directoryApiDouble(),
  };
});
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof MyMembershipModule>()),
  findMyMembershipId: vi.fn(
    () =>
      new Promise<string | null>((resolve) => {
        membership.answer = resolve;
      }),
  ),
}));

const LEADS = '/organization/acme/leads';
/** What the probe page last rendered with. */
const probe: { state: LeadsListState | null } = { state: null };

/** A page that only reads the hook, handing its state to the test after each render. */
function Probe() {
  const state = useLeadsList();
  useEffect(() => {
    probe.state = state;
  });
  return <output>{state.list.rows.length}</output>;
}

const state = () => {
  if (!probe.state) throw new Error('the probe has not rendered');
  return probe.state;
};

/** Let the membership read answer — Riya's by default. */
async function answerMembership(id: string | null = RIYA.id) {
  await waitFor(() => expect(membership.answer).not.toBeNull());
  act(() => membership.answer?.(id));
}

/** The params of the last list read. */
const lastListParams = () => vi.mocked(listLeads).mock.lastCall?.[0];

beforeEach(() => {
  probe.state = null;
  membership.answer = null;
  Object.assign(world, seededLeadsWorld());
  vi.resetAllMocks();
  signInTestMember();
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

describe('useLeadsList', () => {
  it('reads the URL’s view, search, filters and sort as the list’s params', async () => {
    renderLeadsRoutes(
      `${LEADS}?view=all&q=anaya&status=new&source=instagram,walk_in&hold=soon&member=${NIDHI.id}&created=last_7&followUp=today&sort=activity:desc`,
      Probe,
    );
    await waitFor(() => expect(listLeads).toHaveBeenCalled());
    const expected = {
      view: 'all',
      q: 'anaya',
      status: 'new',
      source: ['instagram', 'walk_in'],
      hold: 'soon',
      member: NIDHI.id,
      created: 'last_7',
      followUp: 'today',
      sort: 'activity',
      order: 'desc',
    };
    expect(lastListParams()).toMatchObject(expected);
    expect(state().params).toMatchObject(expected);
    expect(state().filtered).toBe(true);
    expect(state().sorting).toEqual([{ id: 'activity', desc: true }]);
  });

  it('waits for the viewer’s membership before it reads Mine', async () => {
    renderLeadsRoutes(LEADS, Probe);
    await waitFor(() => expect(findMyMembershipId).toHaveBeenCalledWith('usr_test'));
    expect(state().view).toBe('mine');
    expect(state().loading).toBe(true);
    expect(listLeads).not.toHaveBeenCalled();

    await answerMembership();
    await waitFor(() => expect(state().list.rows).toHaveLength(1));
    expect(lastListParams()).toMatchObject({ view: 'mine', viewerId: RIYA.id });
    expect(state().viewerId).toBe(RIYA.id);
    expect(state().list.rows[0]?.id).toBe(KABIR.id);
    expect(state().loading).toBe(false);
  });

  it('is not stuck loading on Mine for a caller off the team', async () => {
    renderLeadsRoutes(LEADS, Probe);
    await answerMembership(null);
    await waitFor(() => expect(state().loading).toBe(false));
    expect(state().viewerId).toBeNull();
    expect(state().list.rows).toEqual([]);
    expect(listLeads).not.toHaveBeenCalled();
    expect(state().unreplied).toBe(0);
  });

  it('reads All at once, without waiting for the membership', async () => {
    renderLeadsRoutes(`${LEADS}?view=all`, Probe);
    await waitFor(() => expect(state().list.rows).toHaveLength(2));
    expect(membership.answer).not.toBeNull();
    expect(lastListParams()).toMatchObject({ view: 'all', viewerId: null });
  });

  it('counts the viewer’s leads awaiting their reply for the Unreplied chip', async () => {
    renderLeadsRoutes(LEADS, Probe);
    await answerMembership();
    await waitFor(() => expect(state().unreplied).toBe(1));
  });

  it('lists the team from the member directory', async () => {
    renderLeadsRoutes(`${LEADS}?view=all`, Probe);
    await waitFor(() => expect(state().members).toHaveLength(2));
    expect(fetchTeamDirectory).toHaveBeenCalledOnce();
    expect(state().team.get(NIDHI.id)?.name).toBe('Nidhi Kapoor');
    expect(state().teamUpdatedAt).not.toBeNull();
  });

  it('writes the view, keeping Mine out of the URL', async () => {
    const { router } = renderLeadsRoutes(LEADS, Probe);
    await answerMembership();
    act(() => state().setView('unreplied'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ view: 'unreplied' }),
    );
    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ view: 'unreplied', viewerId: RIYA.id }),
    );
    act(() => state().setView('mine'));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('view'));
  });

  it('reads and writes the sort as the shared table’s `column:direction`', async () => {
    const { router } = renderLeadsRoutes(`${LEADS}?view=all&sort=status:desc`, Probe);
    await waitFor(() => expect(state().sorting).toEqual([{ id: 'status', desc: true }]));
    act(() => state().setSorting([{ id: 'activity', desc: true }]));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'activity:desc' }),
    );
    act(() => state().setSorting([]));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('sort'));
  });

  it('knows when filters apply, and clears them all — the view and sort stay', async () => {
    const { router } = renderLeadsRoutes(
      `${LEADS}?view=all&q=asha&hold=open&source=instagram&member=${NIDHI.id}&sort=name:asc`,
      Probe,
    );
    await waitFor(() => expect(state().filtered).toBe(true));
    act(() => state().clearFilters());
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: 'all', sort: 'name:asc' }),
    );
    expect(state().filtered).toBe(false);
  });
});
