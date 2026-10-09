import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as LeadsApiModule from '@/shared/api/clinic/leads-api.ts';
import { fetchLead } from '@/shared/api/clinic/leads-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import {
  leadRecord,
  type LeadsWorld,
  seededLeadsWorld,
} from '../../__tests__/integration/leads-test-data.ts';
import { renderLeadsRoutes } from '../../__tests__/integration/leads-test-router.tsx';
import { type LeadsDialogRoute, useLeadsDialogRoute } from './useLeadsDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { info: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
const world = vi.hoisted(() => ({}) as LeadsWorld);
vi.mock('@/shared/api/clinic/leads-api.ts', async (importOriginal) => {
  const { leadsApiDouble } =
    await import('../../__tests__/integration/leads-test-data.ts');
  return { ...(await importOriginal<typeof LeadsApiModule>()), ...leadsApiDouble(world) };
});

const LEADS = '/organization/acme/leads';
const ANAYA = leadRecord();
/** A well-formed lead id no lead has. */
const UNKNOWN = 'lead_gone0000000000000000';

/** What the hook answered, minus the record itself (its name stands in). */
function summary(route: LeadsDialogRoute) {
  if (route.kind !== 'lead') return route;
  return {
    kind: route.kind,
    leadId: route.leadId,
    name: route.lead?.name ?? null,
    isPending: route.isPending,
  };
}

/** Renders the hook's answer as JSON for the tests to read. */
function Probe() {
  return (
    <output data-testid="probe">{JSON.stringify(summary(useLeadsDialogRoute()))}</output>
  );
}

/** The hook's latest answer. */
function seen(): unknown {
  return JSON.parse(screen.getByTestId('probe').textContent ?? 'null');
}

beforeEach(() => {
  notifyMock.info.mockReset();
  Object.assign(world, seededLeadsWorld());
  vi.mocked(fetchLead).mockClear();
  signInTestMember();
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

describe('useLeadsDialogRoute', () => {
  it('opens nothing on the list itself', async () => {
    renderLeadsRoutes(LEADS, Probe);
    await screen.findByTestId('probe');
    expect(seen()).toEqual({ kind: 'none' });
    expect(fetchLead).not.toHaveBeenCalled();
  });

  it('opens the lead drawer on a deep link, reading the lead by its id', async () => {
    const { router } = renderLeadsRoutes(`${LEADS}/${ANAYA.id}?view=all`, Probe);
    await waitFor(() =>
      expect(seen()).toEqual({
        kind: 'lead',
        leadId: ANAYA.id,
        name: 'Anaya Desai',
        isPending: false,
      }),
    );
    expect(fetchLead).toHaveBeenCalledWith(ANAYA.id);
    expect(router.state.location.pathname).toBe(`${LEADS}/${ANAYA.id}`);
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('is pending while the lead loads', async () => {
    vi.mocked(fetchLead).mockReturnValueOnce(new Promise(() => undefined));
    renderLeadsRoutes(`${LEADS}/${ANAYA.id}`, Probe);
    await waitFor(() =>
      expect(seen()).toEqual({
        kind: 'lead',
        leadId: ANAYA.id,
        name: null,
        isPending: true,
      }),
    );
  });

  it('sends an unknown lead back to the list, filters kept, with "Lead not found" (S:115)', async () => {
    const { router } = renderLeadsRoutes(
      `${LEADS}/${UNKNOWN}?view=all&status=new`,
      Probe,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
    expect(router.state.location.search).toMatchObject({ view: 'all', status: 'new' });
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Lead not found · it may have been deleted',
    );
    expect(seen()).toEqual({ kind: 'none' });
  });

  it('opens New lead with the prefill, the mobile as E.164', async () => {
    renderLeadsRoutes(`${LEADS}/create?name=Rhea%20Shah&phone=98250%2011241`, Probe);
    await waitFor(() =>
      expect(seen()).toEqual({
        kind: 'create',
        prefill: { name: 'Rhea Shah', phone: '+919825011241' },
      }),
    );
  });

  it('opens New lead without a prefill, dropping a mobile that is not one', async () => {
    renderLeadsRoutes(`${LEADS}/create?phone=12345`, Probe);
    // JSON drops the undefined prefill values.
    await waitFor(() => expect(seen()).toEqual({ kind: 'create', prefill: {} }));
  });
});
