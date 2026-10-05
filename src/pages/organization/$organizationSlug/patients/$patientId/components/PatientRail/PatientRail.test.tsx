import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchPatientFile } from '@/shared/api/clinic/patient-file-api.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PatientRail, type PatientRailProps } from './PatientRail.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');
let file: PatientFile;

function renderRail(props: Partial<PatientRailProps> = {}) {
  const handlers = { onToggleMasked: vi.fn() };
  const view = renderWithProviders(
    <TooltipProvider>
      <PatientRail
        file={file}
        masked
        actions={{}}
        className="flex"
        {...handlers}
        {...props}
      />
    </TooltipProvider>,
  );
  return { ...view, ...handlers };
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
  file = await fetchPatientFile(patientRef('Dharti Galani'));
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});

describe('PatientRail', () => {
  it('shows who they are: the name, the ID, how long a patient, type and status', async () => {
    // A patient since 24 Sep, 14:40 clinic time.
    const since = { ...file.patient, createdAt: '2026-09-24T09:10:00.000Z' };
    const { container } = renderRail({
      file: { ...file, patient: since },
      onEditContact: vi.fn(),
    });
    const rail = await screen.findByTestId('patient-rail');
    expect(rail).toHaveAccessibleName('Dharti Galani');
    expect(rail).toHaveTextContent('#3508');
    expect(rail).toHaveTextContent('9 days as patient');
    expect(rail).toHaveTextContent('Aesthetic');
    expect(rail).toHaveTextContent('Regular');
    expect(await axe(container)).toHaveNoViolations();
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

  it('masks each number until its own eye is pressed (Q-F4)', async () => {
    const user = userEvent.setup();
    renderRail();
    const reach = await screen.findByRole('region', { name: 'Reach' });
    expect(reach).toHaveTextContent('•••• 3212');
    expect(reach).toHaveTextContent('WhatsApp · Primary');
    // The handle is not a number — never masked (a plan addition, Appendix F).
    expect(reach).toHaveTextContent('@dharti');
    await user.click(within(reach).getByRole('button', { name: 'Show number' }));
    expect(reach).not.toHaveTextContent('••••');
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
    expect(about).toHaveTextContent('Umra, Velanja');
    expect(within(about).getByText('Data: consent given')).toBeInTheDocument();
  });

  it('says "No address" when there is none', async () => {
    renderRail({ file: { ...file, patient: { ...file.patient, address: null } } });
    expect(await screen.findByRole('region', { name: 'About' })).toHaveTextContent(
      'No address',
    );
  });

  it('offers to book when no visit is coming, and to reschedule the next one', async () => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    const none = renderRail({ file: { ...file, nextVisit: null }, actions: { onBook } });
    expect(await screen.findByRole('region', { name: 'Up next' })).toHaveTextContent(
      'Not booked',
    );
    await user.click(screen.getByTestId('patient-rail-book'));
    expect(onBook).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId('patient-rail-book')).toHaveTextContent('Book');
    none.unmount();

    const next = {
      appointmentId: 'a1',
      date: '2026-10-03',
      startTime: '11:00',
      serviceLabel: 'Hydrafacial',
      durationMin: 45,
    };
    renderRail({ file: { ...file, nextVisit: next }, actions: { onBook } });
    const upNext = await screen.findByRole('region', { name: 'Up next' });
    // Today reads its time alone (the rooms' one time rule).
    expect(upNext).toHaveTextContent(/11:00\sAM/);
    expect(upNext).not.toHaveTextContent('Today');
    expect(upNext).toHaveTextContent('Hydrafacial · 45 min');
    await user.click(screen.getByTestId('patient-rail-book'));
    expect(screen.getByTestId('patient-rail-book')).toHaveTextContent('Reschedule');
    expect(onBook).toHaveBeenLastCalledWith(next);
  });

  it('masks what they owe behind its eye, and collects it', async () => {
    const user = userEvent.setup();
    const onCollect = vi.fn();
    const owing = { ...file, due: 120_000, dueSince: '2026-09-21' };
    const { onToggleMasked } = renderRail({ file: owing, actions: { onCollect } });
    expect(await screen.findByTestId('patient-rail-due')).toHaveTextContent('₹ ••••');
    expect(screen.getByRole('region', { name: 'Up next' })).toHaveTextContent(
      'since 12 days',
    );
    await user.click(screen.getByTestId('patient-rail-due-eye'));
    expect(onToggleMasked).toHaveBeenCalledOnce();
    await user.click(screen.getByTestId('patient-rail-collect'));
    expect(onCollect).toHaveBeenCalledOnce();
  });

  it('shows the amount once unmasked, and "All paid" when nothing is owed', async () => {
    const shown = renderRail({ file: { ...file, due: 120_000 }, masked: false });
    expect(await screen.findByTestId('patient-rail-due')).toHaveTextContent('1,200');
    shown.unmount();

    renderRail({ file: { ...file, due: 0 } });
    expect(await screen.findByRole('region', { name: 'Up next' })).toHaveTextContent(
      'All paid · nothing due',
    );
    expect(screen.queryByTestId('patient-rail-due')).not.toBeInTheDocument();
  });

  it('shows what the clinic holds to give back, masked with the file', async () => {
    renderRail({
      file: { ...file, credit: { amount: 50_000, reasons: ['Charged twice'] } },
    });
    const upNext = await screen.findByRole('region', { name: 'Up next' });
    expect(upNext).toHaveTextContent('₹ •••• to return');
    expect(upNext).toHaveTextContent('Charged twice');
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

  it('keeps to identity for a member who reads billing alone (A-F14)', async () => {
    renderRail({ limited: true });
    await screen.findByTestId('patient-rail');
    expect(screen.queryByRole('region', { name: 'Reach' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'About' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Up next' })).not.toBeInTheDocument();
  });
});
