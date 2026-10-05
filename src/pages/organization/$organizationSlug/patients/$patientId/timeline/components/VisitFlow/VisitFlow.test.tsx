import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchVisit } from '@/shared/api/clinic/visits-api.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { VISIT_FLOW_STEPS } from './visit-flow.constants.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

const DHRUV = patientRef('Dhruv Patel');
const SANA = patientRef('Sana Kapoor');

/** The file on a patient's `timeline?visit=open`, for a member previewed as `role`. */
function openFlow(patientId: string, role: Role) {
  const user = userEvent.setup();
  const view = renderPatientFile(patientFileUrl(patientId, '/timeline?visit=open'), {
    role,
  });
  return { user, ...view };
}

const step = (name: string) => screen.getByTestId(`visit-flow-step-${name}`);
const stateOf = () =>
  Object.fromEntries(
    VISIT_FLOW_STEPS.map((name) => [name, step(name).getAttribute('data-state')]),
  );
const todaysSessions = () =>
  clinicFixtures.treatments.snapshot(
    (row) => row.appointmentId === ref.appointment(2865),
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
  vi.useRealTimers();
});

describe('VisitFlow (KICKOFF §6.6 Visit flow, D18; H:758–768)', () => {
  it('takes the Overview’s place with the five steps, the checks current', async () => {
    openFlow(DHRUV, 'owner');
    const flow = await screen.findByTestId('visit-flow');
    expect(screen.queryByTestId('overview-bento')).not.toBeInTheDocument();
    expect(within(flow).getByText('Visit in progress')).toBeInTheDocument();
    // Inside the flow the file bar offers neither Start visit nor Resume.
    expect(screen.queryByText('Visit in progress · Resume')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patient-file-start-visit')).not.toBeInTheDocument();
    expect(
      within(flow)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([
      'Check-in & safety',
      'Prescription',
      'Treatment',
      'Invoice',
      'Collect & share',
    ]);
    expect(stateOf()).toEqual({
      checks: 'current',
      rx: 'later',
      treatment: 'later',
      invoice: 'later',
      collect: 'later',
    });
    expect(step('checks')).toHaveTextContent('3 checks left');
    expect(
      await within(step('treatment')).findByTestId('visit-flow-repeat'),
    ).toHaveTextContent('⚡ Repeat · Laser hair reduction · session 4');
    expect(step('treatment')).toHaveTextContent(
      'Last settings: GentleMax · 18 J/cm² · 755 nm · Type IV',
    );
    expect(
      within(step('treatment')).getByText(/^Uses 1 session of /),
    ).toBeInTheDocument();
  });

  it('holds the treatment until the checks are done, then repeats the last session', async () => {
    const { user } = openFlow(DHRUV, 'owner');
    await user.click(await screen.findByTestId('visit-flow-repeat'));
    expect(notifyMock.info).toHaveBeenCalledWith('Finish check-in first');
    expect(todaysSessions()).toHaveLength(0);

    for (const check of ['consent', 'photos', 'allergies']) {
      const tile = screen.getByTestId(`visit-flow-check-${check}`);
      await user.click(tile);
      await waitFor(() => expect(tile).toHaveAttribute('aria-checked', 'true'));
    }
    await waitFor(() => expect(step('checks')).toHaveAttribute('data-state', 'done'));
    expect(step('checks')).toHaveTextContent('All checks done');
    expect(step('rx')).toHaveAttribute('data-state', 'current');

    await user.click(screen.getByTestId('visit-flow-repeat'));
    await waitFor(() => expect(todaysSessions()).toHaveLength(1));
    expect(todaysSessions()[0]).toMatchObject({ sessionNo: 4, bodyParts: ['legs'] });
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Session 4 recorded with last settings',
    );
    await waitFor(() => expect(step('treatment')).toHaveAttribute('data-state', 'done'));
    expect(step('treatment')).toHaveTextContent('Laser hair reduction · session 4');
  });

  it('prescribes a kit in one tap, for a doctor', async () => {
    const { user, router } = openFlow(SANA, 'doctor');
    const kits = await screen.findAllByTestId('visit-flow-kit');
    expect(kits.map((kit) => kit.textContent)).toEqual([
      '⚡ Hair fall kit',
      '⚡ Post-peel kit',
      '⚡ Pigmentation kit',
    ]);
    await user.click(kits[0]!);
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Hair fall kit prescribed'),
    );
    await waitFor(() => expect(step('rx')).toHaveAttribute('data-state', 'done'));
    expect(step('rx')).toHaveTextContent('Flubolt 400, Clonix-B Lotion');
    // The Rx at the consult moves Today's card on (L-64: the stage follows the records).
    expect((await fetchVisit(ref.visit(2866))).visit.stage).toBe('checkout');

    await user.click(screen.getByTestId('visit-flow-write-rx'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(SANA, '/prescriptions/create'),
      ),
    );
    // The drawer keeps the flow open behind it and closes back to it.
    expect(router.state.location.search).toEqual({ visit: 'open' });
  });

  it('opened from Today: its drawers carry the way back, and Pause returns to Today (L-64)', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(
      patientFileUrl(DHRUV, '/timeline?visit=open&from=today'),
      { role: 'owner' },
    );
    await user.click(await screen.findByTestId('visit-flow-write-rx'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(DHRUV, '/prescriptions/create'),
      ),
    );
    expect(router.state.location.search).toEqual({ visit: 'open', from: 'today' });
    await router.navigate({
      href: patientFileUrl(DHRUV, '/timeline?visit=open&from=today'),
    });
    await user.click(await screen.findByTestId('visit-flow-pause'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/today'),
    );
    expect((await fetchVisit(ref.visit(2865))).visit.stage).toBe('treatment');
  });

  it('bills the visit and collects what is due, for the front desk', async () => {
    const { user } = openFlow(SANA, 'front_desk');
    const invoice = await screen.findByTestId('visit-flow-step-invoice');
    expect(within(invoice).queryByTestId('visit-flow-kit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('visit-flow-kit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('visit-flow-write-rx')).not.toBeInTheDocument();
    expect(screen.queryByTestId('visit-flow-repeat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('visit-flow-new-treatment')).not.toBeInTheDocument();
    expect(await within(invoice).findByText('Total')).toBeInTheDocument();
    expect(within(invoice).getAllByText('₹ ••••').length).toBeGreaterThan(1);

    await user.click(within(invoice).getByTestId('visit-flow-create-invoice'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        expect.stringMatching(/^Invoice .+ created from the visit$/),
      ),
    );
    await waitFor(() => expect(invoice).toHaveAttribute('data-state', 'done'));
    expect((await fetchVisit(ref.visit(2866))).invoice).not.toBeNull();

    const receipts = () =>
      clinicFixtures.payments.snapshot((row) => row.kind === 'receipt').length;
    const before = receipts();
    await user.click(await screen.findByTestId('visit-flow-collect-cash'));
    await waitFor(() => expect(receipts()).toBe(before + 1));
    expect(notifyMock.success).toHaveBeenLastCalledWith('₹ •••• received by Cash');
  });

  it('opened from Today: a Collect that pays the bill in full ends the visit and goes back to Today (D18, S:352)', async () => {
    // Ishita is at Checkout with her bill (#791) and nothing to fill.
    const ISHITA = patientRef('Ishita Vora');
    const user = userEvent.setup();
    const { router } = renderPatientFile(
      patientFileUrl(ISHITA, '/timeline?visit=open&from=today'),
      { role: 'owner' },
    );
    await user.click(await screen.findByTestId('visit-flow-custom-invoice'));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe('/organization/acme/invoices/create'),
    );
    // The flow stands behind the custom invoice (A-P1), which closes back into it,
    // Today still its way back.
    expect(router.state.location.pathname).toBe(patientFileUrl(ISHITA, '/timeline'));
    expect(shownLocation(router).search).toMatchObject({
      from: `patients/${ISHITA}/timeline?visit=open&from=today`,
    });
    await router.navigate({
      href: patientFileUrl(ISHITA, '/timeline?visit=open&from=today'),
    });

    await user.click(await screen.findByTestId('visit-flow-collect-upi'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/today'),
    );
    expect(notifyMock.success).toHaveBeenCalledWith(
      expect.stringMatching(/ received by UPI$/),
    );
    expect((await fetchVisit(ref.visit(2864))).visit.stage).toBe('done');
  });

  it('shares the visit, then completes it and goes back to the Overview', async () => {
    const { user, router } = openFlow(DHRUV, 'owner');
    await user.click(await screen.findByTestId('visit-flow-share'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Rx, invoice and photos sent to Dhruv Patel on WhatsApp',
      ),
    );
    await waitFor(() => expect(step('collect')).toHaveTextContent('Sent on WhatsApp'));

    await user.click(screen.getByTestId('visit-flow-complete'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenLastCalledWith('Visit completed'),
    );
    expect(await screen.findByTestId('overview-bento')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({});
    expect((await fetchVisit(ref.visit(2865))).visit.stage).toBe('done');
  });

  it('pauses with the visit still open, the file bar resuming it', async () => {
    const { user, router } = openFlow(DHRUV, 'owner');
    await user.click(await screen.findByTestId('visit-flow-pause'));
    expect(await screen.findByTestId('overview-bento')).toBeInTheDocument();
    expect(screen.queryByTestId('patient-file-start-visit')).not.toBeInTheDocument();
    await user.click(screen.getByText('Visit in progress · Resume'));
    expect(await screen.findByTestId('visit-flow')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ visit: 'open' });
    expect((await fetchVisit(ref.visit(2865))).visit.stage).toBe('treatment');
  });

  it('has no axe violations', async () => {
    const { container } = openFlow(DHRUV, 'owner');
    await screen.findByTestId('visit-flow-repeat');
    expect(await axe(container)).toHaveNoViolations();
  });
});
