import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';

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
const packagesOf = () =>
  clinicFixtures.patientPackages.snapshot((row) => row.patientId === DHARTI);
/** The first offering Add package lists: active, more than one session, catalogue order. */
const firstPackage = () =>
  clinicFixtures.offerings.snapshot(
    (offering) => offering.active && offering.sessions > 1,
  )[0];

async function openAdd(role: 'front_desk' | 'admin' = 'front_desk') {
  const user = userEvent.setup();
  const view = renderPatientFile(patientFileUrl(DHARTI, '/packages'), { role });
  await user.click(await screen.findByTestId('patient-section-primary'));
  const drawer = await screen.findByTestId('package-drawer');
  return { ...view, user, drawer };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('Add package (KICKOFF §6.6; A-F6)', () => {
  it('lists the multi-session offerings with sessions and price', async () => {
    const { drawer, baseElement } = await openAdd();
    expect(within(drawer).getByTestId('package-drawer-title')).toHaveTextContent(
      'Add package',
    );
    expect(drawer).toHaveTextContent('Dharti Galani');
    expect(drawer).toHaveTextContent('Pick a package');
    const offering = firstPackage();
    expect(offering).toBeDefined();
    const chip = await within(drawer).findByTestId(
      `package-drawer-offering-${offering?.id ?? ''}`,
    );
    expect(chip).toHaveTextContent(
      new RegExp(`^${offering?.name ?? ''} · ${offering?.sessions ?? 0}s · ₹`),
    );
    expect(within(drawer).getByTestId('package-drawer-summary')).toHaveTextContent(
      'Sessions are counted when a treatment is completed',
    );
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('asks for a package before it adds one', async () => {
    const { user, drawer } = await openAdd();
    const before = packagesOf().length;
    await user.click(within(drawer).getByTestId('package-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Pick a package');
    expect(packagesOf()).toHaveLength(before);
  });

  it('adds the package with no invoice yet and closes', async () => {
    const { user, drawer } = await openAdd();
    const offering = firstPackage();
    const before = packagesOf().length;
    await user.click(
      await within(drawer).findByTestId(`package-drawer-offering-${offering?.id ?? ''}`),
    );
    await user.click(within(drawer).getByTestId('package-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Package added · invoice it from Invoices',
      ),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('package-drawer')).not.toBeInTheDocument(),
    );
    expect(packagesOf()).toHaveLength(before + 1);
    expect(packagesOf().find((row) => row.offeringId === offering?.id)).toMatchObject({
      invoiceId: null,
      sessionsUsed: 0,
      sessionsTotal: offering?.sessions,
    });
  });

  it('offers no "Add package" to a member who cannot create patients', async () => {
    renderPatientFile(patientFileUrl(DHARTI, '/packages'), { role: 'therapist' });
    expect(await screen.findByTestId('patient-section-packages')).toBeInTheDocument();
    expect(screen.queryByTestId('patient-section-primary')).not.toBeInTheDocument();
  });
});
