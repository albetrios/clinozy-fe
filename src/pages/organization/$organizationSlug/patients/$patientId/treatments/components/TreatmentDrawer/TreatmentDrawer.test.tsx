import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

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
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const DHARTI = patientRef('Dharti Galani');
/** Dharti's LHR Full Face, session 1 — one check-in ("Better 7/10"). */
const LHR = ref.treatment(498);
const url = (rest: string) => patientFileUrl(DHARTI, `/treatments${rest}`);

const newest = () =>
  clinicFixtures.treatments
    .snapshot((row) => row.patientId === DHARTI)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

async function openNew(role: 'therapist' | 'doctor' = 'therapist') {
  const user = userEvent.setup();
  const view = renderPatientFile(url('/create'), { role });
  const drawer = await screen.findByTestId('treatment-drawer');
  return { ...view, user, drawer };
}

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('Treatment drawer (KICKOFF §6.6; S:38–39)', () => {
  it('opens a new treatment as the next session of the last one, with Quick fill', async () => {
    const { drawer, baseElement } = await openNew();
    expect(within(drawer).getByTestId('treatment-drawer-title')).toHaveTextContent(
      'New treatment',
    );
    expect(within(drawer).queryByTestId('treatment-drawer-tag')).not.toBeInTheDocument();
    expect(drawer).toHaveTextContent(
      'Fields follow the clinic specialty · switch if needed',
    );
    expect(within(drawer).getByTestId('treatment-drawer-badges')).toHaveTextContent(
      'Skin · laserSession 2',
    );
    expect(within(drawer).getByTestId('treatment-drawer-name')).toHaveValue(
      'LHR Full Face',
    );
    // The step's summary values are isolated tokens; their words and order as read:
    expect(
      withoutBidiMarks(
        within(drawer).getByTestId('treatment-drawer-step-session').textContent,
      ),
    ).toMatch(/LHR Full Face · 2 · /);
    const fill = within(drawer).getByTestId('treatment-drawer-quick-fill');
    expect(
      within(fill).getByRole('button', { name: /Next session of LHR Full Face/ }),
    ).toBeVisible();
    expect(within(fill).getAllByRole('button').length).toBeGreaterThan(1);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('fills the next session of the last treatment', async () => {
    const { user, drawer } = await openNew();
    await user.clear(within(drawer).getByTestId('treatment-drawer-name'));
    await user.click(within(drawer).getByTestId('treatment-drawer-quick-fill-next'));
    expect(within(drawer).getByTestId('treatment-drawer-name')).toHaveValue(
      'LHR Full Face',
    );
    expect(within(drawer).getByTestId('treatment-drawer-badges')).toHaveTextContent(
      'Session 2',
    );
  });

  it('switches to Dental, picks teeth and saves a blank name as “Treatment”', async () => {
    const { user, drawer, router } = await openNew('doctor');
    await user.clear(within(drawer).getByTestId('treatment-drawer-name'));
    await user.click(within(drawer).getByTestId('treatment-drawer-template-dental'));
    expect(within(drawer).getByTestId('treatment-drawer-badges')).toHaveTextContent(
      'Dental',
    );
    await user.click(within(drawer).getByTestId('treatment-drawer-step-details-trigger'));
    expect(within(drawer).getByText('Dental details')).toBeVisible();
    const tooth = within(drawer).getByTestId('treatment-drawer-tooth-18');
    await user.click(tooth);
    expect(tooth).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(drawer).getByTestId('treatment-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Treatment saved'),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
    expect(newest()).toMatchObject({
      name: 'Treatment',
      template: 'dental',
      params: { teeth: '18' },
      aftercareCall: 'next_day',
    });
  });

  it('uses a package session from its Quick fill chip', async () => {
    const { user, drawer } = await openNew();
    const fill = within(drawer).getByTestId('treatment-drawer-quick-fill');
    const chip = within(fill)
      .getAllByRole('button')
      .find((button) =>
        button.dataset.testid?.startsWith('treatment-drawer-quick-fill-package-'),
      );
    if (!chip) throw new Error('no package chip');
    const packageId = chip.dataset.testid?.replace(
      'treatment-drawer-quick-fill-package-',
      '',
    );
    const before = clinicFixtures.patientPackages.snapshot(
      (row) => row.id === packageId,
    )[0];
    await user.click(chip);
    await user.click(within(drawer).getByTestId('treatment-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Treatment saved'),
    );
    const after = clinicFixtures.patientPackages.snapshot(
      (row) => row.id === packageId,
    )[0];
    expect(after?.sessionsUsed).toBe((before?.sessionsUsed ?? 0) + 1);
    expect(newest()?.packageId).toBe(packageId);
  });

  it('edits a treatment with its feedback line, saving “Treatment saved”', async () => {
    const user = userEvent.setup();
    renderPatientFile(url(`/${LHR}/edit`), { role: 'doctor' });
    const drawer = await screen.findByTestId('treatment-drawer');
    expect(within(drawer).getByTestId('treatment-drawer-title')).toHaveTextContent(
      'Edit treatment',
    );
    await user.click(
      within(drawer).getByTestId('treatment-drawer-step-aftercare-trigger'),
    );
    expect(within(drawer).getByTestId('treatment-drawer-feedback')).toHaveTextContent(
      /· Better 7\/10/,
    );
    await user.click(within(drawer).getByTestId('treatment-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Treatment saved'),
    );
  });

  it('logs a check-in from an edit: ⚡ "Log check-in" stacks the aftercare check-in, Back returns', async () => {
    const user = userEvent.setup();
    renderPatientFile(url(`/${LHR}/edit`), { role: 'doctor' });
    const drawer = await screen.findByTestId('treatment-drawer');
    await user.click(within(drawer).getByTestId('treatment-drawer-quick-fill-check-in'));
    const checkIn = await screen.findByTestId('check-in-drawer');
    expect(within(checkIn).getByTestId('check-in-drawer-title')).toHaveTextContent(
      'Aftercare check-in',
    );
    const back = within(checkIn).getByTestId('check-in-drawer-dismiss');
    expect(back).toHaveTextContent('Back');
    await user.click(back);
    await waitFor(() =>
      expect(screen.queryByTestId('check-in-drawer')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('treatment-drawer')).toBeInTheDocument();
  });

  it('saves the stacked check-in as the treatment’s aftercare — no booking, as the row’s “Check-in” writes it', async () => {
    const user = userEvent.setup();
    renderPatientFile(url(`/${LHR}/edit`), { role: 'doctor' });
    const drawer = await screen.findByTestId('treatment-drawer');
    await user.click(within(drawer).getByTestId('treatment-drawer-quick-fill-check-in'));
    const checkIn = await screen.findByTestId('check-in-drawer');
    await user.click(within(checkIn).getByTestId('check-in-drawer-feel-much_better'));
    await user.click(within(checkIn).getByTestId('check-in-drawer-save'));
    await waitFor(() =>
      expect(screen.queryByTestId('check-in-drawer')).not.toBeInTheDocument(),
    );
    const saved = clinicFixtures.checkIns.snapshot(
      (row) => row.treatmentId === LHR && row.feel === 'much_better',
    );
    expect(saved).toEqual([expect.objectContaining({ appointmentId: null })]);
  });

  it('offers no "Log check-in" on a new treatment', async () => {
    const { drawer } = await openNew();
    expect(
      within(drawer).queryByTestId('treatment-drawer-quick-fill-check-in'),
    ).not.toBeInTheDocument();
  });

  it('reads only for an Admin — treatments are Doctor and Therapist (S:39)', async () => {
    const user = userEvent.setup();
    renderPatientFile(url(`/${LHR}/edit`), { role: 'admin' });
    const drawer = await screen.findByTestId('treatment-drawer');
    expect(within(drawer).queryByTestId('treatment-drawer-save')).not.toBeInTheDocument();
    expect(within(drawer).getByTestId('treatment-drawer-summary')).toHaveTextContent(
      'View only · your role can’t change this',
    );
    // A check-in is Patients Edit's, as on the row: ⚡ "Log check-in" stays, alone.
    const fill = within(drawer).getByTestId('treatment-drawer-quick-fill');
    expect(
      within(fill)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual(['Log check-in']);
    await user.click(within(fill).getByTestId('treatment-drawer-quick-fill-check-in'));
    expect(await screen.findByTestId('check-in-drawer')).toBeInTheDocument();
  });
});
