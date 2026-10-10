import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { patientFile, patientRecord } from '@/tests/utils/patient-doubles.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';
import { PatientPaymentsPage } from './PatientPaymentsPage.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const DHARTI = patientRef('Dharti Galani');

/**
 * The Payments section in the patient file. Its records are still the fixture world's
 * (Payments, api-integration §5.7), so the file's read names a fixture patient.
 */
function renderSection(patientId: string, { role }: { role?: Role } = {}) {
  return renderInPatientFile(<PatientPaymentsPage />, {
    file: patientFile({ patient: patientRecord({ id: patientId }) }),
    section: 'payments',
    role,
  });
}

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('PatientPaymentsPage', () => {
  it('renders the Payments section in the patient file', async () => {
    renderSection(DHARTI);
    expect(await screen.findByTestId('patient-section-payments')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Payments' }),
    ).toBeInTheDocument();
  });

  it('lists her receipts — the receipt, its invoice, the mode and the signed amount (H:4751)', async () => {
    renderSection(DHARTI);
    const [row] = await screen.findAllByTestId('patient-payments-table-row');
    if (!row) throw new Error('no row');
    expect(within(row).getAllByText('PAY-5505').length).toBeGreaterThan(0);
    expect(within(row).getAllByText('#782').length).toBeGreaterThan(0);
    expect(within(row).getAllByText('UPI').length).toBeGreaterThan(0);
    expect(within(row).getByText('+ ₹9,000')).toBeInTheDocument();
    expect(within(row).getAllByText('Riya S.').length).toBeGreaterThan(0);
    expect(screen.getByText('1 transaction')).toBeInTheDocument();
    expect(screen.getByText('All transactions loaded')).toBeInTheDocument();
  });

  it('says so when the patient has paid nothing', async () => {
    renderSection(patientRef('Kavya Joshi'));
    expect(await screen.findByText('No payments yet')).toBeInTheDocument();
  });
});
