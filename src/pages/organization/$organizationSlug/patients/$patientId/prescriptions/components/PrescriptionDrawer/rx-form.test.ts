import { describe, expect, it } from 'vitest';

import type { PrescriptionItem } from '@/shared/api/app/app-schema.ts';
import type { PrescriptionRecord } from '@/shared/api/app/prescriptions-contracts.ts';

import { prescriptionRecord } from '../../__tests__/integration/prescription-doubles.ts';
import {
  emptyRxLine,
  firstRxStep,
  initialRxForm,
  namedRxLines,
  newRxForm,
  RX_DAY_CHIPS,
  RX_MOUTH_WHEN,
  RX_SKIN_WHEN,
  rxCountOf,
  rxDaysIn,
  rxDoseOf,
  rxDoubledDose,
  rxFieldsOf,
  rxFormLineOf,
  rxFormOf,
  rxFormWithMedicines,
  rxIsDoubled,
  rxIsSkinLine,
  rxItemOf,
  rxLineFor,
  rxLineSource,
  rxQtyFor,
  rxRemarksOf,
  rxSharedDays,
  rxSplitDays,
  rxStoreMedicineFor,
  rxToggledDose,
  rxTypedDays,
  steppedRxLines,
  typedValue,
  withRxDaysForAll,
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
      days: null,
      qty: 8,
      remarks: '1 sun, 1 thu',
    });
    expect(rxItemOf(line, daysNote)).toEqual(saved);
  });

  it('keeps SOS, a timing and a place the contract lacks as other + its name', () => {
    const line = {
      ...emptyRxLine(),
      medicineName: 'Clonix-B',
      dose: 'sos',
      when: 'morning_night',
      where: 'neck',
    };
    expect(rxItemOf(line, daysNote)).toMatchObject({
      doseMorning: 0,
      doseNight: 0,
      sos: true,
      meal: null,
      timing: 'morning_night',
      bodyPart: 'other',
      bodyPartText: 'Neck',
    });
    expect(rxFormLineOf(rxItemOf(line, daysNote))).toMatchObject({
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
    const saved = rxItemOf(line, daysNote);
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
    const input = rxFieldsOf(values, daysNote);
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
    expect(rxQtyFor('1-0-1', 10)).toBe(20);
    expect(rxQtyFor('sos', 10)).toBeNull();
    expect(rxQtyFor('1-0-1', null)).toBeNull();
    expect(rxQtyFor('', 10)).toBeNull();
    expect(rxQtyFor('2-2-2', 365)).toBe(999);
  });
});

describe('a line’s days (change-prescription-writing D3)', () => {
  it('splits a note’s leading days from the rest — in English and the drawer’s words', () => {
    expect(rxSplitDays('10 days, apply thin layer')).toEqual({
      days: 10,
      note: 'apply thin layer',
    });
    expect(rxSplitDays('7 days · avoid sun')).toEqual({ days: 7, note: 'avoid sun' });
    expect(rxSplitDays('5d')).toEqual({ days: 5, note: '' });
    expect(rxSplitDays('10 Tage', ['Tag', 'Tage'])).toEqual({ days: 10, note: '' });
  });

  it('keeps a note that does not start with days whole', () => {
    expect(rxSplitDays('apply for 5 days')).toEqual({
      days: null,
      note: 'apply for 5 days',
    });
    expect(rxSplitDays('2 drops')).toEqual({ days: null, note: '2 drops' });
    expect(rxSplitDays('0 days')).toEqual({ days: null, note: '0 days' });
    expect(rxSplitDays('')).toEqual({ days: null, note: '' });
  });

  it('opens a saved note’s days in Days and saves them back first', () => {
    const line = rxFormLineOf(item({ remarks: '10 days · apply thin layer' }));
    expect(line).toMatchObject({ days: 10, remarks: 'apply thin layer' });
    expect(rxItemOf(line, daysNote).remarks).toBe('10 days · apply thin layer');
    expect(rxRemarksOf({ days: 7, remarks: '' }, daysNote)).toBe('7 days');
    expect(rxRemarksOf({ days: null, remarks: ' avoid sun ' }, daysNote)).toBe(
      'avoid sun',
    );
    expect(rxItemOf({ ...line, days: null, remarks: '' }, daysNote).remarks).toBeNull();
  });

  it('reads days typed into the Days list, 1 to a year', () => {
    expect(rxTypedDays('12')).toBe(12);
    expect(rxTypedDays(' 12 days')).toBe(12);
    expect(rxTypedDays('0')).toBeNull();
    expect(rxTypedDays('400')).toBeNull();
    expect(rxTypedDays('days')).toBeNull();
    expect(RX_DAY_CHIPS).toEqual([3, 5, 7, 10, 14, 30]);
  });
});

