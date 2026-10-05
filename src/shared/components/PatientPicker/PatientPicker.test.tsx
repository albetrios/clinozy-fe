import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PATIENT_PICKER_NS } from './patient-picker.constants.ts';
import { type PatientPick, patientPickOption } from './patient-picker-options.ts';
import { PatientPicker } from './PatientPicker.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const t = i18n.getFixedT('en', PATIENT_PICKER_NS);
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

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
  viewport.tier = 'desktop';
  resetClinicFixtures();
});
afterEach(() => resetClinicFixtures());

describe('patientPickOption (payments.md:101)', () => {
  it('words a patient with their dues, id and mobile, a lead greyed out', () => {
    expect(
      patientPickOption(
        {
          kind: 'patient',
          id: 'p',
          seq: 3441,
          name: 'Kiran Desai',
          phone: '+919879122840',
          due: 855_000,
        },
        t,
        rupees,
      ),
    ).toMatchObject({
      label: 'Kiran Desai',
      // Each part isolated, so the phone stays whole on a right-to-left page.
      sub: `${fsi('₹8,550 due')} · ${fsi('#3441')} · ${fsi('+91 98791 22840')}`,
      leading: { kind: 'avatar', initials: 'KD', patient: true },
    });
    expect(
      patientPickOption(
        {
          kind: 'patient',
          id: 'p',
          seq: 3508,
          name: 'Dharti Galani',
          phone: null,
          due: 0,
        },
        t,
        rupees,
      ).sub,
    ).toBe(`${fsi('Nothing due')} · ${fsi('#3508')}`);
    expect(
      patientPickOption(
        { kind: 'lead', id: 'l', seq: 2363, name: 'Viral Sheth' },
        t,
        rupees,
      ),
    ).toMatchObject({ sub: `Lead ${fsi('#2363')} · not a patient yet`, disabled: true });
  });
});

describe('PatientPicker', () => {
  it('searches the patients and hands back the one picked', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const onPick = vi.fn();
    const { container } = renderWithProviders(<Field onPick={onPick} />);
    const trigger = await screen.findByTestId('patient-picker');
    expect(trigger).toHaveTextContent('Search patients');
    expect(await axe(container)).toHaveNoViolations();
    await user.click(trigger);
    await user.type(await screen.findByTestId('patient-picker-search'), 'Rhea');
    const option = await screen.findByTestId(
      `patient-picker-option-${patientRef('Rhea Shah')}`,
    );
    expect(within(option).getByText('Rhea Shah')).toBeInTheDocument();
    await user.click(option);
    await waitFor(() =>
      expect(onPick).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'patient', name: 'Rhea Shah' }),
      ),
    );
    await waitFor(() => expect(trigger).toHaveTextContent('Rhea Shah'));
  });

  it('shows a lead that is not a patient yet, and never takes it', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const [lead] = clinicFixtures.leads.snapshot(
      (row) =>
        row.patientId === null && row.kind !== 'contact_thread' && !row.isContactThread,
    );
    if (!lead) throw new Error('the seed has a lead that is not a patient');
    const onPick = vi.fn();
    renderWithProviders(<Field onPick={onPick} />);
    await user.click(await screen.findByTestId('patient-picker'));
    await user.type(await screen.findByTestId('patient-picker-search'), lead.name);
    const option = await screen.findByTestId(`patient-picker-option-${lead.id}`);
    expect(option).toHaveAttribute('aria-disabled', 'true');
    await user.click(option);
    expect(onPick).not.toHaveBeenCalled();
  });
});
