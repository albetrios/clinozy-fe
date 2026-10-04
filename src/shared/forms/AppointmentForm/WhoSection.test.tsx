import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { AppointmentConnectedLead } from '@/shared/api/clinic/appointments-contracts.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

import { APPOINTMENT_FORM_TEST_IDS as IDS } from './appointment-form.constants.ts';
import {
  type AppointmentDraft,
  emptyDraft,
  type WhoDraft,
} from './appointment-form-model.ts';
import { WhoSection, type WhoSectionProps } from './WhoSection.tsx';

const PRIYA: WhoDraft = {
  kind: 'patient',
  name: 'Priya Shah',
  phone: '+919876543210',
  patientId: 'patient-1',
  leadId: null,
  seq: 3508,
};

const lead = (
  overrides: Partial<AppointmentConnectedLead>,
): AppointmentConnectedLead => ({
  id: 'lead-1',
  seq: 2401,
  status: 'new',
  kind: 'enquiry',
  source: 'instagram',
  interests: ['LHR'],
  ownerName: 'Reenal Shah',
  patientId: null,
  createdAt: '2026-09-30T10:00:00.000Z',
  ...overrides,
});

const draftOf = (patch: Partial<AppointmentDraft> = {}): AppointmentDraft => ({
  ...emptyDraft('2026-10-05'),
  who: PRIYA,
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
            leads={[]}
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
  await user.hover(screen.getByRole('button', { name: /Priya Shah/ }));
  const card = await screen.findByRole('dialog', { name: 'Contact' });
  await user.click(within(card).getByRole('button', { name }));
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});

describe('WhoSection — the person (H:2748–2755)', () => {
  it('edits the name and mobile inline, checking both before it saves', async () => {
    const user = userEvent.setup();
    const { onSaveContact } = renderWho();
    await cardAction(user, 'Edit contact');
    const editor = screen.getByTestId(IDS.whoEdit);
    const name = within(editor).getByTestId(IDS.whoEditName);
    const mobile = within(editor).getByTestId(IDS.whoEditMobile);
    expect(name).toHaveValue('Priya Shah');
    expect(mobile).toHaveValue('98765 43210');

    await user.clear(name);
    await user.click(within(editor).getByTestId(IDS.whoEditSave));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name');

    await user.type(name, 'Priya Patel');
    await user.clear(mobile);
    await user.type(mobile, '98765');
    await user.click(within(editor).getByTestId(IDS.whoEditSave));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Mobile needs 10 digits');
    expect(onSaveContact).not.toHaveBeenCalled();

    await user.type(mobile, '00001');
    await user.click(within(editor).getByTestId(IDS.whoEditSave));
    expect(onSaveContact).toHaveBeenCalledExactlyOnceWith(PRIYA, {
      name: 'Priya Patel',
      phone: '9876500001',
    });
    expect(screen.queryByTestId(IDS.whoEdit)).not.toBeInTheDocument();
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
        who: { ...PRIYA, kind: 'new', patientId: null, phone: null, seq: null },
      }),
    });
    expect(screen.getByTestId(IDS.whoCard)).toHaveTextContent(
      'New contact · add mobile at check-in',
    );
    await user.type(screen.getByTestId(IDS.whoMobile), '9');
    expect(onChange).toHaveBeenCalledWith({ kind: 'newPhone', digits: '9' });
  });
});

describe('WhoSection — connected leads (S:330, H:4139, H:5996)', () => {
  it('shows each lead as a chip that opens it, and the move at check-in', async () => {
    const user = userEvent.setup();
    const { onOpenLead } = renderWho({
      leads: [
        lead({ id: 'a', seq: 2365 }),
        lead({ id: 'b', seq: 2210, status: 'clinic_visited' }),
      ],
    });
    const chips = screen.getAllByTestId(IDS.connectedLead);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      '#2365 · New',
      '#2210 · Clinic visited',
    ]);
    expect(screen.getByText('· moves to Clinic visited at check-in')).toBeInTheDocument();
    await user.click(chips[0]!);
    expect(onOpenLead).toHaveBeenCalledWith('a');
    expect(screen.queryByRole('radiogroup', { name: 'Lead' })).not.toBeInTheDocument();
  });

  it('offers the "Lead" radios when two or more are open, the first picked', async () => {
    const user = userEvent.setup();
    const { onChange, container } = renderWho({
      leads: [
        lead({ id: 'a', seq: 2365 }),
        lead({ id: 'b', seq: 2366, source: null, interests: [] }),
      ],
    });
    const radios = within(screen.getByRole('radiogroup', { name: 'Lead' })).getAllByRole(
      'radio',
    );
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
    ]);
    expect(radios[0]).toHaveTextContent('Lead #2365');
    expect(radios[0]).toHaveTextContent('Instagram · LHR');
    await user.click(radios[1]!);
    expect(onChange).toHaveBeenCalledWith({ kind: 'lead', leadId: 'b' });
    // The section sits inside the drawer's dialog in the app: no page landmarks here.
    expect(
      await axe(container, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
