import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PatientReview } from '@/shared/api/app/feedback-contracts.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import type { ReceivedPayment } from './payment-received.ts';
import { PaymentReceived } from './PaymentReceived.tsx';

const state = vi.hoisted(() => ({
  codes: new Set<string>(),
  feedback: { isPending: false, isError: false, data: [] as unknown[] },
  branches: [] as { id: string; reviewLink: string | null }[],
  mutate: vi.fn(),
  queue: { isPending: false, isError: false },
}));

vi.mock('lottie-web/build/player/lottie_light', () => ({
  default: {
    loadAnimation: () => ({ totalFrames: 1, goToAndStop: vi.fn(), destroy: vi.fn() }),
  },
}));
vi.mock('@/shared/hooks/useAppAccess/index.ts', () => ({
  useAppAccess: () => ({
    isResolved: true,
    canCode: (code: string) => state.codes.has(code),
  }),
}));
vi.mock('@/shared/hooks/useFeedback/index.ts', () => ({
  usePatientFeedback: () => state.feedback,
}));
vi.mock('@/shared/hooks/useBranches/index.ts', () => ({
  useBranches: () => ({ openBranches: state.branches }),
}));
vi.mock('@/shared/hooks/useThread/index.ts', () => ({
  useQueueContactMessage: () => ({ mutate: state.mutate, ...state.queue }),
}));

const BRANCH = 'brn_adajan00000000000000';
const LINK = 'https://g.page/r/ojas/review';

function payment(patch: Partial<ReceivedPayment> = {}): ReceivedPayment {
  return {
    amount: 2000,
    modes: ['cash', 'upi'],
    payerName: 'Bhooshan Patel',
    paymentSeq: 5512,
    outcome: { kind: 'paid', invoiceSeq: 785 },
    patientId: 'pat_bhooshan000000000000',
    contactId: 'con_bhooshan000000000000',
    branchId: BRANCH,
    ...patch,
  };
}

let reviewCount = 0;

function review(patch: Partial<PatientReview> = {}): {
  kind: 'review';
  id: string;
  review: PatientReview;
} {
  reviewCount += 1;
  const value: PatientReview = {
    id: `rev_${String(reviewCount).padStart(21, '0')}`,
    patientId: 'pat_bhooshan000000000000',
    appointmentId: null,
    source: 'whatsapp',
    rating: 4,
    text: 'Lovely staff, quick visit.',
    link: null,
    fileKeys: [],
    date: '2026-10-03',
    needsAction: false,
    actions: [],
    createdAt: '2026-10-03T06:00:00.000Z',
    updatedAt: '2026-10-03T06:00:00.000Z',
    ...patch,
  };
  return { kind: 'review', id: value.id, review: value };
}

function show(value: ReceivedPayment = payment()) {
  return renderWithProviders(<PaymentReceived payment={value} />);
}

