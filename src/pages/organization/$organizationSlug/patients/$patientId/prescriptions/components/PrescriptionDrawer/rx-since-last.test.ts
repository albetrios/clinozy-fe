import { describe, expect, it } from 'vitest';

import {
  prescriptionLine,
  prescriptionRecord,
} from '../../__tests__/integration/prescription-doubles.ts';
import { rxFormLineOf } from './rx-form.ts';
import { previousRxOf, rxChangeCounts, rxChangesSince } from './rx-since-last.ts';

const LAST = prescriptionRecord({
  id: 'rx_last',
  seq: 12,
  items: [
    prescriptionLine({
      medicineName: 'Doxycycline 100',
      doseMorning: 1,
      doseNight: 1,
      qty: 20,
    }),
    prescriptionLine({
      medicineName: 'Cetirizine 10',
      doseNight: 1,
      meal: null,
      qty: 10,
    }),
    prescriptionLine({
      medicineName: 'Sunscreen SPF 50',
      doseNight: 0,
      meal: null,
      qty: 1,
    }),
  ],
});

describe('previousRxOf — what a drawer compares with', () => {
  const older = prescriptionRecord({ id: 'rx_older', seq: 11 });
  const history = [LAST, older];

  it('a new prescription compares with the newest', () => {
    expect(previousRxOf(history, null)).toBe(LAST);
  });

  it('an edit compares with the newest numbered below it', () => {
    expect(previousRxOf(history, LAST)).toBe(older);
    expect(previousRxOf(history, older)).toBeUndefined();
  });

  it('a first prescription has none', () => {
    expect(previousRxOf([], null)).toBeUndefined();
  });
});

describe('rxChangesSince — the lines against the previous prescription', () => {
  it('marks new, changed, unchanged and stopped medicines, by name in any case', () => {
    const lines = [
      rxFormLineOf(prescriptionLine({ medicineName: 'Septran DS', qty: 6 })),
      // The same name, now once a day.
      rxFormLineOf(
        prescriptionLine({
          medicineName: 'doxycycline 100',
          doseMorning: 1,
          doseNight: 0,
          qty: 20,
        }),
      ),
      rxFormLineOf(LAST.items[2] ?? prescriptionLine()),
    ];
    const result = rxChangesSince(lines, LAST);
    expect(result?.previous).toBe(LAST);
    expect(result?.changes.map((change) => [change.kind, change.name])).toEqual([
      ['new', 'Septran DS'],
      ['changed', 'doxycycline 100'],
      ['unchanged', 'Sunscreen SPF 50'],
      ['stopped', 'Cetirizine 10'],
    ]);
    const changed = result?.changes[1];
    expect(
      changed?.kind === 'changed' && [changed.before.dose, changed.now.dose],
    ).toEqual(['1-0-1', '1-0-0']);
    expect(rxChangeCounts(result?.changes ?? [])).toEqual({
      new: 1,
      changed: 1,
      unchanged: 1,
      stopped: 1,
    });
  });

  it('reads a changed note or quantity as a change, and leaves blank rows out', () => {
    const lines = [
      rxFormLineOf({ ...(LAST.items[1] ?? prescriptionLine()), remarks: '5 days' }),
      { ...rxFormLineOf(LAST.items[0] ?? prescriptionLine()), qty: 30 },
      { ...rxFormLineOf(prescriptionLine()), medicineName: '   ' },
    ];
    const kinds = rxChangesSince(lines, LAST)?.changes.map((change) => change.kind);
    expect(kinds).toEqual(['changed', 'changed', 'stopped']);
  });

  it('reads a name written twice once; the second line is new', () => {
    const doxy = rxFormLineOf(LAST.items[0] ?? prescriptionLine());
    const kinds = rxChangesSince([doxy, doxy], LAST)?.changes.map(
      (change) => change.kind,
    );
    expect(kinds?.slice(0, 2)).toEqual(['unchanged', 'new']);
  });

  it('is null without a previous prescription', () => {
    expect(rxChangesSince([], undefined)).toBeNull();
  });
});
