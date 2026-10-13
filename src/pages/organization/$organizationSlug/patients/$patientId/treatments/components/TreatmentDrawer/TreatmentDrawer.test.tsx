import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import type * as OfferingsApiModule from '@/shared/api/app/offerings-api.ts';
import type * as PatientPackagesApiModule from '@/shared/api/app/patient-packages-api.ts';
import { listPatientPackages } from '@/shared/api/app/patient-packages-api.ts';
import type * as TreatmentsApiModule from '@/shared/api/app/treatments-api.ts';
import { createTreatment, updateTreatment } from '@/shared/api/app/treatments-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';
import { patientFile } from '@/tests/utils/patient-doubles.ts';

import {
  BOOKABLE_TREATMENTS,
  patientPackage,
  seededTreatmentsWorld,
  TEAM,
  TEST_PACKAGE_ID,
  TEST_TREATMENT_ID,
  treatmentRecord,
  type TreatmentsWorld,
} from '../../__tests__/integration/treatment-doubles.ts';
import {
  renderTreatments,
  resetTreatments,
  type TreatmentsMember,
  treatmentsUrl,
} from '../../__tests__/integration/treatments-test-router.tsx';

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

const world = vi.hoisted(() => ({}) as TreatmentsWorld);
vi.mock('@/shared/api/app/treatments-api.ts', async (importOriginal) => {
  const { treatmentsApiDouble } =
    await import('../../__tests__/integration/treatment-doubles.ts');
  return {
    ...(await importOriginal<typeof TreatmentsApiModule>()),
    ...treatmentsApiDouble(world),
  };
});
vi.mock('@/shared/api/app/patient-packages-api.ts', async (importOriginal) => {
  const { packagesApiDouble } =
    await import('../../__tests__/integration/treatment-doubles.ts');
  return {
    ...(await importOriginal<typeof PatientPackagesApiModule>()),
    ...packagesApiDouble(world),
  };
});
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OfferingsApiModule>()),
  fetchAllOfferings: vi.fn(async () =>
    BOOKABLE_TREATMENTS.map((treatment) => offeringRecord(treatment)),
  ),
}));
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof DirectoryApiModule>()),
  fetchTeamDirectory: vi.fn(async () => TEAM),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(async () => TEAM[0]?.id ?? null),
}));
// The check-in drawer is the feedback group's; the stacked one only has to open and close.
vi.mock('../../../shared/components/CheckInDrawer/index.ts', () => ({
  CheckInDrawer: ({
    treatmentId,
    appointmentId,
    stacked,
    onClose,
  }: {
    treatmentId: string | null;
    appointmentId: string | null;
    stacked?: boolean;
    onClose: () => void;
  }) => (
    <div
      data-testid="check-in-drawer"
      data-treatment={treatmentId ?? ''}
      data-appointment={appointmentId ?? 'none'}
      data-stacked={String(Boolean(stacked))}
    >
      <button type="button" data-testid="check-in-drawer-dismiss" onClick={onClose}>
        Back
      </button>
    </div>
  ),
}));

const FILE = patientFile();
const url = (rest: string) => treatmentsUrl(FILE, rest);
/** A doctor signed in with both treatment codes. */
const WRITER: TreatmentsMember = {
  permissions: ['patient_treatment:create', 'patient_treatment:update', 'patient:update'],
};

async function openNew(member: TreatmentsMember = WRITER) {
  const user = userEvent.setup();
  const view = renderTreatments(url('/create'), { member });
  const drawer = await screen.findByTestId('treatment-drawer');
  return { ...view, user, drawer };
}

async function openEdit(member: TreatmentsMember = WRITER) {
  const user = userEvent.setup();
  const view = renderTreatments(url(`/${TEST_TREATMENT_ID}/edit`), { member });
  const drawer = await screen.findByTestId('treatment-drawer');
  return { ...view, user, drawer };
}

