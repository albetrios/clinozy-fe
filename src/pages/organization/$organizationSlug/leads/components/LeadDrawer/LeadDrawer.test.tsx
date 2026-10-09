import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as ContactActivitiesApiModule from '@/shared/api/clinic/contact-activities-api.ts';
import { fetchContactThread } from '@/shared/api/clinic/contact-activities-api.ts';
import type * as ContactsApiModule from '@/shared/api/clinic/contacts-api.ts';
import { fetchContact, updateContact } from '@/shared/api/clinic/contacts-api.ts';
import type * as DirectoryApiModule from '@/shared/api/clinic/directory-api.ts';
import type * as LeadsApiModule from '@/shared/api/clinic/leads-api.ts';
import {
  countOpenLeadTasks,
  deleteLead,
  restoreLead,
  updateLead,
} from '@/shared/api/clinic/leads-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import {
  LEAD_CHAT_WIDTH,
  useDevicePrefsStore,
} from '@/shared/store/useDevicePrefsStore/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import type * as MyMembershipModule from '@/shared/tenancy/my-membership.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import {
  contactRecord,
  type ContactsWorld,
  leadRecord,
  type LeadsWorld,
  NOW,
  seededLeadsWorld,
} from '../../__tests__/integration/leads-test-data.ts';
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
    canCode: () => true,
    viewableSections: [],
    isResolved: true,
  }),
}));

const world = vi.hoisted(() => ({}) as LeadsWorld);
const people = vi.hoisted(() => ({}) as ContactsWorld);
vi.mock('@/shared/api/clinic/leads-api.ts', async (importOriginal) => {
  const { leadsApiDouble } =
    await import('../../__tests__/integration/leads-test-data.ts');
  return { ...(await importOriginal<typeof LeadsApiModule>()), ...leadsApiDouble(world) };
});
vi.mock('@/shared/api/clinic/contacts-api.ts', async (importOriginal) => {
  const { contactsApiDouble } =
    await import('../../__tests__/integration/leads-test-data.ts');
  return {
    ...(await importOriginal<typeof ContactsApiModule>()),
    ...contactsApiDouble(people),
  };
});
vi.mock('@/shared/api/clinic/contact-activities-api.ts', async (importOriginal) => {
  const { contactActivitiesApiDouble } =
    await import('../../__tests__/integration/leads-test-data.ts');
  return {
    ...(await importOriginal<typeof ContactActivitiesApiModule>()),
    ...contactActivitiesApiDouble(),
  };
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
  findMyMembershipId: vi.fn(async () => world.viewerId),
}));

const ANAYA = leadRecord();
const LEADS = '/organization/acme/leads';

const initialHourCycle = useLocaleStore.getState().hourCycle;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  useLocaleStore.setState({ hourCycle: 'h12' });
  for (const mock of Object.values(notifyMock)) mock.mockReset();
  useDevicePrefsStore.setState({ leadChatWidth: LEAD_CHAT_WIDTH.initial });
  Object.assign(world, seededLeadsWorld());
  Object.assign(people, { contacts: [contactRecord()] });
  vi.resetAllMocks();
  signInTestMember();
});
afterEach(() => {
  vi.useRealTimers();
  useLocaleStore.setState({ hourCycle: initialHourCycle });
  useOrganizationStore.getState().clearOrganization();
});

async function openAnaya() {
  const view = renderLeadsRoutes(`${LEADS}/${ANAYA.id}?view=all`, LeadsPage);
  const drawer = await screen.findByTestId('lead-drawer');
  await within(drawer).findByRole('heading', { name: 'Edit lead' });
  return { ...view, drawer };
}

/** An Info cell's text, its label first. */
const infoCell = (drawer: HTMLElement, label: string) =>
  within(within(drawer).getByRole('region', { name: 'Info' }))
    .getByText(label)
    .closest('div');

