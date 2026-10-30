import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { appInstant } from '@/shared/api/app/app-time.ts';
import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';

import { leadRecord } from '../../__tests__/integration/leads-test-data.ts';
import { LeadNextStep, type LeadNextStepProps } from './LeadNextStep.tsx';

/** The card for `lead`, every action a member who edits and books has. */
function renderCard(lead: Partial<LeadRecord>, props: Partial<LeadNextStepProps> = {}) {
  const handlers = {
    onMove: vi.fn(),
    onAsk: vi.fn(),
    onBook: vi.fn(),
    onCompose: vi.fn(),
    onOpenPatient: vi.fn(),
  };
  // The picker's day field reads the clinic's calendar.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <LeadNextStep
        lead={leadRecord(lead)}
        canEdit
        asking={null}
        {...handlers}
        {...props}
      />
    </QueryClientProvider>,
  );
  const card = screen.getByRole('region', { name: 'Next step' });
  return { card, unmount: view.unmount, ...handlers };
}

/** The text of one part — Next, When or Outcome. */
const part = (card: HTMLElement, label: string) =>
  within(card).getByText(label).nextElementSibling as HTMLElement;

describe('LeadNextStep (D25)', () => {
  it('names the status itself, with a headline and the same three parts', () => {
    const { card } = renderCard({ status: 'follow_up' });
    expect(card).toHaveTextContent('Follow-up');
    expect(card).toHaveTextContent('Follow up with Anaya');
    for (const label of ['Next', 'When', 'Outcome'])
      expect(within(card).getByText(label)).toBeInTheDocument();
  });

  it('New: say hello — WhatsApp or a call, and no "No answer" before a first try', async () => {
    const user = userEvent.setup();
    const { card, onCompose } = renderCard({ status: 'new' });
    expect(card).toHaveTextContent('Say hello to Anaya');
    await user.click(within(card).getByRole('button', { name: 'Send WhatsApp' }));
    expect(onCompose).toHaveBeenLastCalledWith('whatsapp');
    await user.click(within(card).getByRole('button', { name: 'Log a call' }));
    expect(onCompose).toHaveBeenLastCalledWith('call');
    expect(within(card).queryByRole('button', { name: 'No answer' })).toBeNull();
    expect(part(card, 'Outcome')).toHaveTextContent(
      'No answer appears once they’re contacted',
    );
  });

  it('Follow-up: books, opens the time, and No answer tries again tomorrow at the same clock', async () => {
    const user = userEvent.setup();
    const followUpAt = appInstant('2026-10-03', '18:00');
    const { card, onBook, onAsk, onMove } = renderCard({
      status: 'follow_up',
      followUpAt,
    });
    await user.click(within(card).getByRole('button', { name: 'Book appointment' }));
    expect(onBook).toHaveBeenCalledOnce();
    await user.click(within(card).getByTestId('lead-drawer-next-step-when'));
    expect(onAsk).toHaveBeenLastCalledWith('follow_up');
    await user.click(within(card).getByRole('button', { name: 'No answer' }));
    expect(onMove).toHaveBeenLastCalledWith({
      status: 'no_response',
      followUpAt: expect.stringMatching(/T12:30:00\.000Z$/),
    });
  });

  it('sets the follow-up time from the picker', async () => {
    const user = userEvent.setup();
    const { onMove } = renderCard(
      { status: 'contacted', followUpAt: null },
      { asking: 'follow_up' },
    );
    const picker = await screen.findByTestId('lead-drawer-follow-up');
    await user.click(within(picker).getByTestId('lead-drawer-follow-up-pick-tomorrow'));
    await user.click(within(picker).getByTestId('lead-drawer-follow-up-set'));
    expect(onMove).toHaveBeenLastCalledWith({
      status: 'follow_up',
      followUpAt: expect.stringMatching(/T05:30:00\.000Z$/),
    });
  });

  it('closes with the status names: Not interested, and Invalid or Lost under More', async () => {
    const user = userEvent.setup();
    const { card, onMove } = renderCard({ status: 'follow_up' });
    await user.click(within(card).getByRole('button', { name: 'Not interested' }));
    expect(onMove).toHaveBeenLastCalledWith({ status: 'not_interested' });
    await user.click(within(card).getByRole('button', { name: /More/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Lost' }));
    expect(onMove).toHaveBeenLastCalledWith({ status: 'lost' });
  });

  it('No response: tries again — the next try, and "No answer again"', () => {
    const { card } = renderCard({
      status: 'no_response',
      followUpAt: appInstant('2026-10-04', '11:00'),
    });
    expect(card).toHaveTextContent('Try Anaya again');
    expect(part(card, 'When')).toHaveTextContent(/^Next try/);
    expect(
      within(card).getByRole('button', { name: 'No answer again' }),
    ).toBeInTheDocument();
  });

  it('Booked: the booking, moved or cancelled from here — no "No answer"', async () => {
    const user = userEvent.setup();
    const onReschedule = vi.fn();
    const onCancel = vi.fn();
    const { card } = renderCard(
      { status: 'appointment_scheduled' },
      {
        visit: {
          when: 'Tomorrow · 11:00 am',
          what: 'Consultation · Dr Mehta',
          onReschedule,
          onCancel,
        },
      },
    );
    expect(part(card, 'When')).toHaveTextContent(
      'Tomorrow · 11:00 am · Consultation · Dr Mehta',
    );
    await user.click(within(card).getByRole('button', { name: 'Reschedule' }));
    expect(onReschedule).toHaveBeenCalledOnce();
    await user.click(within(card).getByRole('button', { name: 'Cancel appointment' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(within(card).queryByRole('button', { name: 'No answer' })).toBeNull();
    expect(part(card, 'Outcome')).toHaveTextContent('Check-in moves them on');
  });

  it('Clinic visited: final — the patient file', async () => {
    const user = userEvent.setup();
    const { card, onOpenPatient } = renderCard({
      status: 'clinic_visited',
      patientId: 'pat_anaya0000000000000000',
      closedAt: appInstant('2026-10-01', '11:20'),
    });
    expect(card).toHaveTextContent('Anaya is a patient now');
    await user.click(within(card).getByRole('button', { name: 'Open patient file' }));
    expect(onOpenPatient).toHaveBeenCalledOnce();
    expect(part(card, 'Outcome')).toHaveTextContent('Final, set by the check-in');
  });

  it('Lost and Not interested come back by a check-in within 90 days; Invalid never', () => {
    const closedAt = appInstant('2026-10-03', '16:00');
    const lost = renderCard({ status: 'lost', closedAt });
    expect(lost.card).toHaveTextContent('Anaya went elsewhere');
    expect(part(lost.card, 'Outcome')).toHaveTextContent(
      /^Comes back if they check in by /,
    );
    expect(within(lost.card).getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    lost.unmount();
    const invalid = renderCard({ status: 'invalid', closedAt });
    expect(part(invalid.card, 'Outcome')).toHaveTextContent(
      'Never comes back on its own',
    );
  });

  it('only reads for a member who does not edit the lead', () => {
    const { card } = renderCard({ status: 'follow_up' }, { canEdit: false });
    expect(within(card).queryByRole('button', { name: 'Not interested' })).toBeNull();
    expect(within(card).queryByTestId('lead-drawer-next-step-when')).toBeNull();
  });
});
