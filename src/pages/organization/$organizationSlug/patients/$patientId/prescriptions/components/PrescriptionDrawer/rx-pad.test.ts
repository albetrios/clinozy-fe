import { describe, expect, it } from 'vitest';

import type { RxCatalogMedicine } from '@/shared/api/app/prescriptions-contracts.ts';
import { nameNumbers } from '@/shared/components/QuickLine/index.ts';

import { emptyRxLine } from './rx-form.ts';
import {
  cleanRxPadLine,
  readableRxPadLines,
  readRxPad,
  RX_PAD_LINES_MAX,
  withRxPadLines,
} from './rx-pad.ts';

function medicine(
  name: string,
  fields: Partial<RxCatalogMedicine> = {},
): RxCatalogMedicine {
  return {
    name,
    medicineId: `med_${name.length}`,
    composition: null,
    stock: 12,
    form: 'oral',
    last: null,
    ...fields,
  };
}

const CATALOG = [
  medicine('Flubolt 400', { composition: 'Fluconazole 400 mg' }),
  medicine('Ketoconazole 2% Shampoo', { form: 'topical' }),
  medicine('Minoxidil 5% Solution', { form: 'topical' }),
];
const NUMBERS = nameNumbers(CATALOG.map((row) => row.name));

describe('cleanRxPadLine — what a written list leads a line with', () => {
  it.each([
    ['1. flu 0-0-1', 'flu 0-0-1'],
    ['2) keto scalp', 'keto scalp'],
    ['(3) minox hs', 'minox hs'],
    ['- flu 0-0-1', 'flu 0-0-1'],
    ['• flu 0-0-1', 'flu 0-0-1'],
    ['* flu', 'flu'],
    ['Tab. flu 0-0-1', 'flu 0-0-1'],
    ['TAB flu', 'flu'],
    ['1. Cap. flu bd', 'flu bd'],
    ['Syp cough 5d', 'cough 5d'],
    ['Oint. calamine body', 'calamine body'],
  ])('%s → %s', (raw, clean) => {
    expect(cleanRxPadLine(raw)).toBe(clean);
  });

  it('keeps a name that only starts like a dosage form', () => {
    expect(cleanRxPadLine('Tablo 20 od')).toBe('Tablo 20 od');
    expect(cleanRxPadLine('Capsaicin cream')).toBe('Capsaicin cream');
  });
});

describe('readRxPad — a whole prescription at once', () => {
  it('reads each line with the quick line’s grammar and search', () => {
    const pad = readRxPad(
      '1. Tab. flu 0-0-1 af 10d\n- keto scalp\nminox scalp hs\n',
      CATALOG,
      NUMBERS,
    );
    expect(pad.overflow).toBe(0);
    expect(pad.lines.map((line) => line.kind)).toEqual(['found', 'found', 'found']);
    const [flu, keto, minox] = pad.lines;
    expect(flu).toMatchObject({
      kind: 'found',
      text: 'flu 0-0-1 af 10d',
      medicine: { name: 'Flubolt 400' },
      values: {
        dose: [0, 0, 1],
        when: { kind: 'meal', meal: 'after' },
        days: 10,
        qty: 10,
      },
    });
    expect(keto).toMatchObject({
      medicine: { name: 'Ketoconazole 2% Shampoo' },
      values: { where: 'scalp' },
    });
    expect(minox).toMatchObject({
      medicine: { name: 'Minoxidil 5% Solution' },
      values: {
        dose: [0, 0, 1],
        where: 'scalp',
        when: { kind: 'timing', timing: 'night' },
      },
    });
  });

  it('adds a name the list lacks as typed, and marks a line with no name unreadable', () => {
    const pad = readRxPad('kojic gel face hs\n0-0-1 af\n\n   \n', CATALOG, NUMBERS);
    expect(pad.lines).toHaveLength(2);
    expect(pad.lines[0]).toMatchObject({ kind: 'typed', name: 'Kojic Gel' });
    expect(pad.lines[1]).toMatchObject({ kind: 'unreadable', text: '0-0-1 af' });
    expect(readableRxPadLines(pad)).toHaveLength(1);
  });

  it('keeps a number the catalogue’s names carry in the name', () => {
    const [line] = readRxPad('flubolt 400 bd', CATALOG, NUMBERS).lines;
    expect(line).toMatchObject({ kind: 'found', medicine: { name: 'Flubolt 400' } });
    expect(line?.values.qty).toBeUndefined();
  });

  it('reads Windows line ends', () => {
    expect(readRxPad('flu od\r\nketo scalp', CATALOG, NUMBERS).lines).toHaveLength(2);
  });

  it(`reads at most ${RX_PAD_LINES_MAX} lines and counts the rest`, () => {
    const text = Array.from({ length: RX_PAD_LINES_MAX + 4 }, () => 'flu od').join('\n');
    const pad = readRxPad(text, CATALOG, NUMBERS);
    expect(pad.lines).toHaveLength(RX_PAD_LINES_MAX);
    expect(pad.overflow).toBe(4);
  });

  it('reads nothing from an empty pad', () => {
    expect(readRxPad('', CATALOG, NUMBERS)).toEqual({ lines: [], overflow: 0 });
  });
});

describe('withRxPadLines — adding the Pad to the form', () => {
  const daysNote = (days: number) => `${days} days`;

  it('fills the blank row first, then appends, as the quick line adds', () => {
    const pad = readRxPad('flu 0-0-1 af 10d\nkojic gel face', CATALOG, NUMBERS);
    const lines = withRxPadLines([emptyRxLine()], readableRxPadLines(pad), daysNote);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      medicineName: 'Flubolt 400',
      medicineId: 'med_11',
      dose: '0-0-1',
      when: 'after',
      qty: 10,
      remarks: '10 days',
    });
    expect(lines[1]).toMatchObject({
      medicineName: 'Kojic Gel',
      medicineId: null,
      where: 'face',
      qty: 1,
    });
  });

  it('takes the patient’s last line when the Pad sets nothing', () => {
    const last = {
      ...CATALOG[0],
      last: {
        medicineName: 'Flubolt 400',
        medicineId: null,
        doseMorning: 1,
        doseAfternoon: 0,
        doseNight: 1,
        sos: false,
        meal: 'after',
        timing: null,
        timingText: null,
        bodyPart: null,
        bodyPartText: null,
        qty: 6,
        remarks: null,
      },
    } as RxCatalogMedicine;
    const pad = readRxPad('flu', [last], NUMBERS);
    const [line] = withRxPadLines([], readableRxPadLines(pad), daysNote);
    expect(line).toMatchObject({ dose: '1-0-1', when: 'after', qty: 6 });
  });
});
