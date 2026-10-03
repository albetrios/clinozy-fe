import { describe, expect, it } from 'vitest';

import { greetingFor } from './clinic-greeting.ts';

describe('greetingFor', () => {
  it.each([
    [0, 'morning'],
    [6, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [16, 'afternoon'],
    [17, 'evening'],
    [23, 'evening'],
  ] as const)('hour %i is %s', (hour, part) => {
    expect(greetingFor(hour)).toBe(part);
  });

  it('keeps the real clock — no 09:00–19:59 clamp (D15)', () => {
    // The prototype clamped its simulated clock; 07:00 and 21:00 are real hours.
    expect(greetingFor(7)).toBe('morning');
    expect(greetingFor(21)).toBe('evening');
  });
});
