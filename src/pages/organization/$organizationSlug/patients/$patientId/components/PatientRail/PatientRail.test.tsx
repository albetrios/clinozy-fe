import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { PatientRecord } from '@/shared/api/clinic/patients-contracts.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { patientFile, patientRecord } from '@/tests/utils/patient-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PatientRail, type PatientRailProps } from './PatientRail.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');

/** Priya's record with a second number on file, a patient since 24 Sep, 14:40 clinic time. */
const PRIYA: PatientRecord = patientRecord({
  createdAt: '2026-09-24T09:10:00.000Z',
  phones: [
    { phone: '+919876543210', isPrimary: true, isOnWhatsapp: true },
    { phone: '+919825099887', isPrimary: false, isOnWhatsapp: false },
  ],
});

/** Her file: Instagram, Gujarati, a check-in and a review. */
const FILE = patientFile({
  patient: PRIYA,
  instagram: 'priya.shah',
  language: 'gujarati',
  feedback: {
    feel: 'better',
    score: 7,
    review: { source: 'google', rating: 5 },
    checkIns: 2,
    reviews: 1,
  },
});

function renderRail(props: Partial<PatientRailProps> = {}) {
  return renderWithProviders(
    <TooltipProvider>
      <PatientRail file={FILE} actions={{}} className="flex" {...props} />
    </TooltipProvider>,
  );
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});

