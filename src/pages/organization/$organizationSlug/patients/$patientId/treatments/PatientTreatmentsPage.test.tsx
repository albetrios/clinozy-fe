import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as DirectoryApiModule from '@/shared/api/clinic/directory-api.ts';
import type * as OfferingsApiModule from '@/shared/api/clinic/offerings-api.ts';
import type * as PatientPackagesApiModule from '@/shared/api/clinic/patient-packages-api.ts';
import type * as TreatmentsApiModule from '@/shared/api/clinic/treatments-api.ts';
import { createTreatment, reverseTreatment } from '@/shared/api/clinic/treatments-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';
import { patientFile } from '@/tests/utils/patient-doubles.ts';

import {
  BOOKABLE_TREATMENTS,
  seededTreatmentsWorld,
  TEAM,
  TEST_PACKAGE_ID,
  TEST_TREATMENT_ID,
  treatmentRecord,
  type TreatmentsWorld,
} from './__tests__/integration/treatment-doubles.ts';
import {
  renderTreatments,
  resetTreatments,
  treatmentsUrl,
} from './__tests__/integration/treatments-test-router.tsx';

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

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const world = vi.hoisted(() => ({}) as TreatmentsWorld);
vi.mock('@/shared/api/clinic/treatments-api.ts', async (importOriginal) => {
  const { treatmentsApiDouble } =
    await import('./__tests__/integration/treatment-doubles.ts');
  return {
    ...(await importOriginal<typeof TreatmentsApiModule>()),
    ...treatmentsApiDouble(world),
  };
});
vi.mock('@/shared/api/clinic/patient-packages-api.ts', async (importOriginal) => {
  const { packagesApiDouble } =
    await import('./__tests__/integration/treatment-doubles.ts');
  return {
    ...(await importOriginal<typeof PatientPackagesApiModule>()),
    ...packagesApiDouble(world),
  };
});
vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OfferingsApiModule>()),
  fetchAllOfferings: vi.fn(async () =>
    BOOKABLE_TREATMENTS.map((treatment) => offeringRecord(treatment)),
  ),
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof DirectoryApiModule>()),
  fetchTeamDirectory: vi.fn(async () => TEAM),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(async () => TEAM[0]?.id ?? null),
}));

const FILE = patientFile();
const url = (rest = '') => treatmentsUrl(FILE, rest);
const action = (id: string) => `patient-treatments-row-action-${id}`;
const rows = () => screen.findAllByTestId('patient-treatments-table-row');

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  Object.assign(world, seededTreatmentsWorld());
});
afterEach(() => resetTreatments());