describe('LeadDrawer (KICKOFF §6.3)', () => {
  it('opens the details and the chat side by side, the title focused', async () => {
    const { drawer } = await openAnaya();
    expect(within(drawer).getByRole('heading', { name: 'Edit lead' })).toHaveFocus();
    expect(
      within(drawer).getByRole('button', { name: 'Copy lead ID #2363' }),
    ).toBeInTheDocument();
    for (const name of ['Lead details', 'Progress', 'Info']) {
      expect(within(drawer).getByRole('region', { name })).toBeInTheDocument();
    }
    expect(within(drawer).getByTestId('lead-drawer-chat')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Save lead' })).toBeDisabled();
    // The person comes from their contact; the chat from their stream.
    expect(fetchContact).toHaveBeenCalledWith(ANAYA.contactId);
    await waitFor(() => expect(fetchContactThread).toHaveBeenCalledWith(ANAYA.contactId));
  });

  it('opens the chat on the lead’s divider: when it was created, and its source', async () => {
    const { drawer } = await openAnaya();
    const chat = within(drawer).getByTestId('lead-drawer-chat');
    expect(
      await within(chat).findByText(
        /^Lead created · Wed \W?10:00\sAM\W? · via WhatsApp$/i,
      ),
    ).toBeInTheDocument();
  });

  it('reads Info: created, the person’s last activity, the patient file and open tasks', async () => {
    const { drawer } = await openAnaya();
    expect(infoCell(drawer, 'Created')).toHaveTextContent(
      /^CreatedWed \W?10:00\sAM\W?$/i,
    );
    expect(infoCell(drawer, 'Last activity')).toHaveTextContent(
      /^Last activityYesterday \W?10:00\sAM\W?$/i,
    );
    expect(infoCell(drawer, 'Patient')).toHaveTextContent(/^PatientNot yet$/);
    await waitFor(() =>
      expect(infoCell(drawer, 'Open tasks')).toHaveTextContent(/^Open tasks1$/),
    );
    expect(countOpenLeadTasks).toHaveBeenCalledWith(ANAYA.id);
  });

  it('reads "None yet" before any activity, and "Linked" once a check-in opened a file', async () => {
    world.leads = [
      leadRecord({ lastActivityAt: null, patientId: 'pat_anaya0000000000000000' }),
    ];
    const { drawer } = await openAnaya();
    expect(infoCell(drawer, 'Last activity')).toHaveTextContent(
      /^Last activityNone yet$/,
    );
    expect(infoCell(drawer, 'Patient')).toHaveTextContent(/^PatientLinked$/);
  });

  it('saves a status move with the read’s `updated_at` — "<name> → <status>", no Undo', async () => {
    const user = userEvent.setup();
    const { drawer } = await openAnaya();
    const progress = within(drawer).getByRole('region', { name: 'Progress' });
    await user.click(within(progress).getByRole('button', { name: /Contacted/ }));
    expect(within(drawer).getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Save lead' }));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Anaya Desai → Contacted'),
    );
    expect(updateLead).toHaveBeenCalledExactlyOnceWith({
      leadId: ANAYA.id,
      fields: { status: 'contacted' },
      expectedUpdatedAt: ANAYA.updatedAt,
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.undo).not.toHaveBeenCalled();
    expect(world.leads[0]?.status).toBe('contacted');
    await waitFor(() =>
      expect(within(drawer).getByRole('button', { name: 'Save lead' })).toBeDisabled(),
    );
  });

  it('discards the draft, and asks before closing over unsaved changes', async () => {
    const user = userEvent.setup();
    const { drawer, router } = await openAnaya();
    await user.click(within(drawer).getByRole('button', { name: 'Peel' }));
    await user.click(within(drawer).getByRole('button', { name: 'Discard' }));
    expect(within(drawer).getByRole('button', { name: 'Save lead' })).toBeDisabled();
    await user.click(within(drawer).getByRole('button', { name: 'Peel' }));
    await user.click(screen.getByTestId('lead-drawer-close'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
    expect(router.state.location.search).toMatchObject({ view: 'all' });
    expect(updateLead).not.toHaveBeenCalled();
  });

  it('removes the lead with a reason — one the schema lacks stored as Other — and Undo restores it', async () => {
    const user = userEvent.setup();
    const { router } = await openAnaya();
    await user.click(screen.getByTestId('lead-drawer-remove'));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('radio', { name: 'Spam' }));
    await user.click(within(confirm).getByRole('button', { name: 'Remove lead' }));
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        'Lead #2363 removed · Spam',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
    expect(deleteLead).toHaveBeenCalledExactlyOnceWith({
      leadId: ANAYA.id,
      reason: 'other',
      note: 'Spam',
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
    expect(world.leads.map((lead) => lead.id)).not.toContain(ANAYA.id);

    const [, options] = notifyMock.undo.mock.lastCall ?? [];
    act(() => options.onUndo());
    await waitFor(() =>
      expect(restoreLead).toHaveBeenCalledWith(ANAYA.id, expect.any(String)),
    );
    await waitFor(() => expect(world.leads.map((lead) => lead.id)).toContain(ANAYA.id));
  });

  it('edits the person from the strip’s contact card, saving with the read’s `updated_at`', async () => {
    const user = userEvent.setup();
    const { drawer } = await openAnaya();
    // The strip's own trigger — the chat header carries a contact card too.
    const trigger = within(drawer)
      .getAllByRole('button', { name: /Anaya Desai/ })
      .find((button) => !button.closest('[data-testid="lead-drawer-chat"]'));
    if (!trigger) throw new Error('no contact strip');
    await user.hover(trigger);
    await user.click(await screen.findByTestId('contact-card-edit'));

    const editor = await screen.findByTestId('contact-editor');
    expect(within(editor).getByTestId('contact-editor-id')).toHaveTextContent('#2363');
    await user.clear(within(editor).getByTestId('contact-editor-first-name'));
    await user.click(within(editor).getByTestId('contact-editor-done'));
    // A contact needs its first name: the editor stays.
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name and a 10-digit mobile');
    expect(updateContact).not.toHaveBeenCalled();

    await user.type(within(editor).getByTestId('contact-editor-first-name'), 'Anya');
    await user.click(within(editor).getByTestId('contact-editor-done'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Contact updated · applies everywhere',
      ),
    );
    expect(updateContact).toHaveBeenCalledExactlyOnceWith({
      contactId: ANAYA.contactId,
      fields: expect.objectContaining({
        firstName: 'Anya',
        lastName: 'Desai',
        phones: [{ phone: '+919879521034', isOnWhatsapp: true }],
      }),
      expectedUpdatedAt: contactRecord().updatedAt,
      idempotencyKey: expect.any(String),
    });
    expect(people.contacts[0]?.name).toBe('Anya Desai');
  });

  it('resizes the chat with the arrow keys in the reading direction, double-click resets', async () => {
    await openAnaya();
    const handle = screen.getByRole('separator', { name: 'Resize panel' });
    expect(handle).toHaveAttribute('aria-valuenow', '420');
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(useDevicePrefsStore.getState().leadChatWidth).toBe(440);
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(useDevicePrefsStore.getState().leadChatWidth).toBe(400);
    fireEvent.doubleClick(handle);
    expect(useDevicePrefsStore.getState().leadChatWidth).toBe(420);
  });

  it('shows one pane at a time on a phone, Chat first', async () => {
    viewport.tier = 'phone';
    renderLeadsRoutes(`${LEADS}/${ANAYA.id}`, LeadsPage);
    const tabs = await screen.findByRole('tablist', { name: 'Lead panels' });
    expect(within(tabs).getByRole('tab', { name: 'Chat' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('lead-drawer-chat')).toBeInTheDocument();
    // No resize handle on a phone: the pane is the screen.
    expect(screen.queryByRole('separator', { name: 'Resize panel' })).toBeNull();
    await userEvent.setup().click(within(tabs).getByRole('tab', { name: 'Details' }));
    expect(
      await screen.findByRole('region', { name: 'Lead details' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('lead-drawer-chat')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { drawer } = await openAnaya();
    await within(drawer).findByText(/^Lead created/);
    expect(
      await axe(drawer, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