const lastCreate = () => vi.mocked(createTreatment).mock.lastCall?.[0];

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  Object.assign(world, seededTreatmentsWorld());
});
afterEach(() => resetTreatments());

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
    expect(within(drawer).getByTestId('treatment-drawer-step-session')).toHaveAttribute(
      'data-status',
      'open',
    );
    const fill = within(drawer).getByTestId('treatment-drawer-quick-fill');
    expect(
      within(fill).getByRole('button', { name: /Next session of LHR Full Face/ }),
    ).toBeVisible();
    expect(
      within(fill).getByTestId(`treatment-drawer-quick-fill-package-${TEST_PACKAGE_ID}`),
    ).toBeInTheDocument();
    // The name chips are the clinic's active treatments (`GET /app/offerings`).
    expect(await within(drawer).findByText('Underarm Peel')).toBeInTheDocument();
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
    const { user, drawer, router } = await openNew();
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
    expect(lastCreate()).toEqual({
      patientId: FILE.patient.id,
      input: expect.objectContaining({
        name: 'Treatment',
        template: 'dental',
        parameters: { teeth: '18' },
        sessionNumber: 2,
        aftercareCall: 'next_day',
        packageId: null,
      }),
      idempotencyKey: expect.any(String),
    });
  });

  it('spends a package session from "From package": the server numbers it (§6 #20)', async () => {
    const { user, drawer } = await openNew();
    await user.click(
      within(drawer).getByTestId(`treatment-drawer-package-${TEST_PACKAGE_ID}`),
    );
    expect(within(drawer).getByTestId('treatment-drawer-name')).toHaveValue(
      'LHR Full Face · B4G7',
    );
    expect(
      within(drawer).getByTestId('treatment-drawer-session-numbered'),
    ).toBeInTheDocument();
    expect(within(drawer).getByTestId('treatment-drawer-badges')).not.toHaveTextContent(
      'Session',
    );
    await user.click(within(drawer).getByTestId('treatment-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Treatment saved'),
    );
    expect(lastCreate()?.input).toMatchObject({
      packageId: TEST_PACKAGE_ID,
      offeringId: 'off_lhrpack000000000000000',
    });
    // The package now reads 2 of 7 used — the server's count, read again.
    expect(world.packages[0]?.sessionsUsed).toBe(2);
  });

  it('offers no package that cannot spend a session', async () => {
    world.packages = [
      patientPackage({ status: 'used_up', sessionsUsed: 7, sessionsLeft: 0 }),
    ];
    const { drawer } = await openNew();
    expect(
      within(drawer).queryByTestId(`treatment-drawer-package-${TEST_PACKAGE_ID}`),
    ).not.toBeInTheDocument();
    expect(
      within(drawer).queryByTestId(
        `treatment-drawer-quick-fill-package-${TEST_PACKAGE_ID}`,
      ),
    ).not.toBeInTheDocument();
  });

  it('says why a package session was refused and reads the packages again', async () => {
    world.refuseConflict = 'offering_used_up';
    const { user, drawer } = await openNew();
    await user.click(
      within(drawer).getByTestId(`treatment-drawer-package-${TEST_PACKAGE_ID}`),
    );
    const reads = vi.mocked(listPatientPackages).mock.calls.length;
    await user.click(within(drawer).getByTestId('treatment-drawer-save'));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    await waitFor(() =>
      expect(vi.mocked(listPatientPackages).mock.calls.length).toBeGreaterThan(reads),
    );
    expect(screen.getByTestId('treatment-drawer')).toBeInTheDocument();
  });

  it('shows the server’s field errors on their fields and opens their step', async () => {
    world.refuseFields = [
      { field: 'body.session_number', message: 'Too big: expected number to be <=999' },
    ];
    const { user, drawer } = await openNew();
    await user.click(
      within(drawer).getByTestId('treatment-drawer-step-aftercare-trigger'),
    );
    await user.click(within(drawer).getByTestId('treatment-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Too big: expected number to be <=999',
      ),
    );
    expect(within(drawer).getByTestId('treatment-drawer-session')).toBeVisible();
  });

  it('edits a treatment with its feedback line, saving with the read', async () => {
    const { user, drawer } = await openEdit();
    expect(within(drawer).getByTestId('treatment-drawer-title')).toHaveTextContent(
      'Edit treatment',
    );
    await user.click(
      within(drawer).getByTestId('treatment-drawer-step-aftercare-trigger'),
    );
    expect(within(drawer).getByTestId('treatment-drawer-feedback')).toHaveTextContent(
      /· Better 7\/10/,
    );
    await user.type(within(drawer).getByTestId('treatment-drawer-remark'), 'Settled');
    await user.click(within(drawer).getByTestId('treatment-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Treatment saved'),
    );
    expect(vi.mocked(updateTreatment).mock.lastCall?.[0]).toMatchObject({
      treatment: { id: TEST_TREATMENT_ID, updatedAt: '2026-10-01T09:30:00.000Z' },
      fields: { remark: 'Settled' },
    });
  });

  it('names an edited session’s package and keeps its number', async () => {
    world.treatments = [
      treatmentRecord({ packageId: TEST_PACKAGE_ID, sessionNumber: 2 }),
    ];
    const { drawer } = await openEdit();
    // "Uses 1 session of LHR Full Face · B4G7" — new copy (locales-C.json).
    expect(within(drawer).getByTestId('treatment-drawer-package')).toHaveTextContent(
      /LHR Full Face · B4G7|treatment\.package\.uses/,
    );
    expect(
      within(drawer).getByTestId('treatment-drawer-session-increase'),
    ).toBeDisabled();
  });

  it('logs a check-in from an edit: ⚡ "Log check-in" stacks the aftercare check-in, Back returns', async () => {
    const { user, drawer } = await openEdit();
    await user.click(within(drawer).getByTestId('treatment-drawer-quick-fill-check-in'));
    const checkIn = await screen.findByTestId('check-in-drawer');
    // The aftercare check-in follows the session and is taken at no visit.
    expect(checkIn).toHaveAttribute('data-treatment', TEST_TREATMENT_ID);
    expect(checkIn).toHaveAttribute('data-appointment', 'none');
    expect(checkIn).toHaveAttribute('data-stacked', 'true');
    // The stand-in sits outside the drawer's focus layer, which turns pointer events off there.
    fireEvent.click(within(checkIn).getByTestId('check-in-drawer-dismiss'));
    await waitFor(() =>
      expect(screen.queryByTestId('check-in-drawer')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('treatment-drawer')).toBeInTheDocument();
  });

  it('offers no "Log check-in" on a new treatment', async () => {
    const { drawer } = await openNew();
    expect(
      within(drawer).queryByTestId('treatment-drawer-quick-fill-check-in'),
    ).not.toBeInTheDocument();
  });

  it('reverses from the footer, after its reason', async () => {
    const { user, drawer, router } = await openEdit();
    await user.click(within(drawer).getByTestId('treatment-drawer-reverse'));
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-wrong-patient'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
    expect(world.treatments[0]).toMatchObject({ status: 'reversed' });
  });

  it('reads a reversed session only, with its reason', async () => {
    world.treatments = [
      treatmentRecord({
        status: 'reversed',
        reversedReason: 'Wrong patient',
        reversedAt: '2026-10-02T06:00:00.000Z',
      }),
    ];
    const { drawer } = await openEdit();
    expect(within(drawer).queryByTestId('treatment-drawer-save')).not.toBeInTheDocument();
    expect(
      within(drawer).queryByTestId('treatment-drawer-reverse'),
    ).not.toBeInTheDocument();
    // "Reversed 2 Oct · Wrong patient" — new copy (locales-C.json).
    expect(within(drawer).getByTestId('treatment-drawer-reversed')).toHaveTextContent(
      /Wrong patient|treatment\.reverse\.note/,
    );
  });

  it('reads only for a role without the treatment gate — the Front desk', async () => {
    const user = userEvent.setup();
    renderTreatments(url(`/${TEST_TREATMENT_ID}/edit`), {
      member: { role: 'front_desk' },
    });
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
