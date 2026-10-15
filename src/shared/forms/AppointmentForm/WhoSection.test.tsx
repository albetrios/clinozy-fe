import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  contactHit,
  DOCTOR_NISHA,
  TEST_BRANCH_ID,
} from '@/tests/utils/appointment-doubles.ts';
import { withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

const { notifyMock, searchContactsMock, fetchRecentContactsMock, fetchLeadMock } =
  vi.hoisted(() => ({
    notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
    searchContactsMock: vi.fn(),
    fetchRecentContactsMock: vi.fn(),
    fetchLeadMock: vi.fn(),
  }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/contacts-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  searchContacts: searchContactsMock,
  fetchRecentContacts: fetchRecentContactsMock,
}));
vi.mock('@/shared/api/app/leads-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchLead: fetchLeadMock,
}));
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(async () => [DOCTOR_NISHA]),
}));

import { APPOINTMENT_FORM_TEST_IDS as IDS } from './appointment-form.constants.ts';
import {
  type AppointmentDraft,
  emptyDraft,
  type WhoDraft,
  whoOfContact,
} from './appointment-form-model.ts';
import { WhoSection, type WhoSectionProps } from './WhoSection.tsx';

/** Riya with a patient file and no open lead — the person-card tests' person. */
const RIYA_PATIENT: WhoDraft = whoOfContact(
  contactHit({ patientId: 'pat_riya00000000000000000', openLeadId: null }),
);

/** Riya's open lead: #2371, Contacted, from WhatsApp, Nisha's. */
const RIYA_LEAD: LeadRecord = {
  id: 'lead_riya00000000000000000',
  leadNumber: 2371,
  contactId: 'con_riya00000000000000000',
  person: null,
  name: 'Riya Mehta',
  phone: '+919825011241',
  patientId: null,
  status: 'contacted',
  source: 'whatsapp',
  interests: ['clinical'],
  kind: 'enquiry',
  retargetReason: null,
  ownerId: DOCTOR_NISHA.id,
  involvedIds: [],
  heldUntil: null,
  followUpAt: null,
  branchId: TEST_BRANCH_ID,
  notes: null,
  lastActivityAt: null,
  isAwaitingReply: false,
  createdAt: '2026-09-30T10:00:00.000Z',
  updatedAt: '2026-09-30T10:00:00.000Z',
};

const draftOf = (patch: Partial<AppointmentDraft> = {}): AppointmentDraft => ({
  ...emptyDraft('2026-10-05'),
  who: RIYA_PATIENT,
  ...patch,
});

