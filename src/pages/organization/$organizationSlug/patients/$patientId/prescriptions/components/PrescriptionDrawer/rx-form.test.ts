import { describe, expect, it } from 'vitest';

import type { PrescriptionItem } from '@/shared/api/app/app-schema.ts';
import type { PrescriptionRecord } from '@/shared/api/app/prescriptions-contracts.ts';

import { prescriptionRecord } from '../../__tests__/integration/prescription-doubles.ts';
import {
  emptyRxLine,
  initialRxForm,
  namedRxLines,
  newRxForm,
  rxCountOf,
  rxDaysIn,
  rxDoseOf,
  rxFieldsOf,
  rxFormLineOf,
  rxFormOf,
  rxFormWithMedicines,
  rxItemOf,
  rxLineFor,
  rxQtyFor,
  steppedRxLines,
  typedValue,
  withRxLine,
} from './rx-form.ts';

function item(fields: Partial<PrescriptionItem> = {}): PrescriptionItem {
  return {
    medicineId: null,
    medicineName: 'Flubolt 400',
    doseMorning: 0,
    doseAfternoon: 0,
    doseNight: 1,
    sos: false,
    meal: 'after',
    timing: null,
    timingText: null,
    bodyPart: null,
    bodyPartText: null,
    qty: 8,
    remarks: null,
    ...fields,
  };
}

const daysNote = (days: number) => `${days} days`;

describe('a line ↔ the contract’s item', () => {
  it('turns taps, a meal and a listed place round', () => {
    const saved = item({ bodyPart: 'scalp', remarks: '1 sun, 1 thu' });
    const line = rxFormLineOf(saved);
    expect(line).toEqual({
      medicineId: null,
      medicineName: 'Flubolt 400',
      dose: '0-0-1',
      when: 'after',
      where: 'scalp',
      qty: 8,
      remarks: '1 sun, 1 thu',
    });
    expect(rxItemOf(line)).toEqual(saved);
  });

  it('keeps SOS, a timing and a place the contract lacks as other + its name', () => {
    const line = {
      ...emptyRxLine(),
      medicineName: 'Clonix-B',
      dose: 'sos',
      when: 'morning_night',
      where: 'neck',
    };
    expect(rxItemOf(line)).toMatchObject({
      doseMorning: 0,
      doseNight: 0,
      sos: true,
      meal: null,
      timing: 'morning_night',
      bodyPart: 'other',
      bodyPartText: 'Neck',
    });
    expect(rxFormLineOf(rxItemOf(line))).toMatchObject({
      dose: 'sos',
      when: 'morning_night',
      where: 'neck',
    });
  });

  it('keeps a typed timing and a typed place as text', () => {
    const line = {
      ...emptyRxLine(),
      medicineName: 'Kojic gel',
      when: typedValue('After dinner'),
      where: typedValue('Elbows'),
    };
    const saved = rxItemOf(line);
    expect(saved).toMatchObject({
      timingText: 'After dinner',
      bodyPart: 'other',
      bodyPartText: 'Elbows',
    });
    expect(rxFormLineOf(saved)).toMatchObject({
      when: 'text:After dinner',
      where: 'text:Elbows',
    });
  });

  it('reads no dose from blank taps', () => {
    expect(rxDoseOf('')).toBeUndefined();
    expect(rxFormLineOf(item({ doseNight: 0, meal: null })).dose).toBe('');
  });
});

describe('the form', () => {
  it('opens a new prescription on today with one blank line', () => {
    expect(newRxForm('2026-10-03', 'dr')).toMatchObject({
      date: '2026-10-03',
      doctorId: 'dr',
      items: [emptyRxLine()],
    });
  });

  it('opens a saved one with its lines and notes', () => {
    const rx = prescriptionRecord({
      date: '2026-09-24',
      doctorId: 'dr',
      items: [item()],
      advice: 'Avoid sun 48h',
      labReport: null,
      procedureToday: 'Chemical peel',
    });
    expect(rxFormOf(rx)).toMatchObject({
      items: [{ medicineName: 'Flubolt 400' }],
      advice: 'Avoid sun 48h',
      labReport: '',
      procedureToday: 'Chemical peel',
    });
  });

  it('sends the named lines only, blanks as null', () => {
    const values = {
      ...newRxForm('2026-10-03', 'dr'),
      items: [
        { ...emptyRxLine(), medicineName: ' Epriva Tab ', dose: '1-0-1' },
        emptyRxLine(),
      ],
      advice: '  ',
      labReport: 'CBC',
    };
    const input = rxFieldsOf(values);
    expect(input.items).toHaveLength(1);
    expect(input.items[0]).toMatchObject({
      medicineName: 'Epriva Tab',
      doseMorning: 1,
      doseNight: 1,
    });
    expect(input).toEqual({
      doctorId: 'dr',
      date: '2026-10-03',
      items: [expect.objectContaining({ medicineName: 'Epriva Tab' })],
      advice: null,
      labReport: 'CBC',
      procedureToday: null,
    });
    expect(namedRxLines(values.items)).toHaveLength(1);
  });
});

