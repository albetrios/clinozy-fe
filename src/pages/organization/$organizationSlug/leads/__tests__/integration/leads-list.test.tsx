import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as ContactActivitiesApiModule from '@/shared/api/app/contact-activities-api.ts';
import type * as ContactsApiModule from '@/shared/api/app/contacts-api.ts';
import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import type * as LeadsApiModule from '@/shared/api/app/leads-api.ts';
import { claimLead, leadListQuery, listLeads } from '@/shared/api/app/leads-api.ts';
import type { LeadListParams } from '@/shared/api/app/leads-contracts.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import type * as MyMembershipModule from '@/shared/tenancy/my-membership.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

import { LeadsPage } from '../../LeadsPage.tsx';
import {
  contactRecord,
  type ContactsWorld,
  daysAgo,
  KABIR,
  leadRecord,
  type LeadsWorld,
  NOW,
  seededLeadsWorld,
} from './leads-test-data.ts';
import { renderLeadsRoutes } from './leads-test-router.tsx';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
}));
vi.mock('@/shared/hooks/useAppAccess/index.ts', () => ({
  useAppAccess: () => ({
    previewRole: null,
    can: () => true,
    canCode: () => true,
    viewableSections: [],
    isResolved: true,
  }),
}));

const world = vi.hoisted(() => ({}) as LeadsWorld);
const people = vi.hoisted(() => ({}) as ContactsWorld);
vi.mock('@/shared/api/app/leads-api.ts', async (importOriginal) => {
  const { leadsApiDouble } = await import('./leads-test-data.ts');
  return { ...(await importOriginal<typeof LeadsApiModule>()), ...leadsApiDouble(world) };
});
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => {
  const { directoryApiDouble } = await import('./leads-test-data.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    ...directoryApiDouble(),
  };
});
vi.mock('@/shared/api/app/contacts-api.ts', async (importOriginal) => {
  const { contactsApiDouble } = await import('./leads-test-data.ts');
  return {
    ...(await importOriginal<typeof ContactsApiModule>()),
    ...contactsApiDouble(people),
  };
});
vi.mock('@/shared/api/app/contact-activities-api.ts', async (importOriginal) => {
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

const rowOf = (name: string) => {
  const row = screen
    .getAllByTestId('leads-table-row')
    .find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

/** The params of the last list read. */
const lastListParams = (): LeadListParams => {
  const params = vi.mocked(listLeads).mock.lastCall?.[0];
  if (!params) throw new Error('the list was never read');
  return params;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  Object.assign(world, seededLeadsWorld());
  Object.assign(people, {
    contacts: [
      contactRecord(),
      contactRecord({
        id: KABIR.contactId,
        contactNumber: 10235,
        firstName: 'Kabir',
        lastName: 'Mehta',
        name: 'Kabir Mehta',
        primaryPhone: '+919825044120',
        openLeadId: KABIR.id,
        phones: [{ phone: '+919825044120', isPrimary: true, isOnWhatsapp: false }],
      }),
    ],
  });
  vi.resetAllMocks();
  signInTestMember();
});
afterEach(() => {
  vi.useRealTimers();
  useOrganizationStore.getState().clearOrganization();
});

describe('the Leads list (KICKOFF §6.3)', () => {
  it('opens on Mine — the viewer’s leads — with the Unreplied count', async () => {
    renderLeadsRoutes(LEADS, LeadsPage);
    expect(await screen.findByText('Kabir Mehta')).toBeInTheDocument();
    // Riya's: never Nidhi's Anaya Desai.
    expect(screen.queryByText('Anaya Desai')).toBeNull();
    expect(lastListParams()).toMatchObject({ view: 'mine', viewerId: world.viewerId });
    expect(await screen.findByText('1 unreplied')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Mine' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows everyone’s leads on All, and writes the view to the URL', async () => {
    const { router } = renderLeadsRoutes(LEADS, LeadsPage);
    await screen.findByText('Kabir Mehta');
    await userEvent.setup().click(screen.getByRole('tab', { name: 'All' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ view: 'all' }),
    );
    expect(await screen.findByText('Anaya Desai')).toBeInTheDocument();
    expect(rowNames()).toEqual(['Anaya Desai', 'Kabir Mehta']);
  });

  it('sends the Ownership filter as the list’s `ownership`', async () => {
    const user = userEvent.setup();
    const { router } = renderLeadsRoutes(`${LEADS}?view=all`, LeadsPage);
    await screen.findByText('Anaya Desai');
    await user.click(screen.getByTestId('leads-filters-trigger'));
    const panel = await screen.findByTestId('leads-filters');
    await user.click(within(panel).getByRole('button', { name: 'Releasing today' }));
    await user.click(within(panel).getByRole('button', { name: 'Apply filter' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ view: 'all', hold: 'soon' }),
    );
    await waitFor(() => expect(lastListParams()).toMatchObject({ hold: 'soon' }));
    expect(leadListQuery(lastListParams())).toMatchObject({
      ownership: 'releasing_today',
    });
  });

  it('says "No leads match" and clears the filters it has, keeping the view', async () => {
    const user = userEvent.setup();
    const { router } = renderLeadsRoutes(
      `${LEADS}?view=all&q=zzzz&status=lost`,
      LeadsPage,
    );
    expect(await screen.findByText('No leads match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('q'));
    expect(router.state.location.search).not.toHaveProperty('status');
    expect(router.state.location.search).toMatchObject({ view: 'all' });
    expect(await screen.findByText('Anaya Desai')).toBeInTheDocument();
  });

  it('draws "No leads yet" in lav, with no button, when the clinic has none', async () => {
    world.leads = [];
    renderLeadsRoutes(`${LEADS}?view=all`, LeadsPage);
    const empty = await screen.findByTestId('leads-empty');
    expect(empty).toHaveAttribute('data-tone', 'lav');
    expect(
      within(empty).getByRole('heading', { name: 'No leads yet' }),
    ).toBeInTheDocument();
    expect(empty).toHaveTextContent(
      'Enquiries from calls, WhatsApp and walk-ins land here.',
    );
    expect(within(empty).queryByRole('button')).toBeNull();
  });

  it('claims an open lead from its row — "You now own …", no Undo', async () => {
    world.leads = [leadRecord({ heldUntil: daysAgo(1) }), KABIR];
    renderLeadsRoutes(`${LEADS}?view=all`, LeadsPage);
    await screen.findByText('Anaya Desai');
    await userEvent
      .setup()
      .click(within(rowOf('Anaya Desai')).getByRole('button', { name: 'Open · Claim' }));
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith(
        'You now own Anaya Desai · Nidhi K. stays involved',
      ),
    );
    expect(claimLead).toHaveBeenCalledWith(world.leads[0]?.id, expect.any(String));
    expect(notify.undo).not.toHaveBeenCalled();
    // The list reads again: the lead is Riya's and held, nothing left to claim.
    await waitFor(() =>
      expect(within(rowOf('Anaya Desai')).getByText('Riya S.')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Open · Claim' })).toBeNull();
  });

  it('opens a lead from its row, keeping the list’s view', async () => {
    const { router } = renderLeadsRoutes(`${LEADS}?view=all`, LeadsPage);
    await userEvent.setup().click(await screen.findByText('Kabir Mehta'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${LEADS}/${KABIR.id}`),
    );
    expect(router.state.location.search).toMatchObject({ view: 'all' });
    expect(await screen.findByTestId('lead-drawer')).toBeInTheDocument();
    expect(rowOf('Kabir Mehta')).toHaveAttribute('data-active', 'true');
  });

  it('sorts from the headers through the URL — Updated is the last activity', async () => {
    const { router } = renderLeadsRoutes(`${LEADS}?view=all`, LeadsPage);
    await screen.findByText('Kabir Mehta');
    const header = screen.getByTestId('leads-table-header');
    const user = userEvent.setup();
    await user.click(within(header).getByRole('button', { name: 'Updated' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'activity:desc' }),
    );
    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ sort: 'activity', order: 'desc' }),
    );
    expect(leadListQuery(lastListParams())).toMatchObject({
      sort: 'last_activity_at',
      order: 'desc',
    });
    await user.click(within(header).getByRole('button', { name: 'Updated' }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('sort'));

    await user.click(within(header).getByRole('button', { name: 'Lead' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'name:asc' }),
    );
    await user.click(within(header).getByRole('button', { name: 'Lead' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'name:desc' }),
    );
    await waitFor(() => expect(rowNames()).toEqual(['Kabir Mehta', 'Anaya Desai']));
  });

  it('has no accessibility violations', async () => {
    const { container } = renderLeadsRoutes(`${LEADS}?view=all`, LeadsPage);
    await screen.findByText('Kabir Mehta');
    expect(await axe(container)).toHaveNoViolations();
  });
});
