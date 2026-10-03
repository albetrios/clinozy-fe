import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { leadQueryKeys } from '@/shared/api/clinic/leads-api.ts';

import { LeadsPage } from '../../LeadsPage.tsx';
import { renderLeadsRoutes } from './leads-test-router.tsx';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { info: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const LEADS = '/organization/acme/leads';

beforeEach(() => {
  notifyMock.info.mockReset();
  resetClinicFixtures();
});
afterEach(() => resetClinicFixtures());

describe('the Leads dialog routes (D24, S:22–25)', () => {
  it('keeps the list behind a deep-linked lead, the URL and its filters in place', async () => {
    const id = ref.lead(2364);
    const { router, queryClient } = renderLeadsRoutes(
      `${LEADS}/${id}?view=all`,
      LeadsPage,
    );
    expect(await screen.findByTestId('leads-page')).toBeInTheDocument();
    await waitFor(() =>
      expect(queryClient.getQueryState(leadQueryKeys.detail(id))?.status).toBe('success'),
    );
    expect(router.state.location.pathname).toBe(`${LEADS}/${id}`);
    expect(router.state.location.search).toMatchObject({ view: 'all' });
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('answers an unknown lead with the list, no drawer, and "Lead not found" (S:115)', async () => {
    const { router } = renderLeadsRoutes(`${LEADS}/${ref.lead(9)}?hold=open`, LeadsPage);
    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
    expect(screen.getByTestId('leads-page')).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ hold: 'open' });
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Lead not found · it may have been deleted',
    );
  });

  it('keeps the New lead prefill in the URL — the mobile as E.164', async () => {
    const { router } = renderLeadsRoutes(
      `${LEADS}/create?name=Rhea%20Shah&phone=9825011241&view=all`,
      LeadsPage,
    );
    expect(await screen.findByTestId('leads-page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`${LEADS}/create`);
    const match = router.state.matches.at(-1);
    expect(match?.search).toMatchObject({
      view: 'all',
      name: 'Rhea Shah',
      phone: '+919825011241',
    });
  });

  it('has no axe violations behind a dialog route', async () => {
    const { container } = renderLeadsRoutes(`${LEADS}/${ref.lead(2364)}`, LeadsPage);
    await screen.findByTestId('leads-page');
    expect(await axe(container)).toHaveNoViolations();
  });
});
