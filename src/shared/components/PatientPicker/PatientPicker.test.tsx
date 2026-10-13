import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('@/shared/api/app/patient-search-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  searchPatientPicker: vi.fn(),
}));
vi.mock('@/shared/api/app/patients-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPatient: vi.fn(),
}));
vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchInvoiceTotals: vi.fn(),
}));
import i18n from '@/lib/i18n/i18n.ts';
import { fetchInvoiceTotals } from '@/shared/api/app/invoices-api.ts';
import {
  type PatientPickRow,
  searchPatientPicker,
} from '@/shared/api/app/patient-search-api.ts';
import { fetchPatient } from '@/shared/api/app/patients-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { patientRecord, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PATIENT_PICKER_NS } from './patient-picker.constants.ts';
import {
  type PatientPick,
  patientPickOf,
  patientPickOption,
} from './patient-picker-options.ts';
import { PatientPicker } from './PatientPicker.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const t = i18n.getFixedT('en', PATIENT_PICKER_NS);
const rupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

/** Kiran Desai as the search finds her. */
const KIRAN: PatientPickRow = {
  kind: 'patient',
  id: 'pat_kiran0000000000000000',
  contactId: 'con_kiran0000000000000000',
  seq: 3441,
  name: 'Kiran Desai',
  phone: '+919879122840',
  due: null,
};

/** The field as a form holds it: the id, and what the last pick handed back. */
function Field({ onPick }: { onPick: (patient: PatientPick | null) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <PatientPicker
      value={value}
      onChange={(patient) => {
        setValue(patient?.id ?? null);
        onPick(patient);
      }}
    />
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  viewport.tier = 'desktop';
  signInTestMember();
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

describe('patientPickOption (payments.md:101)', () => {
  it('words a patient with their id and mobile, and their dues once read', () => {
    expect(patientPickOption({ ...KIRAN, due: 8550 }, t, rupees)).toMatchObject({
      label: 'Kiran Desai',
      // Each part isolated, so the phone stays whole on a right-to-left page.
      sub: `${fsi('₹8,550 due')} · ${fsi('#3441')} · ${fsi('+91 98791 22840')}`,
      leading: { kind: 'avatar', initials: 'KD', patient: true },
    });
    expect(patientPickOption({ ...KIRAN, due: 0 }, t, rupees).sub).toBe(
      `${fsi('Nothing due')} · ${fsi('#3441')} · ${fsi('+91 98791 22840')}`,
    );
    expect(patientPickOption(KIRAN, t, rupees).sub).toBe(
      `${fsi('#3441')} · ${fsi('+91 98791 22840')}`,
    );
  });

  it('reads a patient on their own as the field’s row, with the contact a receipt names', () => {
    expect(patientPickOf(patientRecord(), 120)).toEqual({
      kind: 'patient',
      id: TEST_PATIENT_ID,
      contactId: patientRecord().contactId,
      seq: patientRecord().seq,
      name: 'Priya Shah',
      phone: patientRecord().phone,
      due: 120,
    });
  });
});

describe('PatientPicker', () => {
  it('searches the patients, hands back the one picked, and shows what they owe', async () => {
    vi.mocked(searchPatientPicker).mockResolvedValue({
      items: [KIRAN],
      nextCursor: null,
    });
    vi.mocked(fetchPatient).mockResolvedValue(
      patientRecord({ id: KIRAN.id, seq: 3441, name: 'Kiran Desai', firstName: 'Kiran' }),
    );
    vi.mocked(fetchInvoiceTotals).mockResolvedValue({ due: 8550, paid: 1200 });
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const onPick = vi.fn();
    const { container } = renderWithProviders(<Field onPick={onPick} />);
    const trigger = await screen.findByTestId('patient-picker');
    expect(trigger).toHaveTextContent('Search patients');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(trigger);
    await user.type(await screen.findByTestId('patient-picker-search'), 'Kiran');
    const optionId = `patient-picker-option-${KIRAN.id}`;
    const option = await screen.findByTestId(optionId);
    expect(within(option).getByText('Kiran Desai')).toBeInTheDocument();
    // The search's answer can re-render the list between the find and the click (a slow
    // run) — click the current option until the pick arrives.
    await waitFor(async () => {
      if (onPick.mock.calls.length === 0) await user.click(screen.getByTestId(optionId));
      expect(onPick).toHaveBeenCalledWith(KIRAN);
    });
    await waitFor(() => expect(trigger).toHaveTextContent('Kiran Desai'));
    expect(searchPatientPicker).toHaveBeenCalled();
    expect(fetchInvoiceTotals).toHaveBeenCalledWith({ patientId: KIRAN.id });
  });
});