describe('the dose chips (change-prescription-one-click D4)', () => {
  it('toggles a time on and off with one click, from any count or SOS', () => {
    expect(rxToggledDose('', 0)).toBe('1-0-0');
    expect(rxToggledDose('1-0-0', 2)).toBe('1-0-1');
    expect(rxToggledDose('1-0-1', 0)).toBe('0-0-1');
    expect(rxToggledDose('2-0-0', 0)).toBe('');
    expect(rxToggledDose('sos', 1)).toBe('0-1-0');
  });

  it('lights a new time with as many tablets as the lit ones take', () => {
    expect(rxToggledDose('2-0-0', 2)).toBe('2-0-2');
  });

  it('doubles every lit time with ×2, and halves it back', () => {
    expect(rxDoubledDose('1-0-1')).toBe('2-0-2');
    expect(rxDoubledDose('2-0-2')).toBe('1-0-1');
    expect(rxDoubledDose('2-0-1')).toBe('1-0-1');
    expect(rxDoubledDose('sos')).toBe('sos');
    expect(rxDoubledDose('')).toBe('');
    expect(rxIsDoubled('1-0-2')).toBe(true);
    expect(rxIsDoubled('1-0-1')).toBe(false);
    expect(rxIsDoubled('sos')).toBe(false);
  });
});

describe('the chips that fit a medicine (change-prescription-one-click D5)', () => {
  const medicines = [
    { name: 'Glycolac Cream', medicineId: 'med_glyco', form: 'topical' as const },
    { name: 'Doxycycline 100', medicineId: 'med_doxy', form: 'oral' as const },
  ];
  const line = (medicineName: string, medicineId: string | null = null) => ({
    medicineName,
    medicineId,
  });

  it('reads the store’s form, else the name', () => {
    expect(rxIsSkinLine(line('Glycolac Cream', 'med_glyco'), medicines)).toBe(true);
    expect(rxIsSkinLine(line('Doxycycline 100', 'med_doxy'), medicines)).toBe(false);
    expect(rxIsSkinLine(line('Kojic gel'), medicines)).toBe(true);
    expect(rxIsSkinLine(line('Septran DS'), medicines)).toBe(false);
  });

  it('offers the meal to a tablet and the time of day to the skin', () => {
    expect(RX_MOUTH_WHEN).toContain('after');
    expect(RX_SKIN_WHEN).toContain('night');
    expect(RX_SKIN_WHEN).not.toContain('after');
  });
});

describe('the same days for every line (change-prescription-one-click D6)', () => {
  const doxy = { ...emptyRxLine(), medicineName: 'Doxy', dose: '1-0-1', qty: 3 };
  const gel = { ...emptyRxLine(), medicineName: 'Gel', dose: '', qty: 1 };

  it('sets the course on every written line, the quantity following', () => {
    const lines = withRxDaysForAll([doxy, gel, emptyRxLine()], 7);
    expect(lines[0]).toMatchObject({ days: 7, qty: 14 });
    expect(lines[1]).toMatchObject({ days: 7, qty: 1 });
    expect(lines[2]).toEqual(emptyRxLine());
  });

  it('keeps the quantity of a line it is told to (a tube, change-prescription-one-line D11)', () => {
    const tube = { ...gel, dose: '0-0-1' };
    const lines = withRxDaysForAll([doxy, tube], 14, (item) => item === tube);
    expect(lines[0]).toMatchObject({ days: 14, qty: 28 });
    expect(lines[1]).toMatchObject({ days: 14, qty: 1 });
  });

  it('names the course the written lines share, else none', () => {
    expect(rxSharedDays(withRxDaysForAll([doxy, gel], 10))).toBe(10);
    expect(
      rxSharedDays([
        { ...doxy, days: 5 },
        { ...gel, days: 7 },
      ]),
    ).toBeNull();
    expect(rxSharedDays([emptyRxLine()])).toBeNull();
  });
});