describe('PatientRail', () => {
  it('shows who they are: the name, the ID, how long a patient, type and status', async () => {
    const { container } = renderRail({ onEditContact: vi.fn() });
    const rail = await screen.findByTestId('patient-rail');
    expect(rail).toHaveAccessibleName('Priya Shah');
    expect(rail).toHaveTextContent('#3508');
    expect(rail).toHaveTextContent('9 days as patient');
    expect(rail).toHaveTextContent('Aesthetic');
    expect(rail).toHaveTextContent('New');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps the name, ID, numbers, date and address whole on a right-to-left page', async () => {
    document.documentElement.dir = 'rtl';
    try {
      renderRail();
      const rail = await screen.findByTestId('patient-rail');
      const name = within(rail).getByText('Priya Shah');
      expect(name).toHaveAttribute('dir', 'auto');
      expect(name).toHaveClass('[text-align:match-parent]');
      expect(screen.getByTestId('patient-rail-copy-id')).toHaveAttribute('dir', 'ltr');
      // The tenure's tooltip isolates its date inside the sentence.
      expect(within(rail).getByText('9 days as patient').getAttribute('title')).toMatch(
        /^Since \u2068[^\u2069]+2026\u2069$/,
      );
      // Every number and handle reads left to right, masked or not.
      const reach = screen.getByRole('region', { name: 'Reach' });
      for (const value of within(reach).getAllByText(/•••• \d{4}|priya\.shah/)) {
        expect(value).toHaveAttribute('dir', 'auto');
      }
      const about = screen.getByRole('region', { name: 'About' });
      expect(within(about).getByText('Gujarati')).toHaveAttribute('dir', 'auto');
      expect(within(about).getByText('Adajan, Surat')).toHaveAttribute('dir', 'auto');
      expect(rail).toHaveTextContent('Priya Shah#3508·9 days as patient');
    } finally {
      document.documentElement.dir = '';
    }
  });

  it('copies the patient ID and edits the contact', async () => {
    const user = userEvent.setup();
    const onEditContact = vi.fn();
    renderRail({ onEditContact });
    await user.click(await screen.findByTestId('patient-rail-copy-id'));
    expect(await navigator.clipboard.readText()).toBe('#3508');
    expect(notifyMock.success).toHaveBeenCalledWith('Patient ID copied');
    await user.click(screen.getByTestId('patient-rail-edit'));
    expect(onEditContact).toHaveBeenCalledOnce();
  });

  it('hides Edit contact without Patients edit', async () => {
    renderRail();
    await screen.findByTestId('patient-rail');
    expect(screen.queryByTestId('patient-rail-edit')).not.toBeInTheDocument();
  });

  it('reaches them on the primary number, their other numbers and Instagram — no lead number', async () => {
    renderRail();
    const reach = await screen.findByRole('region', { name: 'Reach' });
    expect(reach).toHaveTextContent('•••• 3210');
    expect(reach).toHaveTextContent('WhatsApp · Primary');
    expect(reach).toHaveTextContent('•••• 9887');
    expect(reach).toHaveTextContent('Mobile');
    expect(reach).not.toHaveTextContent('From lead');
    // The handle is not a number — never masked (a plan addition, Appendix F).
    expect(reach).toHaveTextContent('priya.shah');
    expect(reach).toHaveTextContent('Instagram');
  });

  it('lists the primary number alone for a person with one number and no Instagram', async () => {
    renderRail({ file: patientFile() });
    const reach = await screen.findByRole('region', { name: 'Reach' });
    expect(within(reach).getAllByRole('button', { name: 'Show number' })).toHaveLength(1);
    expect(reach).not.toHaveTextContent('Instagram');
  });

  it('masks each number until its own eye is pressed (Q-F4)', async () => {
    const user = userEvent.setup();
    renderRail();
    const reach = await screen.findByRole('region', { name: 'Reach' });
    const [primaryEye] = within(reach).getAllByRole('button', { name: 'Show number' });
    if (!primaryEye) throw new Error('no eye on the primary number');
    await user.click(primaryEye);
    expect(reach).not.toHaveTextContent('•••• 3210');
    // The other number stays masked.
    expect(reach).toHaveTextContent('•••• 9887');
    expect(within(reach).getByRole('button', { name: 'Hide number' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('tells about them: gender and age, the birthday soon, the language and address', async () => {
    renderRail();
    const about = await screen.findByRole('region', { name: 'About' });
    expect(about).toHaveTextContent('Female · 30 yrs');
    expect(about).toHaveTextContent('🎂 in 24 days');
    expect(about).toHaveTextContent('Gujarati');
    expect(about).toHaveTextContent('Adajan, Surat');
    expect(within(about).getByText('Data: consent given')).toBeInTheDocument();
  });

  it('names no language when the person asked for none, and says "No address"', async () => {
    renderRail({
      file: patientFile({
        language: null,
        patient: patientRecord({ address: null }),
      }),
    });
    const about = await screen.findByRole('region', { name: 'About' });
    expect(about).toHaveTextContent('No address');
    expect(about).not.toHaveTextContent(/Gujarati|Hindi|English/);
  });

  it('offers to book when no visit is coming, and to reschedule the next one', async () => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    const none = renderRail({ file: patientFile(), actions: { onBook } });
    expect(await screen.findByRole('region', { name: 'Up next' })).toHaveTextContent(
      'Not booked',
    );
    expect(screen.getByRole('region', { name: 'Up next' })).toHaveTextContent(
      'No upcoming visit',
    );
    await user.click(screen.getByTestId('patient-rail-book'));
    expect(onBook).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId('patient-rail-book')).toHaveTextContent('Book');
    none.unmount();

    const next = {
      appointmentId: 'appt_priya00000000000000000',
      date: '2026-10-03',
      startTime: '11:00',
      serviceLabel: 'Hydrafacial',
    };
    renderRail({ file: patientFile({ nextVisit: next }), actions: { onBook } });
    const upNext = await screen.findByRole('region', { name: 'Up next' });
    // The date tile names the day; the line beside it reads the time alone.
    expect(upNext).toHaveTextContent(/11:00\sAM/);
    expect(upNext).not.toHaveTextContent('Today');
    // The service alone — no length.
    expect(upNext).toHaveTextContent('Hydrafacial');
    expect(upNext).not.toHaveTextContent('min');
    await user.click(screen.getByTestId('patient-rail-book'));
    expect(screen.getByTestId('patient-rail-book')).toHaveTextContent('Reschedule');
    expect(onBook).toHaveBeenLastCalledWith(next);
  });

  it('hides Book without the appointment write', async () => {
    renderRail();
    await screen.findByRole('region', { name: 'Up next' });
    expect(screen.queryByTestId('patient-rail-book')).not.toBeInTheDocument();
  });

  it('keeps no dues, credit or Collect in Up next', async () => {
    renderRail();
    const upNext = await screen.findByRole('region', { name: 'Up next' });
    expect(screen.queryByTestId('patient-rail-due')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patient-rail-collect')).not.toBeInTheDocument();
    expect(upNext).not.toHaveTextContent(/All paid|to return|₹/);
  });

  it('sums up their feedback and opens it', async () => {
    const user = userEvent.setup();
    const onFeedback = vi.fn();
    renderRail({ actions: { onFeedback } });
    const feedback = await screen.findByTestId('patient-rail-feedback');
    expect(feedback).toHaveTextContent('Better · 7/10');
    expect(feedback).toHaveTextContent('2 check-ins · 1 review');
    await user.click(feedback);
    expect(onFeedback).toHaveBeenCalledOnce();
  });

  it('reads the latest review without a check-in, and "No feedback yet" with neither', async () => {
    const review = renderRail({
      file: patientFile({
        feedback: {
          feel: null,
          score: null,
          review: { source: 'google', rating: 5 },
          checkIns: 0,
          reviews: 1,
        },
      }),
    });
    expect(await screen.findByTestId('patient-rail-feedback')).toHaveTextContent(
      '5★ on Google',
    );
    review.unmount();

    renderRail({ file: patientFile() });
    const feedback = await screen.findByTestId('patient-rail-feedback');
    expect(feedback).toHaveTextContent('No feedback yet');
    expect(feedback).toHaveTextContent('0 check-ins · 0 reviews');
    // Nothing to open without the member's Feedback.
    expect(feedback).toBeDisabled();
  });

  it('keeps to identity for a member who reads billing alone (A-F14)', async () => {
    renderRail({ limited: true });
    await screen.findByTestId('patient-rail');
    expect(screen.queryByRole('region', { name: 'Reach' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'About' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Up next' })).not.toBeInTheDocument();
  });
});