describe('a new prescription from a smart note (AMBER A-F5)', () => {
  const catalog = [{ name: 'Flubolt 400', medicineId: 'm-1', last: item() }];

  it('opens with a line for each medicine named — the store’s, else as written', () => {
    const form = rxFormWithMedicines(
      newRxForm('2026-10-03', 'dr'),
      ['flubolt 400', 'Clonix-B Lotion'],
      catalog,
    );
    expect(form.items).toHaveLength(2);
    expect(form.items[0]).toMatchObject({
      medicineName: 'Flubolt 400',
      medicineId: 'm-1',
      dose: '0-0-1',
      qty: 8,
    });
    expect(form.items[1]).toMatchObject({
      medicineName: 'Clonix-B Lotion',
      medicineId: null,
    });
  });

  it('starts an edit from its prescription, a new one from the smart note', () => {
    const rx = prescriptionRecord({ items: [item({ medicineName: 'Epriva Tab' })] });
    const opened = (prescription: PrescriptionRecord | null) =>
      initialRxForm({
        prescription,
        today: '2026-10-03',
        doctorId: 'dr',
        medicines: ['Flubolt 400'],
        catalog,
      }).items.map((line) => line.medicineName);
    expect(opened(rx)).toEqual(['Epriva Tab']);
    expect(opened(null)).toEqual(['Flubolt 400']);
  });
});

describe('quantities from the note', () => {
  it('reads days in English shorthand and in the drawer’s own words', () => {
    expect(rxDaysIn('10 days, apply thin layer')).toBe(10);
    expect(rxDaysIn('for 5d')).toBe(5);
    expect(rxDaysIn('10 Tage', ['Tag', 'Tage'])).toBe(10);
    expect(rxDaysIn('10 dosage')).toBeNull();
    expect(rxDaysIn('avoid sun')).toBeNull();
  });

  it('multiplies days by the doses a day, never for SOS or without days', () => {
    expect(rxQtyFor('1-0-1', '10 days')).toBe(20);
    expect(rxQtyFor('sos', '10 days')).toBeNull();
    expect(rxQtyFor('1-0-1', 'after food')).toBeNull();
    expect(rxQtyFor('2-2-2', '999 days')).toBe(999);
  });
});

describe('adding a medicine', () => {
  const flubolt = { name: 'Flubolt 400', medicineId: null, last: item() };

  it('takes the patient’s last line, and the shorthand over it', () => {
    expect(rxLineFor(flubolt, {}, daysNote)).toMatchObject({
      dose: '0-0-1',
      when: 'after',
      qty: 8,
      remarks: '',
    });
    expect(
      rxLineFor(
        flubolt,
        {
          dose: [1, 0, 1],
          when: { kind: 'timing', timing: 'night' },
          where: 'face',
          days: 5,
          qty: 10,
        },
        daysNote,
      ),
    ).toMatchObject({
      dose: '1-0-1',
      when: 'night',
      where: 'face',
      qty: 10,
      remarks: '5 days',
    });
  });

  it('fills the first blank row, or comes last', () => {
    const line = rxLineFor(flubolt, {}, daysNote);
    expect(withRxLine([emptyRxLine()], line)).toEqual([line]);
    expect(withRxLine([line], line)).toHaveLength(2);
  });

  it('steps a medicine up and down from Browse, keeping one blank row', () => {
    const added = steppedRxLines([emptyRxLine()], flubolt, 1, daysNote);
    expect(rxCountOf(added, 'Flubolt 400')).toBe(8);
    const more = steppedRxLines(added, flubolt, 1, daysNote);
    expect(rxCountOf(more, 'Flubolt 400')).toBe(9);
    const one = steppedRxLines(
      [{ ...emptyRxLine(), medicineName: 'Flubolt 400' }],
      flubolt,
      -1,
      daysNote,
    );
    expect(one).toEqual([emptyRxLine()]);
    expect(steppedRxLines([emptyRxLine()], flubolt, -1, daysNote)).toEqual([
      emptyRxLine(),
    ]);
  });
});