describe('a line’s source — store or outside (change-prescription-writing D4)', () => {
  const medicines = [
    { name: 'Doxycycline 100', medicineId: 'med_doxy', stock: 24 },
    { name: 'Septran DS', medicineId: 'med_sep', stock: 0 },
    { name: 'Kojic Gel', medicineId: 'med_kojic', stock: null },
    { name: 'Acnestar', medicineId: null, stock: null },
  ];
  const line = (medicineName: string, medicineId: string | null) => ({
    medicineName,
    medicineId,
  });

  it('reads the store’s stock, out of stock, no stock read, outside and blank', () => {
    expect(rxLineSource(line('Doxycycline 100', 'med_doxy'), medicines)).toEqual({
      source: 'stocked',
      stock: 24,
    });
    expect(rxLineSource(line('Septran DS', 'med_sep'), medicines).source).toBe('empty');
    expect(rxLineSource(line('Kojic Gel', 'med_kojic'), medicines).source).toBe('store');
    expect(rxLineSource(line('Acnestar', null), medicines).source).toBe('outside');
    expect(rxLineSource(line(' ', null), medicines).source).toBe('none');
  });

  it('finds the store’s medicine an outside line names, never for a store line', () => {
    expect(
      rxStoreMedicineFor(line('doxycycline 100 ', null), medicines)?.medicineId,
    ).toBe('med_doxy');
    expect(rxStoreMedicineFor(line('Acnestar', null), medicines)).toBeUndefined();
    expect(
      rxStoreMedicineFor(line('Doxycycline 100', 'med_doxy'), medicines),
    ).toBeUndefined();
  });
});

describe('adding a medicine', () => {
  const flubolt = { name: 'Flubolt 400', medicineId: null, last: item() };

  it('takes the patient’s last line, and the shorthand over it', () => {
    expect(rxLineFor(flubolt, {})).toMatchObject({
      dose: '0-0-1',
      when: 'after',
      days: null,
      qty: 8,
      remarks: '',
    });
    expect(
      rxLineFor(flubolt, {
        dose: [1, 0, 1],
        when: { kind: 'timing', timing: 'night' },
        where: 'face',
        days: 5,
        qty: 10,
      }),
    ).toMatchObject({
      dose: '1-0-1',
      when: 'night',
      where: 'face',
      days: 5,
      qty: 10,
      remarks: '',
    });
  });

  it('takes the last line’s days, and fills the quantity from days × doses a day', () => {
    const lastWithDays = { ...flubolt, last: item({ remarks: '10 days', qty: 3 }) };
    expect(rxLineFor(lastWithDays, {})).toMatchObject({ days: 10, qty: 10, remarks: '' });
    expect(rxLineFor(flubolt, { dose: [1, 0, 1], days: 7 })).toMatchObject({
      days: 7,
      qty: 14,
    });
  });

  it('fills the first blank row, or comes last', () => {
    const line = rxLineFor(flubolt, {});
    expect(withRxLine([emptyRxLine()], line)).toEqual([line]);
    expect(withRxLine([line], line)).toHaveLength(2);
  });

  it('steps a medicine up and down from Browse, keeping one blank row', () => {
    const added = steppedRxLines([emptyRxLine()], flubolt, 1);
    expect(rxCountOf(added, 'Flubolt 400')).toBe(8);
    const more = steppedRxLines(added, flubolt, 1);
    expect(rxCountOf(more, 'Flubolt 400')).toBe(9);
    const one = steppedRxLines(
      [{ ...emptyRxLine(), medicineName: 'Flubolt 400' }],
      flubolt,
      -1,
    );
    expect(one).toEqual([emptyRxLine()]);
    expect(steppedRxLines([emptyRxLine()], flubolt, -1)).toEqual([emptyRxLine()]);
  });
});

describe('firstRxStep — where the drawer opens (feat-prescription-composer D9)', () => {
  it('opens on Medicines with a doctor, on step 1 without one', () => {
    expect(firstRxStep('mem_nisha0000000000000000')).toBe('medicines');
    expect(firstRxStep(null)).toBe('prescription');
  });
});
