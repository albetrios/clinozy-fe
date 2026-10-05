import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Prescription } from '@/shared/api/clinic/clinic-schema.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import {
  fetchRxSheetContext,
  type RxSheetContext,
} from '@/shared/api/clinic/prescriptions-api.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { RxPrintPreview } from './RxPrintPreview.tsx';

const { printMock } = vi.hoisted(() => ({ printMock: vi.fn(() => Promise.resolve()) }));
vi.mock('@/shared/components/PrintTemplate/print-document.ts', () => ({
  printDocument: printMock,
  PRINTING_ATTRIBUTE: 'data-printing',
}));

/** Dharti's Rx #497 (Sunscreen SPF 50). */
let prescription: Prescription;
let sheet: RxSheetContext;

beforeEach(async () => {
  resetClinicFixtures();
  printMock.mockClear();
  prescription = await clinicFixtures.prescriptions.get(ref.prescription(497));
  sheet = await fetchRxSheetContext(prescription.patientId, prescription.doctorId);
});
afterEach(() => resetClinicFixtures());

describe('RxPrintPreview (S:36; patient-file.md:301–315)', () => {
  it('shows the prescription’s sheet in the shared print preview, titled by its number', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { baseElement } = renderWithProviders(
      <RxPrintPreview prescription={prescription} sheet={sheet} onClose={onClose} />,
    );
    const preview = await screen.findByTestId('rx-print-preview');
    expect(preview).toHaveTextContent('Print preview · Prescription #497');
    expect(await screen.findByTestId('prescription-print')).toHaveTextContent(
      'Sunscreen SPF 50',
    );
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
    await user.click(screen.getByTestId('rx-print-preview-print'));
    expect(printMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId('rx-print-preview-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
