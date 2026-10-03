import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { renderLeadsRoutes } from '../../__tests__/integration/leads-test-router.tsx';
import { type LeadsDialogRoute, useLeadsDialogRoute } from './useLeadsDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { info: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const LEADS = '/organization/acme/leads';

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
  resetClinicFixtures();
});
afterEach(() => resetClinicFixtures());

describe('useLeadsDialogRoute', () => {
  it('opens nothing on the list itself', async () => {
    renderLeadsRoutes(LEADS, Probe);
    await screen.findByTestId('probe');
    expect(seen()).toEqual({ kind: 'none' });
  });

  it('opens the lead drawer on a deep link and resolves the lead', async () => {
    const id = ref.lead(2363);
    const { router } = renderLeadsRoutes(`${LEADS}/${id}?view=all`, Probe);
    await waitFor(() =>
      expect(seen()).toEqual({
        kind: 'lead',
        leadId: id,
        name: 'Anaya Desai',
        isPending: false,
      }),
    );
    expect(router.state.location.pathname).toBe(`${LEADS}/${id}`);
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('sends an unknown id back to the list, filters kept, with "Lead not found" (S:115)', async () => {
    const { router } = renderLeadsRoutes(
      `${LEADS}/${ref.lead(1)}?view=all&status=new`,
      Probe,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
    expect(router.state.location.search).toMatchObject({ view: 'all', status: 'new' });
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Lead not found · it may have been deleted',
    );
    expect(seen()).toEqual({ kind: 'none' });
  });

  it('treats a contact thread’s id as no lead (S:261)', async () => {
    const { router } = renderLeadsRoutes(`${LEADS}/${ref.lead(2372)}`, Probe);
    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Lead not found · it may have been deleted',
    );
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
