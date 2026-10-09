import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ContactActivitiesApiModule from '@/shared/api/clinic/contact-activities-api.ts';
import type * as ContactsApiModule from '@/shared/api/clinic/contacts-api.ts';
import type * as DirectoryApiModule from '@/shared/api/clinic/directory-api.ts';
import type * as LeadsApiModule from '@/shared/api/clinic/leads-api.ts';
import { fetchLead, leadQueryKeys } from '@/shared/api/clinic/leads-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import type * as MyMembershipModule from '@/shared/tenancy/my-membership.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { LeadsPage } from '../../LeadsPage.tsx';
import {
  contactRecord,
  type ContactsWorld,
  KABIR,
  leadRecord,
  type LeadsWorld,
  NOW,
  seededLeadsWorld,
} from './leads-test-data.ts';
import { renderLeadsRoutes } from './leads-test-router.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/hooks/useClinicAccess/index.ts', () => ({
  useClinicAccess: () => ({
    roles: ['front_desk'],
    previewRole: null,
    can: () => true,
    canAbility: () => true,
    canCode: () => true,
    viewableSections: [],
    isResolved: true,
  }),
}));

const world = vi.hoisted(() => ({}) as LeadsWorld);
const people = vi.hoisted(() => ({}) as ContactsWorld);
vi.mock('@/shared/api/clinic/leads-api.ts', async (importOriginal) => {
  const { leadsApiDouble } = await import('./leads-test-data.ts');
  return { ...(await importOriginal<typeof LeadsApiModule>()), ...leadsApiDouble(world) };
});
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => {
  const { directoryApiDouble } = await import('./leads-test-data.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    ...directoryApiDouble(),
  };
});
vi.mock('@/shared/api/clinic/contacts-api.ts', async (importOriginal) => {
  const { contactsApiDouble } = await import('./leads-test-data.ts');
  return {
    ...(await importOriginal<typeof ContactsApiModule>()),
    ...contactsApiDouble(people),
  };
});
vi.mock('@/shared/api/clinic/contact-activities-api.ts', async (importOriginal) => {
  const { contactActivitiesApiDouble } = await import('./leads-test-data.ts');
  return {
    ...(await importOriginal<typeof ContactActivitiesApiModule>()),
    ...contactActivitiesApiDouble(),
  };
});
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof MyMembershipModule>()),
  findMyMembershipId: vi.fn(async () => world.viewerId),
}));

const LEADS = '/organization/acme/leads';
const ANAYA = leadRecord();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const mock of Object.values(notifyMock)) mock.mockReset();
  Object.assign(world, seededLeadsWorld());
  Object.assign(people, { contacts: [contactRecord()] });
  vi.mocked(fetchLead).mockClear();
  signInTestMember();
});
afterEach(() => {
  vi.useRealTimers();
  useOrganizationStore.getState().clearOrganization();
});

describe('the Leads dialog routes (D24, S:22–25)', () => {
  it('keeps the list behind a deep-linked lead, the URL and its filters in place', async () => {
    const { router, queryClient } = renderLeadsRoutes(
      `${LEADS}/${ANAYA.id}?view=all`,
      LeadsPage,
    );
    const drawer = await screen.findByTestId('lead-drawer');
    expect(
      within(drawer).getByRole('button', { name: 'Copy lead ID #2363' }),
    ).toBeVisible();
    expect(fetchLead).toHaveBeenCalledWith(ANAYA.id);
    expect(
      queryClient.getQueryState(leadQueryKeys.detail('org_test', ANAYA.id))?.status,
    ).toBe('success');
    // The list stays behind it, the lead's own row picked out.
    expect(await screen.findByText('Kabir Mehta')).toBeInTheDocument();
    const activeRows = screen
      .getAllByTestId('leads-table-row')
      .filter((row) => row.dataset.active === 'true');
    expect(activeRows.map((row) => row.textContent?.includes('Anaya Desai'))).toEqual([
      true,
    ]);
    expect(screen.getByTestId('leads-page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`${LEADS}/${ANAYA.id}`);
    expect(router.state.location.search).toMatchObject({ view: 'all' });
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('answers an unknown lead with the list, no drawer, and "Lead not found" (S:115)', async () => {
    const { router } = renderLeadsRoutes(
      `${LEADS}/lead_gone0000000000000000?view=all&hold=open`,
      LeadsPage,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
    expect(router.state.location.search).toMatchObject({ view: 'all', hold: 'open' });
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Lead not found · it may have been deleted',
    );
    expect(screen.getByTestId('leads-page')).toBeInTheDocument();
    expect(screen.queryByTestId('lead-drawer')).toBeNull();
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

  it('answers a removed lead as not found too', async () => {
    world.leads = [KABIR];
    world.removed = [ANAYA];
    const { router } = renderLeadsRoutes(`${LEADS}/${ANAYA.id}`, LeadsPage);
    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Lead not found · it may have been deleted',
    );
  });

  it('has no axe violations behind a dialog route', async () => {
    const { container } = renderLeadsRoutes(`${LEADS}/${ANAYA.id}`, LeadsPage);
    await screen.findByTestId('lead-drawer');
    await screen.findByText('Kabir Mehta');
    // The open drawer hides the page behind it (Radix), focus trapped in the drawer.
    expect(await axeForDialog(container)).toHaveNoViolations();
  });
});