function renderWho(props: Partial<WhoSectionProps> = {}) {
  const onChange = vi.fn();
  const onOpenLead = vi.fn();
  const onSaveContact = vi.fn(async () => undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui: ReactElement = (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <div className="@container">
          <WhoSection
            draft={draftOf()}
            onChange={onChange}
            canChange
            disabled={false}
            onOpenLead={onOpenLead}
            onSaveContact={onSaveContact}
            {...props}
          />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
  const view = render(ui);
  return { ...view, onChange, onOpenLead, onSaveContact };
}

/** Hover the person's card and press one of its actions. */
async function cardAction(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.hover(screen.getByRole('button', { name: /Riya Mehta/ }));
  const card = await screen.findByRole('dialog', { name: 'Contact' });
  await user.click(within(card).getByRole('button', { name }));
}

beforeEach(() => {
  signInTestMember();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  searchContactsMock.mockReset();
  searchContactsMock.mockResolvedValue([]);
  fetchRecentContactsMock.mockReset();
  fetchRecentContactsMock.mockResolvedValue([]);
  fetchLeadMock.mockReset();
  fetchLeadMock.mockResolvedValue(RIYA_LEAD);
});

describe('WhoSection — the person search (H:2749–2753)', () => {
  it('searches the contacts from three letters — five hits, a patient says so', async () => {
    const user = userEvent.setup();
    searchContactsMock.mockResolvedValue([
      contactHit(),
      contactHit({
        id: 'con_riyan0000000000000000',
        name: 'Riyan Shah',
        primaryPhone: '+919825044120',
        patientId: 'pat_riyan0000000000000000',
        openLeadId: null,
      }),
    ]);
    const { container } = renderWho({ draft: draftOf({ who: null }) });
    const search = screen.getByTestId(IDS.whoSearch);
    expect(search).toHaveAccessibleName('Search person');
    await user.type(search, 'ri');
    expect(withoutBidiMarks(screen.getByTestId(IDS.whoCreate).textContent)).toBe(
      'New contact ri↵',
    );
    expect(screen.getByTestId('appointment-form-who-hint')).toHaveTextContent(
      'Keep typing — 3 letters or 4 digits',
    );
    expect(searchContactsMock).not.toHaveBeenCalled();
    await user.type(search, 'y');
    const hits = await screen.findAllByTestId(IDS.whoHit);
    expect(searchContactsMock).toHaveBeenCalledWith('riy', 'everyone');
    expect(hits).toHaveLength(2);
    expect(hits[0]).toHaveTextContent('Riya Mehta+91 98250 11241');
    expect(hits[0]).not.toHaveTextContent('Use contact');
    // A patient's hit says so (its avatar carries the "P"), not their number.
    expect(hits[1]).toHaveTextContent('Riyan ShahPatient');
    expect(hits[1]).not.toHaveTextContent('+91');
    // The section sits inside the drawer's dialog in the app: no page landmarks here.
    expect(
      await axe(container, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });

  it('shows at most five hits', async () => {
    const user = userEvent.setup();
    searchContactsMock.mockResolvedValue(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((letter) =>
        contactHit({ id: `con_riya${letter}0000000000000000`, name: `Riya ${letter}` }),
      ),
    );
    renderWho({ draft: draftOf({ who: null }) });
    await user.type(screen.getByTestId(IDS.whoSearch), 'riya');
    expect(await screen.findAllByTestId(IDS.whoHit)).toHaveLength(5);
  });

  it('picks a hit as the person — a lead while they have an open one', async () => {
    const user = userEvent.setup();
    searchContactsMock.mockResolvedValue([contactHit()]);
    const { onChange } = renderWho({ draft: draftOf({ who: null }) });
    await user.type(screen.getByTestId(IDS.whoSearch), 'Riya');
    await user.click(await screen.findByTestId(IDS.whoHit));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      kind: 'who',
      who: whoOfContact(contactHit()),
    });
    expect(screen.getByTestId(IDS.whoSearch)).toHaveValue('');
  });

  it('creates a contact the search did not find, named as typed', async () => {
    const user = userEvent.setup();
    const { onChange } = renderWho({ draft: draftOf({ who: null }) });
    await user.type(screen.getByTestId(IDS.whoSearch), '  Meera Iyer ');
    await user.click(screen.getByTestId(IDS.whoCreate));
    expect(screen.getByTestId('appointment-form-who-quick-add-name')).toHaveValue(
      'Meera Iyer',
    );
    expect(screen.queryByTestId('appointment-form-who-quick-add-more')).toBeNull();
    await user.click(screen.getByTestId('appointment-form-who-quick-add-submit'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      kind: 'who',
      who: {
        kind: 'new',
        contactId: null,
        name: 'Meera Iyer',
        phone: null,
        patientId: null,
        leadId: null,
        contactNumber: null,
      },
    });
  });

  it('takes the new person’s mobile in the same step — a typed number fills it', async () => {
    const user = userEvent.setup();
    const { onChange } = renderWho({ draft: draftOf({ who: null }) });
    await user.type(screen.getByTestId(IDS.whoSearch), 'Meera 98250 11299');
    await screen.findByTestId(IDS.whoNoMatch);
    await user.keyboard('{Enter}');
    await user.click(screen.getByTestId('appointment-form-who-quick-add-submit'));
    expect(onChange).toHaveBeenNthCalledWith(1, {
      kind: 'who',
      who: expect.objectContaining({ kind: 'new', name: 'Meera' }),
    });
    expect(onChange).toHaveBeenNthCalledWith(2, {
      kind: 'newPhone',
      digits: '9825011299',
    });
  });

  it('offers the Recent people before anything is typed', async () => {
    fetchRecentContactsMock.mockResolvedValue([contactHit()]);
    const user = userEvent.setup();
    const { onChange } = renderWho({ draft: draftOf({ who: null }) });
    const recent = await screen.findByTestId('appointment-form-who-recent');
    expect(within(recent).getByTestId(IDS.whoHit)).toHaveTextContent('Riya Mehta');
    await user.click(within(recent).getByTestId(IDS.whoHit));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      kind: 'who',
      who: whoOfContact(contactHit()),
    });
  });
});