describe('PaymentReceived', () => {
  beforeEach(() => {
    state.codes = new Set([
      'patient:read',
      'patient_review:create',
      'contact_activity:create',
    ]);
    state.feedback = { isPending: false, isError: false, data: [] };
    state.branches = [{ id: BRANCH, reviewLink: LINK }];
    state.mutate.mockReset();
    state.queue = { isPending: false, isError: false };
    useOrganizationStore.setState({ organizationSlug: 'ojas' });
  });

  it('says what came in, from whom, how, and what it did — and focuses that line', async () => {
    show();
    const amount = await screen.findByTestId('payment-received-amount');
    expect(amount).toHaveTextContent('₹2,000 received');
    await waitFor(() => expect(amount).toHaveFocus());
    // Names arrive bidi-isolated: compare the words, not the isolate marks around them.
    expect(
      screen.getByText(
        (text) => text.startsWith('from') && text.includes('Bhooshan Patel'),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Cash + UPI · PAY-5512')).toBeInTheDocument();
    expect(screen.getByTestId('payment-received-outcome')).toHaveTextContent(
      'Invoice #785 paid in full',
    );
  });

  it('names a part payment, an advance and a credit got back', async () => {
    const { unmount } = show(
      payment({ outcome: { kind: 'due', invoiceSeq: 785, due: 1200 } }),
    );
    expect(await screen.findByTestId('payment-received-outcome')).toHaveTextContent(
      '₹1,200 still due on invoice #785',
    );
    unmount();
    const advance = show(payment({ outcome: { kind: 'advance' } }));
    expect(await screen.findByTestId('payment-received-outcome')).toHaveTextContent(
      'Kept as an advance',
    );
    advance.unmount();
    show(payment({ outcome: { kind: 'creditLeft', creditSeq: 2, left: 300 } }));
    expect(await screen.findByTestId('payment-received-outcome')).toHaveTextContent(
      '₹300 still owed on CR-2',
    );
  });

  it('asks a patient without a Google review, and queues the Review message with the link', async () => {
    const user = userEvent.setup();
    state.feedback.data = [review({ source: 'whatsapp', rating: 4 })];
    show();
    const ask = await screen.findByTestId('payment-received-ask');
    expect(ask.textContent).toContain('Bhooshan');
    expect(ask.textContent).toContain('for a Google review');
    await user.click(within(ask).getByTestId('payment-received-send'));
    expect(state.mutate).toHaveBeenCalledTimes(1);
    const [vars] = state.mutate.mock.calls[0] as [{ channel: string; body: string }];
    expect(vars.channel).toBe('whatsapp');
    expect(vars.body).toContain(LINK);
    expect(vars.body).toContain('Bhooshan');
    expect(within(ask).getByTestId('payment-received-log')).toHaveAttribute(
      'href',
      expect.stringContaining('/patients/pat_bhooshan000000000000/reviews/create'),
    );
  });

  it('reads "Queued in …’s chat" once the message is in the outbox', async () => {
    const user = userEvent.setup();
    state.mutate.mockImplementation((_vars, options: { onSuccess: () => void }) =>
      options.onSuccess(),
    );
    show();
    const send = await screen.findByTestId('payment-received-send');
    await user.click(send);
    expect(send.textContent).toContain('Queued in');
    expect(send.textContent).toContain('’s chat');
    expect(send).toBeDisabled();
  });

  it('turns Send off without a branch link, with a way to add it for those who can', async () => {
    state.branches = [{ id: BRANCH, reviewLink: null }];
    state.codes.add('branch:update');
    const { unmount } = show();
    expect(await screen.findByTestId('payment-received-send')).toBeDisabled();
    expect(screen.getByTestId('payment-received-add-link')).toHaveAttribute(
      'href',
      expect.stringContaining(`/branches/${BRANCH}/edit`),
    );
    unmount();
    state.codes.delete('branch:update');
    show();
    expect(await screen.findByText(/Ask an admin to add it/)).toBeInTheDocument();
    expect(screen.queryByTestId('payment-received-add-link')).not.toBeInTheDocument();
  });

  it('thanks a patient who reviewed on Google instead of asking', async () => {
    state.feedback.data = [review({ source: 'google', rating: 5 })];
    show();
    // The day in the member's date format ("3 Oct", "Oct 3").
    expect(await screen.findByTestId('payment-received-thanked')).toHaveTextContent(
      /^Reviewed on Google · 5★ · (3 Oct|Oct 3)$/,
    );
    expect(screen.queryByTestId('payment-received-ask')).not.toBeInTheDocument();
  });

  it('lists the three newest reviews and links to all of them past three', async () => {
    state.feedback.data = [
      review({ source: 'google', rating: 5 }),
      review({ source: 'whatsapp', rating: 3, needsAction: true }),
      review({ source: 'instagram', rating: null }),
      review({ source: 'video', rating: 4 }),
    ];
    show();
    expect(await screen.findAllByTestId('payment-received-review')).toHaveLength(3);
    expect(screen.getByText('Needs a call')).toBeInTheDocument();
    expect(screen.getByTestId('payment-received-all-reviews')).toHaveTextContent(
      'All reviews (4)',
    );
  });

  it('shows no review part for a payer without a patient file, or a member who cannot read patients', async () => {
    const { unmount } = show(payment({ patientId: null }));
    await screen.findByTestId('payment-received-amount');
    expect(screen.queryByTestId('payment-received-reviews')).not.toBeInTheDocument();
    unmount();
    state.codes.delete('patient:read');
    show();
    await screen.findByTestId('payment-received-amount');
    expect(screen.queryByTestId('payment-received-reviews')).not.toBeInTheDocument();
  });

  it('offers only what the member may do', async () => {
    state.codes.delete('contact_activity:create');
    state.codes.delete('patient_review:create');
    show();
    const ask = await screen.findByTestId('payment-received-ask');
    expect(within(ask).queryByTestId('payment-received-send')).not.toBeInTheDocument();
    expect(within(ask).queryByTestId('payment-received-log')).not.toBeInTheDocument();
  });
});
