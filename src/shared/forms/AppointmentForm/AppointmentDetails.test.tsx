import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { fetchBookableStaff } from '@/shared/api/clinic/appointments-api.ts';
import type {
  AppointmentPackageOption,
  AppointmentStaff,
} from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';

import { APPOINTMENT_FORM_TEST_IDS as IDS } from './appointment-form.constants.ts';
import {
  applyAppointmentChange,
  type AppointmentDraft,
  emptyDraft,
} from './appointment-form-model.ts';
import { AppointmentDetails } from './AppointmentDetails.tsx';

let staff: AppointmentStaff[] = [];
let offerings: OfferingRecord[] = [];

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  resetClinicFixtures();
  staff = await fetchBookableStaff();
  offerings = clinicFixtures.offerings.snapshot();
  vi.useRealTimers();
});

const PACKAGES: AppointmentPackageOption[] = [
  {
    id: 'pack-1',
    offeringId: 'off-1',
    name: 'LHR Full Face · 6',
    tone: 'blush',
    durationMin: 45,
    sessionsTotal: 6,
    sessionsUsed: 2,
    validUntil: '2027-03-23',
  },
  {
    id: 'pack-2',
    offeringId: 'off-2',
    name: 'Hydrafacial · 4',
    tone: 'mint',
    durationMin: 60,
    sessionsTotal: 4,
    sessionsUsed: 3,
    validUntil: '2026-12-31',
  },
];

/** The details with their draft, as the form holds it. */
function Details({
  start,
  packages = [],
}: {
  start: AppointmentDraft;
  packages?: AppointmentPackageOption[];
}) {
  const [draft, setDraft] = useState(start);
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
            packages={packages}
            staff={staff}
            offerings={offerings}
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

const PRIYA = {
  kind: 'patient' as const,
  name: 'Priya Shah',
  phone: null,
  patientId: 'p1',
  leadId: null,
  seq: 1,
};

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

  it('picks a treatment from the common ones or the offerings, its length snapped', async () => {
    const u = user();
    render(<Details start={emptyDraft('2026-10-05')} />);
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
    const offering = offerings.find(
      (row) =>
        row.active &&
        row.category === 'treatment' &&
        !['Treatment', 'LHR Treatment', 'Peel', 'Hydrafacial'].includes(row.name),
    );
    if (!offering) throw new Error('no treatment offering');
    await u.click(screen.getByTestId(IDS.treatment));
    await u.click(await screen.findByTestId(`${IDS.treatment}-option-${offering.id}`));
    expect(draftNow()).toMatchObject({
      serviceLabel: offering.name,
      offeringId: offering.id,
    });
  });

  it('offers a patient’s packages with the next session, and switches between them', async () => {
    const u = user();
    render(
      <Details start={{ ...emptyDraft('2026-10-05'), who: PRIYA }} packages={PACKAGES} />,
    );
    await u.click(screen.getByTestId(`${IDS.type}-package_session`));
    expect(
      screen.getByText('No charge · session 3 of 6 is used when the visit is completed'),
    ).toBeVisible();
    const radios = within(screen.getByTestId(IDS.package)).getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveTextContent('4 left');
    await u.click(radios[1]!);
    expect(draftNow()).toMatchObject({
      type: 'package_session',
      packageId: 'pack-2',
      serviceLabel: 'Hydrafacial · 4',
      durationMin: 60,
    });
  });

  it('says why there is no package, and books it as a treatment instead', async () => {
    const u = user();
    const { unmount } = render(
      <Details
        start={{ ...emptyDraft('2026-10-05'), who: PRIYA, type: 'package_session' }}
      />,
    );
    expect(screen.getByText('Priya Shah has no active package')).toBeVisible();
    await u.click(screen.getByTestId(IDS.packageAsTreatment));
    expect(draftNow()).toMatchObject({ type: 'treatment', serviceLabel: 'Treatment' });
    unmount();
    render(<Details start={{ ...emptyDraft('2026-10-05'), type: 'package_session' }} />);
    expect(screen.getByText('Pick a contact to see their packages')).toBeVisible();
  });

  it('picks the doctor, the length, the reason and the notes', async () => {
    const u = user();
    render(<Details start={{ ...emptyDraft('2026-10-05'), time: '11:00' }} />);
    expect(screen.getByTestId(IDS.doctor)).toHaveAccessibleName(/Pick a doctor/);
    const doctor = staff[1] ?? staff[0];
    if (!doctor) throw new Error('no staff');
    await u.click(screen.getByTestId(IDS.doctor));
    await u.click(await screen.findByTestId(`${IDS.doctor}-option-${doctor.id}`));
    expect(draftNow()).toMatchObject({ doctorId: doctor.id, time: null });
    await u.click(screen.getByTestId(`${IDS.length}-45`));
    await u.type(screen.getByTestId(IDS.reason), 'Pigmentation');
    await u.type(screen.getByTestId(IDS.notes), 'Prefers mornings');
    expect(draftNow()).toMatchObject({
      durationMin: 45,
      reason: 'Pigmentation',
      notes: 'Prefers mornings',
    });
    expect(screen.getByLabelText('Reason')).toBe(screen.getByTestId(IDS.reason));
  });
});
