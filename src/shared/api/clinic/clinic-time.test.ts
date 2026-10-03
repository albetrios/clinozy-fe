import { describe, expect, it } from 'vitest';

import {
  addCivilDays,
  clinicClockTime,
  clinicInstant,
  clinicToday,
} from './clinic-time.ts';

describe('clinic clock (Asia/Kolkata)', () => {
  it("reads today's clinic date, not the UTC one", () => {
    // 20:00 UTC on 2 Oct is 01:30 on 3 Oct in the clinic.
    expect(clinicToday(new Date('2026-10-02T20:00:00Z'))).toBe('2026-10-03');
    expect(clinicToday(new Date('2026-10-03T10:00:00Z'))).toBe('2026-10-03');
  });

  it('turns a clinic-local date and time into the UTC instant', () => {
    expect(clinicInstant('2026-10-03', '10:20')).toBe('2026-10-03T04:50:00.000Z');
    expect(clinicInstant('2026-10-03', '00:15')).toBe('2026-10-02T18:45:00.000Z');
  });

  it('reads the clinic-local clock time of an instant', () => {
    expect(clinicClockTime(new Date('2026-10-03T04:50:00Z'))).toBe('10:20');
  });

  it('does calendar arithmetic across month and year ends', () => {
    expect(addCivilDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addCivilDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addCivilDays('2026-10-03', 0)).toBe('2026-10-03');
  });
});
