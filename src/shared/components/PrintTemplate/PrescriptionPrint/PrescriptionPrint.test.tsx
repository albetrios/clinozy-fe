import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type {
  Prescription,
  PrescriptionItem,
} from '@/shared/api/clinic/clinic-schema.ts';
import {
  clinicFixtures,
  clinicOrganization,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { PRINT_TEMPLATE_TEST_IDS } from '@/shared/components/PrintTemplate/print-template.constants.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { PrescriptionPrint, type PrescriptionPrintProps } from './PrescriptionPrint.tsx';

/** The fixture records behind one printed prescription, as a screen would pass them. */
function propsFor(
  seq: number,
  overrides: Partial<Prescription> = {},
): PrescriptionPrintProps {
  const found = clinicFixtures.prescriptions.snapshot((row) => row.seq === seq)[0];
  if (!found) throw new Error(`Rx #${seq}`);
  const prescription = { ...found, ...overrides };
  const patient = clinicFixtures.patients.snapshot(
    (row) => row.id === prescription.patientId,
  )[0];
  const branch = clinicFixtures.branches.snapshot((row) => row.isMain)[0];
  if (!(patient && branch)) throw new Error(`records of Rx #${seq}`);
  return {
    prescription,
    patient,
    doctor:
      clinicFixtures.staff.snapshot((row) => row.id === prescription.doctorId)[0] ?? null,
    organization: clinicOrganization(),
    branch,
  };
}

const line = (overrides: Partial<PrescriptionItem>): PrescriptionItem => ({
  medicineId: null,
  medicineName: 'Tretinoin 0.025% cream 20 g',
  doseMorning: 0,
  doseAfternoon: 0,
  doseNight: 0,
  sos: false,
  meal: null,
  timing: null,
  timingText: null,
  bodyPart: null,
  bodyPartText: null,
  qty: 1,
  remarks: null,
  ...overrides,
});

const field = (label: string) => screen.getByText(label).nextElementSibling;

/** Each row of the medicines table as its cells' text. */
function tableRows() {
  return within(screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.prescriptionItems))
    .getAllByRole('row')
    .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent));
}

describe('PrescriptionPrint', () => {
  beforeEach(() => {
    // On the prototype's own day, so every seed carries the prototype's dates.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-27T06:30:00Z'));
    resetClinicFixtures();
    useLocaleStore.setState({ formatLocale: 'en-IN' });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetClinicFixtures();
    useLocaleStore.setState({ formatLocale: 'en-US' });
  });

  it('prints the patient and the prescription details (H:457–468)', () => {
    render(<PrescriptionPrint {...propsFor(500)} />);
    expect(screen.getByText('Patient Information')).toBeInTheDocument();
    expect(field('Name:')).toHaveTextContent('Arpita Kachhadiya');
    expect(field('Patient ID:')).toHaveTextContent('PT-3499');
    // Born 17 Jul 1998: 28 on the prescription's day.
    expect(field('Age:')).toHaveTextContent('28 years');
    expect(screen.getByText('Prescription Details')).toBeInTheDocument();
    expect(field('Date:')).toHaveTextContent('17/09/2026');
    expect(field('Prescription #:')).toHaveTextContent('#500');
    expect(field('Doctor:')).toHaveTextContent('Dr. Drashti Moradiya');
  });

  it('prints each medicine with its dosage, when, where, quantity and remark (H:469–476)', () => {
    render(<PrescriptionPrint {...propsFor(500)} />);
    expect(screen.getByText('Medicines & Dosage')).toBeInTheDocument();
    expect(tableRows()).toEqual([
      ['Medicine', 'Dosage', 'When', 'Where', 'Qty.', 'Remark'],
      ['Flubolt 400', '0 - 0 - 1', 'After meal', '', '8', '1 sun, 1 thu'],
      ['Clonix-B Lotion', '', 'Morning & night', 'Scalp', '1', ''],
      ['Densyl-AD Shampoo', '', 'Thrice a week', '', '1', ''],
    ]);
  });

  it('spells out SOS, a meal with a timing, and a place of its own', () => {
    render(
      <PrescriptionPrint
        {...propsFor(500, {
          items: [
            line({
              doseMorning: 1,
              doseNight: 1,
              sos: true,
              meal: 'before',
              timing: 'night',
            }),
            line({
              bodyPart: 'other',
              bodyPartText: 'Under eyes',
              timingText: '10 days',
            }),
          ],
        })}
      />,
    );
    const [, first, second] = tableRows();
    expect(first?.slice(1, 4)).toEqual(['1 - 0 - 1 · SOS', 'Before meal · Night', '']);
    expect(second?.slice(1, 4)).toEqual(['', '10 days', 'Under eyes']);
  });

  it('prints the notes, greyed where there are none (H:478–489)', () => {
    render(<PrescriptionPrint {...propsFor(497)} />);
    expect(screen.getByText('No lab reports')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('Chemical peel')).not.toHaveClass('text-muted-foreground');
    expect(screen.getByText('Avoid sun 48h')).not.toHaveClass('text-muted-foreground');
  });

  it('says so when there is no advice, procedure or follow-up', () => {
    render(<PrescriptionPrint {...propsFor(500)} />);
    expect(screen.getByText('No additional advice')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('No procedures')).toHaveClass('text-muted-foreground');
    expect(field('Follow-up Date:')).toHaveTextContent('Not scheduled');
  });

  it('prints the follow-up date and leaves space for the signature (H:491–503)', () => {
    render(<PrescriptionPrint {...propsFor(500, { followUpDate: '2026-10-12' })} />);
    expect(field('Follow-up Date:')).toHaveTextContent('12/10/2026');
    expect(screen.getByText("Doctor's Signature")).toBeInTheDocument();
    expect(screen.getByText("Doctor's signature here")).toHaveClass(
      'text-muted-foreground',
    );
  });

  it("leaves age and doctor blank when they aren't known", () => {
    const props = propsFor(500);
    render(
      <PrescriptionPrint
        {...props}
        patient={{ ...props.patient, dateOfBirth: null }}
        doctor={null}
      />,
    );
    expect(field('Age:')).toHaveTextContent('—');
    expect(field('Doctor:')).toHaveTextContent('—');
  });

  it("prints the clinic's footer from the organization and the branch (H:510–511)", () => {
    render(<PrescriptionPrint {...propsFor(500)} />);
    const footer = screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.footer);
    expect(footer).toHaveTextContent(
      'Thank you for choosing Cresence Skin for your skin care needs',
    );
    expect(footer).toHaveTextContent(
      'For any queries, please contact us at +91 74900 20099',
    );
    expect(footer).toHaveTextContent('GSTIN 24AAKFC4821M1Z6');
  });

  it('has no axe violations', async () => {
    const { container } = render(<PrescriptionPrint {...propsFor(500)} />);
    vi.useRealTimers();
    expect(await axe(container)).toHaveNoViolations();
  });
});
