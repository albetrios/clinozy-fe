import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { listLeads } from '@/shared/api/clinic/leads-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { renderLeadsRoutes } from '../../__tests__/integration/leads-test-router.tsx';
import { LeadsPage } from '../../LeadsPage.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    undo: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: notifyMock,
}));
const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));
vi.mock('@/shared/hooks/useClinicAccess/index.ts', () => ({
  useClinicAccess: () => ({
    roles: ['admin'],
    previewRole: null,
    can: () => true,
    canAbility: () => true,
    viewableSections: [],
    isResolved: true,
  }),
}));

const LEADS = '/organization/acme/leads';
const CREATE = `${LEADS}/create`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-09-27', '11:40')));
  viewport.tier = 'desktop';
  for (const mock of Object.values(notifyMock)) mock.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

async function openNewLead(search = '') {
  const view = renderLeadsRoutes(`${CREATE}${search}`, LeadsPage);
  const drawer = await screen.findByTestId('new-lead-drawer');
  return { ...view, drawer, user: userEvent.setup() };
}

const step = (id: string) => screen.getByTestId(`new-lead-drawer-step-${id}`);

describe('NewLeadDrawer (KICKOFF §6.3)', () => {
  it('opens on the Contact step, the search focused, Lead details locked', async () => {
    const { drawer, user } = await openNewLead();

    expect(within(drawer).getByRole('heading', { name: 'New lead' })).toHaveClass(
      'text-xl',
    );
    expect(drawer).toHaveAccessibleDescription('Name and mobile are enough to start');
    expect(drawer).toHaveClass('md:w-[min(640px,calc(100vw-56px))]');
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'Search existing patient or contact' }),
      ).toHaveFocus(),
    );
    expect(step('contact')).toHaveAttribute('data-state', 'open');
    expect(step('details')).toHaveTextContent('After contact');
    expect(step('details')).toHaveTextContent('Source, interest and who handles it');
    expect(screen.getByTestId('new-lead-drawer-summary')).toHaveTextContent(
      'Creates or updates one contact',
    );

    await user.click(screen.getByTestId('new-lead-drawer-step-details-trigger'));
    expect(notifyMock.info).toHaveBeenCalledWith('Pick or add the contact first');
    expect(step('details')).toHaveAttribute('data-state', 'closed');
  });

  it('applies a Quick start preset: values, not steps', async () => {
    const { user } = await openNewLead();

    await user.click(screen.getByTestId('new-lead-preset-walkIn'));
    expect(notifyMock.success).toHaveBeenCalledWith('Walk-in preset applied');
    expect(screen.getByTestId('new-lead-preset-walkIn')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('new-lead-preset-phoneCall')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(step('details')).toHaveAttribute('data-state', 'closed');
  });

  it('re-creates a lead for an existing patient: the strip, Re-target, one step', async () => {
    const { user } = await openNewLead();

    await user.type(screen.getByTestId('new-lead-search'), 'Dharti');
    const hit = await screen.findByTestId('new-lead-hit-patient-3508');
    expect(hit).toHaveTextContent('Re-create lead');
    await user.click(hit);

    expect(notifyMock.success).toHaveBeenCalledWith(
      'Existing patient #3508 · new lead will be linked',
    );
    expect(screen.queryByTestId('new-lead-drawer-step-contact')).toBeNull();
    expect(step('details')).toHaveAttribute('data-state', 'open');
    expect(screen.getByRole('button', { name: 'Re-target' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Dharti Galani')).toBeInTheDocument();

    // "Change" clears the contact and puts WhatsApp back: two steps again.
    await user.click(screen.getByTestId('new-lead-change'));
    expect(step('contact')).toHaveAttribute('data-state', 'open');
  });

  it('says so when nobody matches, from two characters', async () => {
    const { user } = await openNewLead();

    await user.type(screen.getByTestId('new-lead-search'), 'q');
    expect(screen.queryByTestId('new-lead-no-match')).toBeNull();
    await user.type(screen.getByTestId('new-lead-search'), 'zxq');
    expect(await screen.findByTestId('new-lead-no-match')).toHaveTextContent(
      'No existing match',
    );
  });

  it('asks for a name and a 10-digit mobile before creating', async () => {
    const { user } = await openNewLead();

    await user.click(screen.getByTestId('new-lead-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name and a 10-digit mobile');
  });

  it('creates a lead from a new contact: closes, picks the lead out in the list', async () => {
    const { user, router } = await openNewLead();

    await user.click(screen.getByTestId('new-lead-new-contact'));
    const editor = await screen.findByTestId('contact-editor');
    await user.type(within(editor).getByTestId('contact-editor-name'), 'Meera Joshi');
    await user.type(
      within(editor).getByRole('textbox', { name: 'Mobile 1' }),
      '9898012345',
    );
    await user.click(within(editor).getByTestId('contact-editor-done'));
    await waitFor(() => expect(screen.queryByTestId('contact-editor')).toBeNull());

    expect(screen.getByText('Meera Joshi')).toBeInTheDocument();
    expect(step('details')).toHaveAttribute('data-state', 'open');
    await user.click(screen.getByRole('button', { name: 'Instagram' }));
    await user.click(screen.getByTestId('new-lead-drawer-save'));

    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
    expect(router.state.location.search).not.toHaveProperty('name');
    const [created] = (await listLeads({ view: 'all' })).items;
    expect(created).toMatchObject({
      name: 'Meera Joshi',
      phone: '+919898012345',
      source: 'instagram',
      status: 'new',
    });
    expect(notifyMock.success).toHaveBeenCalledWith(`Lead #${created!.seq} created`);
  });

  it('starts from the contact card’s prefill with the person already known', async () => {
    await openNewLead('?name=Priya%20Shah&phone=9898011111');

    expect(screen.queryByTestId('new-lead-drawer-step-contact')).toBeNull();
    expect(screen.getByText('Priya Shah')).toBeInTheDocument();
    expect(screen.getByText('+91 98980 11111')).toBeInTheDocument();
  });

  it('points a mobile already on an open lead at that lead: "Open"', async () => {
    const { user, router } = await openNewLead('?name=Kabir&phone=9925044710');

    await user.click(screen.getByTestId('new-lead-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'This mobile is already on lead #2364',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Open' }) }),
      ),
    );
    expect(screen.getByTestId('new-lead-drawer-not-saved')).toBeInTheDocument();
    expect(screen.getByTestId('new-lead-drawer-save')).toHaveTextContent('Retry save');

    const [, options] = notifyMock.error.mock.lastCall ?? [];
    act(() => options.action.onClick());
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${LEADS}/${ref.lead(2364)}`),
    );
  });

  it('closes from Cancel without asking', async () => {
    const { user, router } = await openNewLead('?name=Priya&phone=9898011111');

    await user.click(screen.getByTestId('new-lead-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('puts the × inside the header on a phone', async () => {
    viewport.tier = 'phone';
    const { drawer } = await openNewLead();
    expect(within(drawer).getByTestId('new-lead-drawer-close')).toHaveClass('size-11');
  });

  it('has no accessibility violations', async () => {
    const { drawer } = await openNewLead();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });
});
