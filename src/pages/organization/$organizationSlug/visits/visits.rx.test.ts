import { describe, expect, it } from 'vitest';

import type {
  Prescription,
  PrescriptionItem,
} from '@/shared/api/clinic/clinic-schema.ts';

import {
  addedLine,
  approveReadiness,
  copiedLines,
  doseText,
  draftLine,
  hasDose,
  nextDose,
} from './visits.rx.ts';

const item = (fields: Partial<PrescriptionItem> = {}): PrescriptionItem => ({
  medicineId: null,
  medicineName: 'Tretinoin 0.025% cream 20 g',
  doseMorning: 0,
  doseAfternoon: 0,
  doseNight: 1,
  sos: false,
  meal: null,
  timing: null,
  timingText: null,
  bodyPart: null,
  bodyPartText: null,
  qty: 1,
  remarks: null,
  ...fields,
});

describe('the Rx draft lines (`today.md:86–88`)', () => {
  it('copies the last Rx, every line to review again', () => {
    const lines = copiedLines({
      items: [item(), item({ medicineName: 'Sunscreen' })],
    } as Prescription);
    expect(lines.map((line) => [line.item.medicineName, line.reviewed])).toEqual([
      ['Tretinoin 0.025% cream 20 g', false],
      ['Sunscreen', false],
    ]);
    expect(new Set(lines.map((line) => line.key)).size).toBe(2);
  });

  it('adds a chip’s medicine with its last dose, else for the doctor to set', () => {
    const known = addedLine('Tranexa 500', 'm1', item({ doseMorning: 1, qty: 20 }));
    expect(known.item).toMatchObject({
      medicineName: 'Tranexa 500',
      medicineId: 'm1',
      qty: 20,
    });
    const unknown = addedLine('Ceramide moisturiser', null, null);
    expect(unknown.item).toMatchObject({ doseMorning: 0, doseNight: 0, qty: 1 });
    expect(hasDose(unknown.item)).toBe(false);
  });

  it('says how a line is taken', () => {
    expect(hasDose(item())).toBe(true);
    expect(hasDose(item({ doseNight: 0, sos: true }))).toBe(true);
    expect(hasDose(item({ doseNight: 0, timing: 'morning' }))).toBe(true);
    expect(hasDose(item({ doseNight: 0 }))).toBe(false);
    expect(doseText(item({ doseMorning: 1 }))).toBe('1-0-1');
    expect(doseText(item({ doseNight: 0 }))).toBe('');
  });

  it('cycles a dose tap 0 → 1 → 2 → 0', () => {
    expect([0, 1, 2].map(nextDose)).toEqual([1, 2, 0]);
  });

  it('is ready to approve with lines, all reviewed', () => {
    expect(approveReadiness([])).toEqual({ ready: false, pending: 0 });
    const line = draftLine(item());
    expect(approveReadiness([line])).toEqual({ ready: false, pending: 1 });
    expect(approveReadiness([{ ...line, reviewed: true }])).toEqual({
      ready: true,
      pending: 0,
    });
  });
});
