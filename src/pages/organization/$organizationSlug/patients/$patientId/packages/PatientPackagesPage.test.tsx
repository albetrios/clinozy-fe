import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as PackagesApiModule from '@/shared/api/clinic/patient-packages-api.ts';
import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-contracts.ts';
import type * as PlanApiModule from '@/shared/api/clinic/plan-api.ts';
import {
  patientFile,
  TEST_CONTACT_ID,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));

/** What the member may do: book (`appointment:create`), edit a package (`payment:update`). */
const access = vi.hoisted(() => ({ book: true, codes: new Set<string>() }));
vi.mock('@/shared/hooks/useClinicAccess/index.ts', () => ({
  useClinicAccess: () => ({
    roles: ['admin'],
    previewRole: null,
    can: (section: string) => section !== 'appointments' || access.book,
    canAbility: () => true,
    canCode: (code: string) => access.codes.has(code),
    viewableSections: [],
    isResolved: true,
  }),
}));

vi.mock('@/shared/api/clinic/patient-packages-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PackagesApiModule>()),
  listPatientPackages: vi.fn(),
  updatePatientPackage: vi.fn(),
}));
vi.mock('@/shared/api/clinic/plan-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PlanApiModule>()),
  fetchPlanOfferings: vi.fn(),
}));

import { listPatientPackages } from '@/shared/api/clinic/patient-packages-api.ts';
import { fetchPlanOfferings } from '@/shared/api/clinic/plan-api.ts';

import { PatientPackagesPage } from './PatientPackagesPage.tsx';

/** Priya's LHR Full Face: 1 of 7 used, valid a year. */
const LHR: PatientPackageRow = {
  id: 'poff_lhr0000000000000000000',
  offeringId: 'off_lhr00000000000000000000',
  name: 'LHR Full Face · B4G7',
  sessionsTotal: 7,
  sessionsUsed: 1,
  sessionsLeft: 6,
  status: 'active',
  validUntil: '2027-09-24',
  invoiceId: 'invc_one0000000000000000000',
  createdAt: '2026-09-24T05:00:00.000Z',
  updatedAt: '2026-09-24T05:00:00.000Z',
};
const PEEL: PatientPackageRow = {
  ...LHR,
  id: 'poff_peel000000000000000000',
  offeringId: 'off_gone',
  name: 'Peel · 3',
  sessionsTotal: 3,
  sessionsUsed: 3,
  sessionsLeft: 0,
  status: 'used_up',
  validUntil: null,
};

const card = (row: PatientPackageRow) => screen.findByTestId(`patient-package-${row.id}`);

function renderPackages() {
  return renderInPatientFile(<PatientPackagesPage />, {
    file: patientFile(),
    section: 'packages',
  });
}

beforeEach(() => {
  access.book = true;
  access.codes = new Set(['payment:update']);
  vi.mocked(listPatientPackages).mockResolvedValue([LHR, PEEL]);
  vi.mocked(fetchPlanOfferings).mockResolvedValue([
    {
      id: LHR.offeringId,
      name: 'LHR Full Face · B4G7',
      category: 'package',
      tone: 'blush',
      sessions: 7,
      price: 4800,
      offerPrice: null,
      minPrice: null,
      isActive: true,
    },
  ]);
});
afterEach(() => {
  resetPatientFile();
  vi.resetAllMocks();
});

describe('PatientPackagesPage', () => {
  it('renders the Packages section with no "Add package" (G4)', async () => {
    renderPackages();
    expect(await screen.findByTestId('patient-section-packages')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Packages' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add package/ })).not.toBeInTheDocument();
    expect(listPatientPackages).toHaveBeenCalledWith(TEST_PATIENT_ID);
  });

  it('shows each package as the server counts it — left, used, until when', async () => {
    renderPackages();
    const lhr = await card(LHR);
    expect(within(lhr).getByText('LHR Full Face · B4G7')).toBeInTheDocument();
    expect(within(lhr).getByText('6 left')).toBeInTheDocument();
    expect(within(lhr).getByText('1 of 7 used')).toBeInTheDocument();
    expect(within(lhr).getByText(/^Valid till /)).toBeInTheDocument();
    expect(lhr).toHaveAttribute('data-status', 'active');
    // "Use a session" goes — a recorded treatment spends one (§6 #20).
    expect(within(lhr).queryByText('Use a session')).not.toBeInTheDocument();
  });

  it('names a package past use by the server’s status, and one without an end', async () => {
    renderPackages();
    const peel = await card(PEEL);
    expect(peel).toHaveAttribute('data-status', 'used_up');
    expect(within(peel).getByText('0 left')).toBeInTheDocument();
    // Nothing left to book; still editable (a refund, a correction).
    expect(
      screen.queryByTestId(`patient-package-${PEEL.id}-book`),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId(`patient-package-${PEEL.id}-edit`)).toBeInTheDocument();
    expect(peel).toHaveTextContent('No expiry');
    expect(peel).toHaveTextContent('Used up');
  });

  it('books the next visit for the person, keeping the section behind the form', async () => {
    const user = userEvent.setup();
    const { router } = renderPackages();
    await user.click(await screen.findByTestId(`patient-package-${LHR.id}-book`));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/appointments/create',
      ),
    );
    expect(shownLocation(router).search).toEqual({
      who: TEST_CONTACT_ID,
      from: `patients/${TEST_PATIENT_ID}/packages`,
    });
  });

  it('opens Edit package for a member who may change payments', async () => {
    const user = userEvent.setup();
    renderPackages();
    await user.click(await screen.findByTestId(`patient-package-${LHR.id}-edit`));
    const drawer = await screen.findByTestId('package-drawer');
    expect(drawer).toHaveTextContent('LHR Full Face · B4G7');
  });

  it('leaves a member without those codes the cards alone', async () => {
    access.book = false;
    access.codes = new Set();
    renderPackages();
    expect(await card(LHR)).toBeInTheDocument();
    expect(
      screen.queryByTestId(`patient-package-${LHR.id}-book`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`patient-package-${LHR.id}-edit`),
    ).not.toBeInTheDocument();
  });

  it('says so when the patient has no packages', async () => {
    vi.mocked(listPatientPackages).mockResolvedValue([]);
    renderPackages();
    expect(await screen.findByText('No packages yet')).toBeInTheDocument();
  });

  it('stands a failed read in with Retry, which reads again', async () => {
    const user = userEvent.setup();
    vi.mocked(listPatientPackages).mockRejectedValueOnce(new Error('down'));
    renderPackages();
    await user.click(await screen.findByTestId('retry-button'));
    expect(await card(LHR)).toBeInTheDocument();
    expect(listPatientPackages).toHaveBeenCalledTimes(2);
  });

  it('has no axe violations', async () => {
    const { container } = renderPackages();
    await card(LHR);
    expect(await axe(container)).toHaveNoViolations();
  });
});
