import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as ContactsApiModule from '@/shared/api/app/contacts-api.ts';
import type { ContactSummary } from '@/shared/api/app/contacts-contracts.ts';
import * as LeadsApiModule from '@/shared/api/app/leads-api.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { notify } from '@/shared/notify/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import {
  contactRecord,
  leadRecord,
  NIDHI,
  RIYA,
  TEAM,
} from '../../__tests__/integration/leads-test-data.ts';
import type { NewLeadPrefill } from './new-lead-form.ts';
import { NewLeadDrawer } from './NewLeadDrawer.tsx';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

vi.mock('@/shared/api/app/contacts-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof ContactsApiModule>()),
  searchContacts: vi.fn(),
  fetchContact: vi.fn(),
  fetchRecentContacts: vi.fn(),
}));
vi.mock('@/shared/api/app/leads-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof LeadsApiModule>()),
  createLead: vi.fn(),
}));

const { fetchContact, fetchRecentContacts, searchContacts } = ContactsApiModule;
const { createLead } = LeadsApiModule;

/** A person as the search answers: the contact row, no other numbers. */
function hit(overrides: Partial<ContactSummary>): ContactSummary {
  return contactRecord({ openLeadId: null, ...overrides });
}

/** Someone who already has an open lead. */
const WITH_OPEN_LEAD = hit({
  id: 'con_anaya0000000000000000',
  contactNumber: 10234,
  firstName: 'Anaya',
  lastName: 'Desai',
  name: 'Anaya Desai',
  primaryPhone: '+919879521034',
  openLeadId: 'lead_anaya0000000000000000',
});

/** Someone with a patient file and no open lead. */
const PATIENT = hit({
  id: 'con_anvi00000000000000000',
  contactNumber: 10871,
  firstName: 'Anvi',
  lastName: 'Galani',
  name: 'Anvi Galani',
  primaryPhone: '+918200603212',
  patientId: 'pat_anvi00000000000000000',
});

/** Someone only known as a contact. */
const CONTACT = hit({
  id: 'con_anjali000000000000000',
  contactNumber: 10412,
  firstName: 'Anjali',
  lastName: 'Shah',
  name: 'Anjali Shah',
  primaryPhone: '+919825011241',
  instagramHandles: ['@anjali'],
});

const callbacks = {
  onClose: vi.fn(),
  onCreated: vi.fn(),
  onOpenLead: vi.fn(),
};

beforeEach(() => {
  signInTestMember();
  for (const fn of Object.values(notify)) vi.mocked(fn).mockReset();
  for (const fn of Object.values(callbacks)) fn.mockReset();
  vi.mocked(searchContacts).mockReset();
  vi.mocked(fetchContact).mockReset();
  vi.mocked(fetchRecentContacts).mockReset();
  vi.mocked(fetchRecentContacts).mockResolvedValue([]);
  vi.mocked(searchContacts).mockImplementation(async (typed) =>
    [WITH_OPEN_LEAD, PATIENT, CONTACT].filter((person) =>
      person.name.toLowerCase().includes(typed.trim().toLowerCase()),
    ),
  );
  vi.mocked(createLead).mockReset();
  vi.mocked(createLead).mockImplementation(async ({ fields }) =>
    leadRecord({ id: 'lead_created00000000000000', leadNumber: 2371, ...fields }),
  );
});

async function openNewLead(prefill: NewLeadPrefill = {}) {
  const view = renderWithProviders(
    <TooltipProvider>
      <NewLeadDrawer prefill={prefill} members={TEAM} viewerId={RIYA.id} {...callbacks} />
    </TooltipProvider>,
  );
  const drawer = await screen.findByTestId('new-lead-drawer');
  return { ...view, drawer, user: userEvent.setup() };
}

const step = (id: string) => screen.getByTestId(`new-lead-drawer-step-${id}`);
const save = () => screen.getByTestId('new-lead-drawer-save');

/** Types into the search and waits for the read of everything typed. */
async function searchFor(user: ReturnType<typeof userEvent.setup>, typed: string) {
  const search = screen.getByTestId('new-lead-search');
  await user.type(search, typed);
  const query = (search as HTMLInputElement).value;
  await waitFor(() => expect(searchContacts).toHaveBeenCalledWith(query));
}