describe('PatientTreatmentsPage', () => {
  it('lists her sessions — the template, the area, the session and the latest check-in (H:4754)', async () => {
    const { container } = renderTreatments(url());
    const [row] = await rows();
    if (!row) throw new Error('no row');
    expect(screen.getByTestId('patient-section-treatments')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Treatments' }),
    ).toBeInTheDocument();
    expect(within(row).getByText('LHR Full Face')).toBeInTheDocument();
    expect(within(row).getByText('Skin · laser')).toBeInTheDocument();
    expect(within(row).getAllByText('Face').length).toBeGreaterThan(0);
    expect(within(row).getAllByText('#1').length).toBeGreaterThan(0);
    const feedback = await within(row).findByText('Better · 7/10');
    expect(feedback.closest('[title]')).toHaveAttribute(
      'title',
      expect.stringMatching(/^Check-in /),
    );
    expect(screen.getByText('1 treatment')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says so when there are no sessions yet', async () => {
    world.treatments = [];
    renderTreatments(url());
    expect(await screen.findByText('No treatments yet')).toBeInTheDocument();
  });

  it('says the read failed, in place, and reads again on Retry', async () => {
    world.failList = true;
    const user = userEvent.setup();
    renderTreatments(url());
    expect(await screen.findByTestId('retry-error')).toBeInTheDocument();
    world.failList = false;
    await user.click(screen.getByTestId('retry-button'));
    expect(await rows()).toHaveLength(1);
  });

  it('keeps a reversed session in the list, marked, with nothing to do but open it', async () => {
    world.treatments = [
      treatmentRecord({ status: 'reversed', reversedReason: 'Wrong patient' }),
    ];
    renderTreatments(url(), { member: { role: 'owner' } });
    const [row] = await rows();
    if (!row) throw new Error('no row');
    expect(within(row).getByTitle('Wrong patient')).toBeInTheDocument();
    expect(screen.queryByTestId(action('reverse'))).not.toBeInTheDocument();
    expect(screen.queryByTestId(action('copy'))).not.toBeInTheDocument();
  });

  it('opens Edit treatment from a row', async () => {
    const user = userEvent.setup();
    const { router } = renderTreatments(url());
    await rows();
    // The rows draw again as the member's access and the packages answer: click the row
    // on screen until the click lands.
    await waitFor(async () => {
      await user.click(screen.getByText('LHR Full Face'));
      expect(router.state.location.pathname).toBe(url(`/${TEST_TREATMENT_ID}/edit`));
    });
    expect(await screen.findByTestId('treatment-drawer')).toBeInTheDocument();
  });

  it('copies a session as the next one — the number the server gave it', async () => {
    const user = userEvent.setup();
    renderTreatments(url());
    await user.click(await screen.findByTestId(action('copy')));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Session 2 added'),
    );
    expect(vi.mocked(createTreatment).mock.lastCall?.[0]).toMatchObject({
      patientId: FILE.patient.id,
      input: { name: 'LHR Full Face', sessionNumber: 2, packageId: null },
    });
    await waitFor(async () => expect(await rows()).toHaveLength(2));
  });

  it('copies a package session onto its package, which numbers it', async () => {
    world.treatments = [
      treatmentRecord({ packageId: TEST_PACKAGE_ID, sessionNumber: 1 }),
    ];
    const user = userEvent.setup();
    renderTreatments(url());
    await user.click(await screen.findByTestId(action('copy')));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Session 2 added'),
    );
    expect(vi.mocked(createTreatment).mock.lastCall?.[0].input.packageId).toBe(
      TEST_PACKAGE_ID,
    );
  });

  it('logs a check-in for the session over the section', async () => {
    const user = userEvent.setup();
    const { router } = renderTreatments(url());
    await user.click(await screen.findByTestId(action('check-in')));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/patients/${FILE.patient.id}/check-ins/create`,
      ),
    );
    expect(router.state.location.search).toEqual({
      from: 'treatments',
      treatment: TEST_TREATMENT_ID,
    });
  });

  it('reverses a session with a reason — the row stays, marked, no Undo', async () => {
    const user = userEvent.setup();
    renderTreatments(url(), { member: { permissions: ['patient_treatment:update'] } });
    await user.click(await screen.findByTestId(action('reverse')));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'LHR Full Face',
    );
    await user.click(within(dialog).getByTestId('confirm-reason-other'));
    await user.type(within(dialog).getByTestId('confirm-note'), 'Booked twice');
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(reverseTreatment).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Booked twice' }),
      ),
    );
    expect(notifyMock.undo).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTitle('Booked twice')).toBeInTheDocument());
    expect(await rows()).toHaveLength(1);
  });

  it('gates by the member’s codes: create copies, update edits and reverses', async () => {
    renderTreatments(url(), { member: { permissions: ['patient_treatment:create'] } });
    expect(await screen.findByTestId(action('copy'))).toBeInTheDocument();
    expect(screen.queryByTestId(action('edit'))).not.toBeInTheDocument();
    expect(screen.queryByTestId(action('reverse'))).not.toBeInTheDocument();
  });

  it('leaves a role without the treatment gate the check-in only (View-as)', async () => {
    renderTreatments(url(), { member: { role: 'admin' } });
    expect(await screen.findByTestId(action('check-in'))).toBeInTheDocument();
    expect(screen.queryByTestId(action('copy'))).not.toBeInTheDocument();
    expect(screen.queryByTestId(action('edit'))).not.toBeInTheDocument();
    expect(screen.queryByTestId(action('reverse'))).not.toBeInTheDocument();
  });
});
