import { describe, expect, it } from 'vitest';

import { nextTimeSlot, timeSlots } from './time-slots.ts';

describe('timeSlots', () => {
  it('offers 06:00 to 23:30 every 30 minutes by default (users.md:114)', () => {
    const slots = timeSlots();
    expect(slots).toHaveLength(36);
    expect(slots[0]).toBe('06:00');
    expect(slots[1]).toBe('06:30');
    expect(slots.at(-1)).toBe('23:30');
  });

  it('takes its own range and step', () => {
    expect(timeSlots('09:00', '10:00', 15)).toEqual([
      '09:00',
      '09:15',
      '09:30',
      '09:45',
      '10:00',
    ]);
    expect(timeSlots('10:00', '09:00')).toEqual([]);
    expect(timeSlots('10:00', '11:00', 0)).toEqual([]);
  });
});

describe('nextTimeSlot', () => {
  it('starts a closing time’s list after the opening one, never past the day', () => {
    expect(nextTimeSlot('10:00')).toBe('10:30');
    expect(nextTimeSlot('10:00', 15)).toBe('10:15');
    expect(nextTimeSlot('23:30')).toBe('23:59');
  });
});
