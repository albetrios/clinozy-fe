import { describe, expect, it } from 'vitest';

import {
  civilDaysBetween,
  fixtureUuid,
  parseSeedDisplayDate,
  PROTOTYPE_SEED_DAY,
  seedCommon,
  seedDate,
  seedInstant,
  seedPhone,
} from './app-fixture-seed.ts';
import { appCommonSchema, patientSchema } from './app-schema.ts';

describe('seed helpers', () => {
  it("shifts the prototype's seed day onto today, keeping every gap", () => {
    expect(seedDate(PROTOTYPE_SEED_DAY, '2026-10-03')).toBe('2026-10-03');
    expect(seedDate('2026-09-24', '2026-10-03')).toBe('2026-09-30');
    expect(seedDate('2026-10-08', '2026-10-03')).toBe('2026-10-14');
    expect(civilDaysBetween('2026-09-27', '2026-10-01')).toBe(4);
  });

  it('turns a seed date and clinic time into the UTC instant', () => {
    expect(seedInstant(PROTOTYPE_SEED_DAY, '10:40', '2026-10-03')).toBe(
      '2026-10-03T05:10:00.000Z',
    );
  });

  it.each([
    ['Today · 10:40', { date: '2026-09-27', time: '10:40' }],
    ['Sep 24 · 14:50', { date: '2026-09-24', time: '14:50' }],
    ['24 Sep', { date: '2026-09-24', time: null }],
    ['17 Sep 2026', { date: '2026-09-17', time: null }],
    ['Dec 09, 2025 · 10:38', { date: '2025-12-09', time: '10:38' }],
    ['Today · 11:00 am', { date: '2026-09-27', time: '11:00' }],
    ['24 Sep · 2:50 pm', { date: '2026-09-24', time: '14:50' }],
    ['Yesterday', { date: '2026-09-26', time: null }],
  ])('reads "%s"', (display, expected) => {
    expect(parseSeedDisplayDate(display)).toEqual(expected);
  });

  it('refuses what is not a date', () => {
    expect(parseSeedDisplayDate('—')).toBeNull();
  });

  it('turns displayed mobiles into E.164', () => {
    expect(seedPhone('98250 44120')).toBe('+919825044120');
    expect(seedPhone('+91 98250 44120')).toBe('+919825044120');
    expect(patientSchema.shape.phone.safeParse(seedPhone('82006 03212')).success).toBe(
      true,
    );
  });

  it('gives each record a stable, contract-valid uuid', () => {
    const id = fixtureUuid('patient', 3508);
    expect(fixtureUuid('patient', 3508)).toBe(id);
    expect(fixtureUuid('patient', 3507)).not.toBe(id);
    expect(fixtureUuid('lead', 3508)).not.toBe(id);
    expect(patientSchema.shape.id.safeParse(id).success).toBe(true);
  });

  it('stamps contract-valid audit fields', () => {
    expect(
      appCommonSchema.safeParse(seedCommon('2026-10-03T05:00:00.000Z')).success,
    ).toBe(true);
  });
});