describe('WhoSection — the person (H:2748–2755)', () => {
  it('edits the name and mobile inline, checking both before it saves', async () => {
    const user = userEvent.setup();
    const { onSaveContact } = renderWho();
    await cardAction(user, 'Edit contact');
    const editor = screen.getByTestId(IDS.whoEdit);
    const name = within(editor).getByTestId(IDS.whoEditName);
    const mobile = within(editor).getByTestId(IDS.whoEditMobile);
    expect(name).toHaveValue('Riya Mehta');
    expect(mobile).toHaveValue('98250 11241');

    await user.clear(name);
    await user.click(within(editor).getByTestId(IDS.whoEditSave));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name');

    await user.type(name, 'Riya Patel');
    await user.clear(mobile);
    await user.type(mobile, '98765');
    await user.click(within(editor).getByTestId(IDS.whoEditSave));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Mobile needs 10 digits');
    expect(onSaveContact).not.toHaveBeenCalled();

    await user.type(mobile, '00001');
    await user.click(within(editor).getByTestId(IDS.whoEditSave));
    expect(onSaveContact).toHaveBeenCalledExactlyOnceWith(RIYA_PATIENT, {
      name: 'Riya Patel',
      phone: '9876500001',
    });
    expect(screen.queryByTestId(IDS.whoEdit)).not.toBeInTheDocument();
  });

  it('keeps the name and the mobile whole on a right-to-left page, in order', () => {
    const { container } = renderWho();
    const name = screen.getByText('Riya Mehta');
    expect(name).toHaveAttribute('dir', 'auto');
    expect(name).toHaveClass('[text-align:match-parent]');
    expect(screen.getByText('+91 98250 11241')).toHaveAttribute('dir', 'ltr');
    expect(container).toHaveTextContent('Riya Mehta+91 98250 11241');
  });

  it('closes the editor on Esc without saving', async () => {
    const user = userEvent.setup();
    const { onSaveContact } = renderWho();
    await cardAction(user, 'Edit contact');
    await user.type(screen.getByTestId(IDS.whoEditName), '{Escape}');
    expect(screen.queryByTestId(IDS.whoEdit)).not.toBeInTheDocument();
    expect(onSaveContact).not.toHaveBeenCalled();
  });

  it('changes the person in New — "Change contact" goes back to the search', async () => {
    const user = userEvent.setup();
    const { onChange } = renderWho();
    await cardAction(user, 'Change contact');
    expect(onChange).toHaveBeenCalledWith({ kind: 'who', who: null });
  });

  it('takes a new contact’s mobile under the card', async () => {
    const user = userEvent.setup();
    const { onChange } = renderWho({
      draft: draftOf({
        who: {
          kind: 'new',
          contactId: null,
          name: 'Meera Iyer',
          phone: null,
          patientId: null,
          leadId: null,
          contactNumber: null,
        },
      }),
    });
    expect(screen.getByTestId(IDS.whoCard)).toHaveTextContent(
      'New contact · add their mobile to book',
    );
    await user.type(screen.getByTestId(IDS.whoMobile), '9');
    expect(onChange).toHaveBeenCalledWith({ kind: 'newPhone', digits: '9' });
  });
});

describe('WhoSection — the connected lead (H:2754, H:4139)', () => {
  it('shows the person’s open lead as one chip that opens it, and the move at check-in', async () => {
    const user = userEvent.setup();
    const { onOpenLead } = renderWho({
      draft: draftOf({ who: whoOfContact(contactHit()) }),
    });
    const chip = await screen.findByTestId(IDS.connectedLead);
    expect(fetchLeadMock).toHaveBeenCalledWith('lead_riya00000000000000000');
    expect(screen.getAllByTestId(IDS.connectedLead)).toHaveLength(1);
    expect(chip).toHaveTextContent('#2371 · Contacted');
    expect(screen.getByText('Connected lead')).toBeVisible();
    expect(screen.getByText('· moves to Clinic visited at check-in')).toBeVisible();
    // No "Lead" radios: the server links the one open lead.
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    await user.click(chip);
    expect(onOpenLead).toHaveBeenCalledExactlyOnceWith('lead_riya00000000000000000');
  });

  it('names the lead’s source and owner on hover', async () => {
    const user = userEvent.setup();
    renderWho({ draft: draftOf({ who: whoOfContact(contactHit()) }) });
    await user.hover(await screen.findByTestId(IDS.connectedLead));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Lead #2371 · WhatsApp · owner Nisha Shah',
    );
  });

  it('drops the move at check-in once the visit is checked in', async () => {
    renderWho({
      draft: draftOf({ who: whoOfContact(contactHit()), status: 'checked_in' }),
    });
    expect(await screen.findByTestId(IDS.connectedLead)).toBeVisible();
    expect(
      screen.queryByText('· moves to Clinic visited at check-in'),
    ).not.toBeInTheDocument();
  });

  it('shows no lead for a person without an open one', () => {
    renderWho();
    expect(screen.queryByTestId(IDS.connectedLead)).not.toBeInTheDocument();
    expect(screen.queryByText('Connected lead')).not.toBeInTheDocument();
    expect(fetchLeadMock).not.toHaveBeenCalled();
  });
});
