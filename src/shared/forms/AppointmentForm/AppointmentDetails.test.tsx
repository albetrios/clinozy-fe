import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import type { AppointmentTreatment } from '@/shared/api/app/appointments-contracts.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { DOCTOR_ARJUN, DOCTOR_NISHA } from '@/tests/utils/appointment-doubles.ts';
import { axeLabelInName } from '@/tests/utils/axe-label-in-name.ts';

import { APPOINTMENT_FORM_TEST_IDS as IDS } from './appointment-form.constants.ts';
import {
  applyAppointmentChange,
  type AppointmentDraft,
  emptyDraft,
} from './appointment-form-model.ts';
import { AppointmentDetails } from './AppointmentDetails.tsx';

/** The clinic's active treatments, as `GET /app/offerings?category=treatment` reads them. */
const TREATMENTS: AppointmentTreatment[] = [
  {
    id: 'off_derma000000000000000',
    name: 'Dermaplaning',
    durationMin: 40,
    specialty: 'skin',
    tone: 'mint',
  },
  {
    id: 'off_scalp000000000000000',
    name: 'Scalp PRP',
    durationMin: 0,
    specialty: 'hair',
    tone: 'lav',
  },
  // A common treatment's name — offered once, under "Common".
  {
    id: 'off_peel0000000000000000',
    name: 'Peel',
    durationMin: 30,
    specialty: 'skin',
    tone: 'blush',
  },
];

