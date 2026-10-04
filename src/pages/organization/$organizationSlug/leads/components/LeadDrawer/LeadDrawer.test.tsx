import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchLead } from '@/shared/api/clinic/leads-api.ts';
import { APPOINTMENT_FORM_TEST_IDS } from '@/shared/forms/AppointmentForm/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import {
  LEAD_CHAT_WIDTH,
  useDevicePrefsStore,
} from '@/shared/store/useDevicePrefsStore/index.ts';

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

const ANAYA = ref.lead(2363);
const LEADS = '/organization/acme/leads';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-09-27', '11:40')));
  viewport.tier = 'desktop';
  for (const mock of Object.values(notifyMock)) mock.mockReset();
  useDevicePrefsStore.setState({ leadChatWidth: LEAD_CHAT_WIDTH.initial });
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

async function openAnaya(search = '') {
  const view = renderLeadsRoutes(`${LEADS}/${ANAYA}${search}`, LeadsPage);
  const drawer = await screen.findByTestId('lead-drawer');
  await within(drawer).findByRole('heading', { name: 'Edit lead' });
  return { ...view, drawer };
}

describe('LeadDrawer (KICKOFF §6.3)', () => {
  it('opens the details and the chat side by side, the title focused', async () => {
    const { drawer } = await openAnaya();
    expect(within(drawer).getByRole('heading', { name: 'Edit lead' })).toHaveFocus();
    expect(
      within(drawer).getByRole('button', { name: 'Copy lead ID #2363' }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole('region', { name: 'Lead details' }),
    ).toBeInTheDocument();
    expect(within(drawer).getByRole('region', { name: 'Progress' })).toBeInTheDocument();
    expect(within(drawer).getByRole('region', { name: 'Info' })).toBeInTheDocument();
    expect(within(drawer).getByTestId('lead-drawer-chat')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Save lead' })).toBeDisabled();
  });

  it('saves a status move with its side effects, and Undo takes them back', async () => {
    const user = userEvent.setup();
    const { drawer } = await openAnaya();
    await user.click(within(drawer).getByRole('button', { name: /Follow-up/ }));
    expect(within(drawer).getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Save lead' }));
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        'Anaya Desai → Follow-up · follow-up task for tomorrow',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
    expect((await fetchLead(ANAYA)).status).toBe('follow_up');
    const [, options] = notifyMock.undo.mock.lastCall ?? [];
    act(() => options.onUndo());
    await waitFor(async () => expect((await fetchLead(ANAYA)).status).toBe('new'));
  });

  it('discards the draft, and asks before closing over unsaved changes', async () => {
    const user = userEvent.setup();
    const { drawer, router } = await openAnaya();
    await user.click(within(drawer).getByRole('button', { name: 'Peel' }));
    await user.click(within(drawer).getByRole('button', { name: 'Discard' }));
    expect(within(drawer).getByRole('button', { name: 'Save lead' })).toBeDisabled();
    await user.click(within(drawer).getByRole('button', { name: 'Peel' }));
    await user.click(screen.getByRole('button', { name: 'Close lead' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
  });

  it('removes the lead with a reason, a label the schema lacks stored as Other', async () => {
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
    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
  });

  it('edits the person from the strip’s contact card: Done saves the lead', async () => {
    const user = userEvent.setup();
    const { drawer } = await openAnaya();
    // The strip's own trigger — the chat header carries a contact card too.
    const trigger = within(drawer)
      .getAllByRole('button', { name: /Anaya Desai/ })
      .find((button) => !button.closest('[data-testid="lead-drawer-chat"]'))!;
    await user.hover(trigger);
    await user.click(await screen.findByTestId('contact-card-edit'));

    const editor = await screen.findByTestId('contact-editor');
    expect(within(editor).getByTestId('contact-editor-id')).toHaveTextContent('#2363');
    expect(within(editor).getByTestId('contact-editor-band')).toHaveClass(
      'bg-tone-lav-tint',
    );
    await user.clear(within(editor).getByTestId('contact-editor-name'));
    await user.click(within(editor).getByTestId('contact-editor-done'));
    // A contact needs its name: the editor stays.
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name and a 10-digit mobile');
    await user.type(within(editor).getByTestId('contact-editor-name'), 'Anaya D. Desai');
    await user.click(within(editor).getByTestId('contact-editor-channel-call'));
    await user.click(within(editor).getByTestId('contact-editor-done'));

    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Contact updated · applies everywhere',
      ),
    );
    const saved = await fetchLead(ANAYA);
    expect(saved.name).toBe('Anaya D. Desai');
    expect(saved.contact?.defaultChannel).toBe('call');
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
    renderLeadsRoutes(`${LEADS}/${ANAYA}`, LeadsPage);
    const tabs = await screen.findByRole('tablist', { name: 'Lead panels' });
    expect(within(tabs).getByRole('tab', { name: 'Chat' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('lead-drawer-chat')).toBeInTheDocument();
    await userEvent.setup().click(within(tabs).getByRole('tab', { name: 'Details' }));
    expect(
      await screen.findByRole('region', { name: 'Lead details' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('lead-drawer-chat')).toBeNull();
  });

  it('books from the composer: the appointment form stacked over the lead, the URL kept', async () => {
    const user = userEvent.setup();
    const { drawer, router } = await openAnaya();
    await user.click(
      within(within(drawer).getByTestId('lead-drawer-chat')).getByRole('button', {
        name: 'Book an appointment',
      }),
    );
    const booking = await screen.findByTestId(APPOINTMENT_FORM_TEST_IDS.createDrawer);
    const form = await within(booking).findByTestId(APPOINTMENT_FORM_TEST_IDS.form);
    expect(within(form).getByTestId(APPOINTMENT_FORM_TEST_IDS.whoCard)).toHaveTextContent(
      'Anaya Desai',
    );
    expect(within(form).getByTestId(APPOINTMENT_FORM_TEST_IDS.details)).toHaveAttribute(
      'data-open',
      'false',
    );
    expect(router.state.location.pathname).toBe(`${LEADS}/${ANAYA}`);
    await user.click(
      within(booking).getByTestId(`${APPOINTMENT_FORM_TEST_IDS.createDrawer}-dismiss`),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId(APPOINTMENT_FORM_TEST_IDS.createDrawer),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('lead-drawer')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { drawer } = await openAnaya();
    expect(
      await axe(drawer, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