describe('NewLeadDrawer (KICKOFF §6.3)', () => {
  it('opens on the Contact step, the search focused, Lead details locked', async () => {
    const { drawer, user } = await openNewLead();

    expect(within(drawer).getByRole('heading', { name: 'New lead' })).toBeInTheDocument();
    expect(drawer).toHaveAccessibleDescription('Name and mobile are enough to start');
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Search existing patient or contact' }),
      ).toHaveFocus(),
    );
    expect(step('contact')).toHaveAttribute('data-state', 'open');
    expect(step('details')).toHaveTextContent('After contact');
    expect(step('details')).toHaveTextContent('Source, interest and who handles it');
    expect(screen.getByTestId('new-lead-drawer-summary')).toHaveTextContent(
      'Creates or updates one contact',
    );

    await user.click(screen.getByTestId('new-lead-drawer-step-details-trigger'));
    expect(notify.info).toHaveBeenCalledWith('Pick or add the contact first');
    expect(step('details')).toHaveAttribute('data-state', 'closed');
  });

  it('searches from three letters and lists each hit with its line and its action', async () => {
    vi.mocked(searchContacts).mockResolvedValue([WITH_OPEN_LEAD, PATIENT, CONTACT]);
    const { user } = await openNewLead();
    await user.type(screen.getByTestId('new-lead-search'), 'an');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(searchContacts).not.toHaveBeenCalled();
    expect(screen.queryByTestId('new-lead-no-match')).toBeNull();
    await searchFor(user, 'a');

    const open = await screen.findByTestId('new-lead-hit-10234');
    expect(withoutBidiMarks(open.textContent)).toContain(
      'Anaya DesaiOpen lead · C-10234 · +91 98795 21034Open lead',
    );
    const patient = screen.getByTestId('new-lead-hit-10871');
    expect(withoutBidiMarks(patient.textContent)).toContain(
      'Anvi GalaniPatient · C-10871 · +91 82006 03212Re-create lead',
    );
    expect(within(patient).getByText('Anvi Galani')).toHaveAttribute('dir', 'auto');
    expect(
      withoutBidiMarks(screen.getByTestId('new-lead-hit-10412').textContent),
    ).toContain('Anjali ShahC-10412 · +91 98250 11241Use contact');
  });

  it('"Open lead" goes to the person’s open lead, the form untouched', async () => {
    const { user } = await openNewLead();
    await searchFor(user, 'anaya');
    await user.click(await screen.findByTestId('new-lead-hit-10234'));

    expect(callbacks.onOpenLead).toHaveBeenCalledWith('lead_anaya0000000000000000');
    expect(step('contact')).toHaveAttribute('data-state', 'open');
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('re-creates a lead for a patient: the strip, Re-target, one step, then "Change"', async () => {
    const { user } = await openNewLead();
    await searchFor(user, 'anvi');
    await user.click(await screen.findByTestId('new-lead-hit-10871'));

    expect(notify.success).toHaveBeenCalledWith(
      'Existing patient C-10871 · new lead will be linked',
    );
    expect(screen.queryByTestId('new-lead-drawer-step-contact')).toBeNull();
    expect(step('details')).toHaveAttribute('data-state', 'open');
    expect(screen.getByRole('button', { name: 'Re-target' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Anvi Galani')).toBeInTheDocument();
    expect(screen.getByText('+91 82006 03212')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();

    await user.click(screen.getByTestId('new-lead-change'));
    expect(step('contact')).toHaveAttribute('data-state', 'open');
    expect(screen.queryByText('Anvi Galani')).toBeNull();
  });

  it('says so when nobody matches', async () => {
    const { user } = await openNewLead();
    await searchFor(user, 'zxq');
    expect(await screen.findByTestId('new-lead-no-match')).toHaveTextContent(
      'No existing match',
    );
  });

  it('applies a Quick start preset — the source, not the steps — and keeps it for a picked contact', async () => {
    const { user } = await openNewLead();

    await user.click(screen.getByTestId('new-lead-preset-walkIn'));
    expect(notify.success).toHaveBeenCalledWith('Walk-in preset applied');
    expect(screen.getByTestId('new-lead-preset-walkIn')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('new-lead-preset-instagramDm')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByTestId('new-lead-preset-phoneCall')).toBeNull();
    expect(step('contact')).toHaveAttribute('data-state', 'open');

    await user.click(screen.getByTestId('new-lead-preset-instagramDm'));
    expect(screen.getByTestId('new-lead-preset-walkIn')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await searchFor(user, 'anjali');
    await user.click(await screen.findByTestId('new-lead-hit-10412'));
    expect(notify.success).toHaveBeenLastCalledWith('Using existing contact Anjali Shah');
    expect(screen.getByRole('button', { name: 'Instagram' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(save());
    await waitFor(() => expect(createLead).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createLead).mock.lastCall?.[0].fields).toMatchObject({
      source: 'instagram',
      status: 'new',
    });
  });

  it('creates a lead for a picked person by their contact id, assigned to anyone', async () => {
    const { user } = await openNewLead();
    await searchFor(user, 'anjali');
    await user.click(await screen.findByTestId('new-lead-hit-10412'));

    await user.click(
      screen.getByRole('button', { name: 'Assigned and involved people' }),
    );
    const people = await screen.findByRole('dialog', { name: 'People on this lead' });
    await user.click(within(people).getByRole('button', { name: 'Assign' }));
    await user.keyboard('{Escape}');
    expect(callbacks.onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Peel' }));
    await user.click(save());

    await waitFor(() => expect(callbacks.onCreated).toHaveBeenCalled());
    expect(createLead).toHaveBeenCalledWith({
      person: { contactId: CONTACT.id },
      fields: {
        status: 'new',
        source: 'whatsapp',
        interests: ['peel'],
        ownerId: NIDHI.id,
        involvedIds: [],
        followUpAt: null,
        branchId: null,
        notes: null,
      },
      idempotencyKey: expect.any(String),
    });
    expect(callbacks.onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lead_created00000000000000', leadNumber: 2371 }),
    );
    expect(notify.success).toHaveBeenLastCalledWith('Lead #2371 created');
  });

  it('creates a lead for a new contact typed in the contact editor', async () => {
    const { user } = await openNewLead();

    await user.click(screen.getByTestId('new-lead-new-contact'));
    await user.click(screen.getByTestId('new-lead-contact-quick-add-more'));
    const editor = await screen.findByTestId('contact-editor');
    await user.type(within(editor).getByTestId('contact-editor-first-name'), 'Meera');
    await user.type(within(editor).getByTestId('contact-editor-last-name'), 'Joshi');
    await user.type(within(editor).getByTestId('contact-editor-mobile-1'), '9898012345');
    await user.click(within(editor).getByTestId('contact-editor-done'));
    await waitFor(() => expect(screen.queryByTestId('contact-editor')).toBeNull());

    expect(screen.getByText('Meera Joshi')).toBeInTheDocument();
    expect(screen.getByText('+91 98980 12345')).toBeInTheDocument();
    expect(step('details')).toHaveAttribute('data-state', 'open');
    await user.click(screen.getByRole('button', { name: 'Google' }));
    await user.click(save());

    await waitFor(() => expect(callbacks.onCreated).toHaveBeenCalled());
    expect(createLead).toHaveBeenCalledWith({
      person: {
        contact: {
          firstName: 'Meera',
          lastName: 'Joshi',
          phones: [{ phone: '+919898012345', isOnWhatsapp: true }],
          instagramHandles: [],
          defaultChannel: 'whatsapp',
          preferenceTags: [],
        },
      },
      fields: expect.objectContaining({
        source: 'google',
        status: 'new',
        ownerId: RIYA.id,
      }),
      idempotencyKey: expect.any(String),
    });
  });

  it('offers the Recent people before anything is typed, and picks one by ↵', async () => {
    vi.mocked(fetchRecentContacts).mockResolvedValue([CONTACT, PATIENT]);
    const { user } = await openNewLead();

    const recent = await screen.findByTestId('new-lead-contact-recent');
    expect(within(recent).getByText('Recent')).toBeInTheDocument();
    expect(within(recent).getByTestId('new-lead-hit-10412')).toHaveTextContent(
      'Use contact',
    );
    await waitFor(() => expect(screen.getByTestId('new-lead-search')).toHaveFocus());
    await user.keyboard('{Enter}');

    expect(notify.success).toHaveBeenCalledWith('Using existing contact Anjali Shah');
    expect(step('details')).toHaveAttribute('data-state', 'open');
  });

  it('moves through the hits with ↓ and picks with ↵, as a click would', async () => {
    vi.mocked(searchContacts).mockResolvedValue([WITH_OPEN_LEAD, PATIENT, CONTACT]);
    const { user } = await openNewLead();
    await searchFor(user, 'ani');
    await screen.findByTestId('new-lead-hit-10871');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(notify.success).toHaveBeenCalledWith(
      'Existing patient C-10871 · new lead will be linked',
    );
    expect(screen.getByRole('button', { name: 'Re-target' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('adds a person nobody matched in the quick add: ↵, the mobile, ↵ — then creates', async () => {
    const { user } = await openNewLead();
    await searchFor(user, 'Meera Joshi');
    await screen.findByTestId('new-lead-no-match');
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('new-lead-contact-quick-add-name')).toHaveValue(
      'Meera Joshi',
    );
    await waitFor(() =>
      expect(screen.getByTestId('new-lead-contact-quick-add-mobile')).toHaveFocus(),
    );
    await user.keyboard('{Enter}');
    expect(notify.warning).toHaveBeenLastCalledWith('Add a 10-digit mobile');

    await user.keyboard('9898012345{Enter}');
    expect(screen.queryByTestId('new-lead-drawer-step-contact')).toBeNull();
    expect(screen.getByText('Meera Joshi')).toBeInTheDocument();
    expect(screen.getByText('+91 98980 12345')).toBeInTheDocument();
    expect(step('details')).toHaveAttribute('data-state', 'open');

    await user.click(save());
    await waitFor(() => expect(callbacks.onCreated).toHaveBeenCalled());
    expect(vi.mocked(createLead).mock.lastCall?.[0].person).toEqual({
      contact: {
        firstName: 'Meera',
        lastName: 'Joshi',
        phones: [{ phone: '+919898012345', isOnWhatsapp: true }],
        instagramHandles: [],
        defaultChannel: 'whatsapp',
        preferenceTags: [],
      },
    });
  });

  it('"More details" opens the contact editor on the quick add’s values; cancelling commits nothing', async () => {
    const { user } = await openNewLead();
    await searchFor(user, 'Meera 9898012345');
    await user.click(await screen.findByTestId('new-lead-new-contact'));
    await user.click(screen.getByTestId('new-lead-contact-quick-add-more'));

    const editor = await screen.findByTestId('contact-editor');
    expect(within(editor).getByTestId('contact-editor-first-name')).toHaveValue('Meera');
    expect(within(editor).getByTestId('contact-editor-mobile-1')).toHaveValue(
      '98980 12345',
    );
    await user.click(within(editor).getByTestId('contact-editor-dismiss'));
    await waitFor(() => expect(screen.queryByTestId('contact-editor')).toBeNull());

    expect(step('contact')).toHaveAttribute('data-state', 'open');
    expect(screen.queryByText('Meera')).toBeNull();
  });

  it('starts from the prefill with the person known', async () => {
    await openNewLead({ name: 'Priya Shah', phone: '+919898011111' });

    expect(screen.queryByTestId('new-lead-drawer-step-contact')).toBeNull();
    expect(screen.getByText('Priya Shah')).toBeInTheDocument();
    expect(screen.getByText('+91 98980 11111')).toBeInTheDocument();
  });

  it('asks for a name and a 10-digit mobile before creating', async () => {
    const { user, unmount } = await openNewLead();
    await user.click(save());
    expect(notify.warning).toHaveBeenCalledWith('Add a name and a 10-digit mobile');
    unmount();

    await openNewLead({ name: 'Priya' });
    expect(screen.getByText('Priya')).toBeInTheDocument();
    await user.click(save());
    expect(notify.warning).toHaveBeenCalledTimes(2);
    expect(createLead).not.toHaveBeenCalled();
  });

  it('shows the server’s words when the person has an open lead meanwhile, with "Open" to it, and retries the same write', async () => {
    vi.mocked(fetchContact).mockResolvedValue(
      contactRecord({
        id: 'con_anjali00000000000000',
        openLeadId: 'lead_anjali0000000000000',
      }),
    );
    vi.mocked(createLead).mockRejectedValueOnce(
      new HttpError('Conflict', 409, '/app/leads', 'POST', {
        error: {
          reason: 'lead_open_exists',
          detail: 'Anjali Shah already has open lead #2364',
        },
      }),
    );
    const { user } = await openNewLead();
    await searchFor(user, 'anjali');
    await user.click(await screen.findByTestId('new-lead-hit-10412'));
    await user.click(save());

    // The search answered before their lead existed: the person is read again for its id.
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(
        'Anjali Shah already has open lead #2364',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Open' }) }),
      ),
    );
    const [, options] = vi.mocked(notify.error).mock.lastCall ?? [];
    options?.action?.onClick();
    expect(callbacks.onOpenLead).toHaveBeenCalledWith('lead_anjali0000000000000');
    expect(callbacks.onCreated).not.toHaveBeenCalled();
    expect(screen.getByTestId('new-lead-drawer-not-saved')).toBeInTheDocument();
    expect(save()).toHaveTextContent('Retry save');

    await user.click(save());
    await waitFor(() => expect(callbacks.onCreated).toHaveBeenCalled());
    const [first, second] = vi.mocked(createLead).mock.calls;
    expect(second?.[0].idempotencyKey).toBe(first?.[0].idempotencyKey);
  });

  it('shows the server’s words when a new number is someone else’s', async () => {
    vi.mocked(createLead).mockRejectedValueOnce(
      new HttpError('Conflict', 409, '/app/leads', 'POST', {
        error: {
          reason: 'contact_phone_exists',
          detail: '+91 98980 11111 is Priya Shah’s number',
        },
      }),
    );
    const { user } = await openNewLead({ name: 'Priya Shah', phone: '+919898011111' });
    await user.click(save());

    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('+91 98980 11111 is Priya Shah’s number'),
    );
    expect(callbacks.onOpenLead).not.toHaveBeenCalled();
  });

  it('closes from Cancel without asking', async () => {
    const { user } = await openNewLead({ name: 'Priya', phone: '+919898011111' });
    await user.click(screen.getByTestId('new-lead-drawer-dismiss'));
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { drawer } = await openNewLead();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });
});