/** The details with their draft, as the form holds it. */
function Details({ start }: { start: AppointmentDraft }) {
  const [draft, setDraft] = useState(start);
  // The Picker reads its options through a query.
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <div className="@container">
          <AppointmentDetails
            draft={draft}
            onChange={(change) =>
              setDraft((current) => applyAppointmentChange(current, change))
            }
            staff={[DOCTOR_NISHA, DOCTOR_ARJUN]}
            treatments={TREATMENTS}
            disabled={false}
            idPrefix="test"
          />
          <output data-testid="draft">{JSON.stringify(draft)}</output>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const draftNow = () =>
  JSON.parse(screen.getByTestId('draft').textContent ?? '{}') as AppointmentDraft;

const user = () => userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

describe('AppointmentDetails — step 1 (H:2764–2773)', () => {
  it('words each type’s line and hint; a type sets its service and length', async () => {
    const u = user();
    const { container } = render(<Details start={emptyDraft('2026-10-05')} />);
    expect(
      screen.getByText('Consultation fee is added to the invoice at checkout'),
    ).toBeVisible();
    expect(screen.getByTestId(`${IDS.type}-follow_up`)).toHaveAttribute(
      'title',
      'Short review after a treatment or Rx',
    );
    await u.click(screen.getByTestId(`${IDS.type}-follow_up`));
    expect(
      screen.getByText('Usually free · no invoice unless something is added'),
    ).toBeVisible();
    expect(draftNow()).toMatchObject({ type: 'follow_up', durationMin: 15 });
    expect(screen.getByTestId(`${IDS.length}-15`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      await axe(container, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });

  it('books a Package session with no package to pick — the length stays', async () => {
    const u = user();
    render(<Details start={{ ...emptyDraft('2026-10-05'), durationMin: 30 }} />);
    await u.click(screen.getByTestId(`${IDS.type}-package_session`));
    expect(draftNow()).toMatchObject({
      type: 'package_session',
      serviceLabel: 'Package session',
      durationMin: 30,
    });
    expect(screen.queryByTestId(IDS.treatment)).not.toBeInTheDocument();
    // No package list, no sessions count, and no line under the chips.
    expect(screen.queryByText(/active package|session \d+ of/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Consultation fee is added to the invoice at checkout'),
    ).not.toBeInTheDocument();
  });

  it('picks a treatment from the common ones or from the clinic’s offerings', async () => {
    const u = user();
    render(<Details start={emptyDraft('2026-10-05')} />);
    expect(screen.queryByTestId(IDS.treatment)).not.toBeInTheDocument();
    await u.click(screen.getByTestId(`${IDS.type}-treatment`));
    expect(draftNow()).toMatchObject({ serviceLabel: 'Treatment', durationMin: 60 });
    await u.click(screen.getByTestId(IDS.treatment));
    await u.click(
      await screen.findByTestId(`${IDS.treatment}-option-common:Hydrafacial`),
    );
    expect(draftNow()).toMatchObject({
      type: 'treatment',
      serviceLabel: 'Hydrafacial',
      offeringId: null,
      durationMin: 45,
    });
    await u.click(screen.getByTestId(IDS.treatment));
    expect(screen.getByText('From offerings')).toBeVisible();
    const dermaplaning = await screen.findByTestId(
      `${IDS.treatment}-option-off_derma000000000000000`,
    );
    // Its specialty under the name, its length beside it.
    expect(dermaplaning).toHaveTextContent('Skin');
    expect(dermaplaning).toHaveTextContent('40 min');
    // A treatment with a common name is offered once, under "Common".
    expect(
      screen.queryByTestId(`${IDS.treatment}-option-off_peel0000000000000000`),
    ).not.toBeInTheDocument();
    await u.click(dermaplaning);
    expect(draftNow()).toMatchObject({
      serviceLabel: 'Dermaplaning',
      offeringId: 'off_derma000000000000000',
      durationMin: 45,
    });
  });

  it('books an offering without a length for 30 minutes', async () => {
    const u = user();
    render(<Details start={{ ...emptyDraft('2026-10-05'), type: 'treatment' }} />);
    await u.click(screen.getByTestId(IDS.treatment));
    const scalp = await screen.findByTestId(
      `${IDS.treatment}-option-off_scalp000000000000000`,
    );
    expect(scalp).toHaveTextContent('30 min');
    await u.click(scalp);
    expect(draftNow()).toMatchObject({
      serviceLabel: 'Scalp PRP',
      offeringId: 'off_scalp000000000000000',
      durationMin: 30,
    });
  });

  it('offers the team as doctors by name, and a pick clears the time', async () => {
    const u = user();
    render(
      <Details
        start={{ ...emptyDraft('2026-10-05'), doctorId: DOCTOR_NISHA.id, time: '11:00' }}
      />,
    );
    expect(screen.getByTestId(IDS.doctor)).toHaveAccessibleName(/Nisha Shah/);
    await u.click(screen.getByTestId(IDS.doctor));
    const arjun = await screen.findByTestId(`${IDS.doctor}-option-${DOCTOR_ARJUN.id}`);
    // The name and the initials' avatar — no role or presence line under it.
    expect(arjun).toHaveTextContent(/^AR\s*Arjun Rao$/);
    await u.click(arjun);
    expect(draftNow()).toMatchObject({ doctorId: DOCTOR_ARJUN.id, time: null });
    expect(screen.getByTestId(IDS.doctor)).toHaveAccessibleName(/Arjun Rao/);
  });

  it('names the doctor trigger by its words, never an aria-label over the initials (WCAG 2.5.3)', async () => {
    const { container } = render(
      <Details start={{ ...emptyDraft('2026-10-05'), doctorId: DOCTOR_NISHA.id }} />,
    );
    const trigger = screen.getByTestId(IDS.doctor);
    expect(trigger).not.toHaveAttribute('aria-label');
    expect(trigger).toHaveAccessibleName('Doctor · Nisha Shah');
    expect(await axeLabelInName(container)).toHaveNoViolations();
  });

  it('the label-in-name check has teeth: an aria-label over shown initials fails it', async () => {
    const { container } = render(
      <button type="button" aria-label="Doctor · Nisha Shah">
        <span aria-hidden="true">NS</span>
        <span>Nisha Shah</span>
      </button>,
    );
    expect(await axeLabelInName(container)).not.toHaveNoViolations();
  });

  it('asks for a doctor when none is picked', () => {
    render(<Details start={emptyDraft('2026-10-05')} />);
    expect(screen.getByTestId(IDS.doctor)).toHaveAccessibleName(/Pick a doctor/);
  });

  it('picks the length, the reason and the notes', async () => {
    const u = user();
    render(<Details start={emptyDraft('2026-10-05')} />);
    await u.click(screen.getByTestId(`${IDS.length}-45`));
    await u.type(screen.getByTestId(IDS.reason), 'Pigmentation');
    await u.type(screen.getByTestId(IDS.notes), 'Prefers mornings');
    expect(draftNow()).toMatchObject({
      durationMin: 45,
      reason: 'Pigmentation',
      notes: 'Prefers mornings',
    });
    expect(screen.getByLabelText('Reason')).toBe(screen.getByTestId(IDS.reason));
    expect(screen.getByLabelText('Notes')).toBe(screen.getByTestId(IDS.notes));
  });
});
