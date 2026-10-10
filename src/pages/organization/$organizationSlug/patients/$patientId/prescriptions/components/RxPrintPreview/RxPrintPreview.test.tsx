import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { patientRecord } from '@/tests/utils/patient-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import {
  prescriptionLine,
  prescriptionRecord,
  TEST_SHEET_CLINIC,
} from '../../__tests__/integration/prescription-doubles.ts';
import { RxPrintPreview } from './RxPrintPreview.tsx';
import type { RxSheet } from './use-rx-sheet.tsx';

const { printMock } = vi.hoisted(() => ({ printMock: vi.fn(() => Promise.resolve()) }));
vi.mock('@/shared/components/PrintTemplate/print-document.ts', () => ({
  printDocument: printMock,
  PRINTING_ATTRIBUTE: 'data-printing',
}));

/** Priya's Rx #497 (Sunscreen SPF 50), approved. */
const PRESCRIPTION = prescriptionRecord({
  seq: 497,
  status: 'approved',
  items: [prescriptionLine({ medicineName: 'Sunscreen SPF 50' })],
});
const SHEET: RxSheet = {
  ...TEST_SHEET_CLINIC,
  patient: patientRecord(),
  doctor: { firstName: 'Dr. Nisha Shah', lastName: null },
};

beforeEach(() => printMock.mockClear());

describe('RxPrintPreview (S:36; patient-file.md:301–315)', () => {
  it('shows the prescription’s sheet in the shared print preview, titled by its number', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { baseElement } = renderWithProviders(
      <RxPrintPreview prescription={PRESCRIPTION} sheet={SHEET} onClose={onClose} />,
    );
    const preview = await screen.findByTestId('rx-print-preview');
    expect(preview).toHaveTextContent('Print preview · Prescription #497');
    const sheet = await screen.findByTestId('prescription-print');
    expect(sheet).toHaveTextContent('Sunscreen SPF 50');
    expect(sheet).toHaveTextContent('Priya Shah');
    expect(sheet).toHaveTextContent('Dr. Nisha Shah');
    expect(sheet).toHaveTextContent('Cresence Skin Clinic');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
    await user.click(screen.getByTestId('rx-print-preview-print'));
    expect(printMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId('rx-print-preview-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
