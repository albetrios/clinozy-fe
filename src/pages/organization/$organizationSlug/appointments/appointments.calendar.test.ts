import { describe, expect, it } from 'vitest';

import {
  blockGeometry,
  type CalendarBooking,
  dayLoad,
  doubleBooked,
  doubleBookedIds,
  laneLayout,
  loadDots,
  monthFit,
  nowLineTop,
  pastVeil,
  RAIL_HEIGHT,
  RAIL_HOURS,
  slotFromPointer,
  weekLoad,
} from './appointments.calendar.ts';

const DOCTOR = 'doctor-a';
const OTHER = 'doctor-b';

/** A booking with just what the calendar reads. */
function booking(
  id: string,
  startTime: string,
  durationMin: number,
  overrides: Partial<CalendarBooking> = {},
): CalendarBooking {
  return {
    id,
    date: '2026-10-03',
    startTime,
    durationMin,
    doctorId: DOCTOR,
    status: 'scheduled',
    ...overrides,
  };
}

describe('the hour rail (H:5924)', () => {
  it('runs 9 am to 10 pm at 88px an hour, labelled 9 am … 9 pm', () => {
    expect(RAIL_HEIGHT).toBe(1144);
    expect(RAIL_HOURS).toHaveLength(13);
    expect(RAIL_HOURS[0]).toBe(9);
    expect(RAIL_HOURS.at(-1)).toBe(21);
  });
});

describe('blockGeometry (H:5930)', () => {
  it('places a block by its start and sizes it by its length, less 2px', () => {
    const geometry = blockGeometry(booking('a', '10:30', 60));
    expect(geometry.top).toBe(132);
    expect(geometry.height).toBe(86);
    expect(geometry.oneLine).toBe(false);
  });

  it('keeps a short booking at least 22px tall and on one line under 40px', () => {
    expect(blockGeometry(booking('a', '09:00', 10)).height).toBe(22);
    expect(blockGeometry(booking('a', '09:00', 20)).oneLine).toBe(true);
    // 25 minutes → 34.7px: still one line (the rendered threshold is 40px).
    expect(blockGeometry(booking('a', '09:00', 25)).oneLine).toBe(true);
    expect(blockGeometry(booking('a', '09:00', 30)).oneLine).toBe(false);
  });

  it('gives each lane its share of the column, 3px in from either edge', () => {
    const geometry = blockGeometry(booking('a', '11:00', 45), {
      lane: 1,
      lanes: 2,
      clash: true,
    });
    expect(geometry.insetInlineStart).toBe('calc(3px + (100% - 6px) * 1 / 2)');
    expect(geometry.width).toBe('calc((100% - 6px) / 2 - 2px)');
  });
});

describe('laneLayout (H:5928)', () => {
  it('leaves a booking alone in its column on one lane', () => {
    expect(laneLayout([booking('a', '10:00', 30)]).get('a')).toEqual({
      lane: 0,
      lanes: 1,
      clash: false,
    });
  });

  it('splits overlapping bookings into lanes, the cluster sharing its count', () => {
    const slots = laneLayout([
      booking('meera', '11:00', 45),
      booking('priti', '11:30', 30),
      booking('later', '13:00', 30),
    ]);
    expect(slots.get('meera')).toEqual({ lane: 0, lanes: 2, clash: true });
    expect(slots.get('priti')).toEqual({ lane: 1, lanes: 2, clash: true });
    expect(slots.get('later')).toEqual({ lane: 0, lanes: 1, clash: false });
  });

  it('reuses a lane once its booking ends, and counts a missing length as 30 minutes', () => {
    const slots = laneLayout([
      booking('a', '10:00', 60),
      booking('b', '10:15', 15),
      booking('c', '10:30', 0),
    ]);
    // b ends at 10:30, so c takes b's lane: the cluster needs two lanes.
    expect(slots.get('c')).toEqual({ lane: 1, lanes: 2, clash: true });
  });

  it('starts a new cluster after a gap, in start order whatever the input order', () => {
    const slots = laneLayout([
      booking('late', '12:00', 30),
      booking('early', '10:00', 30),
    ]);
    expect(slots.get('late')?.lanes).toBe(1);
    expect(slots.get('early')?.lanes).toBe(1);
  });
});

describe('dayLoad (H:5950)', () => {
  it('counts the bookings shown and their hours to one decimal', () => {
    expect(dayLoad([booking('a', '11:00', 45), booking('b', '11:30', 30)])).toEqual({
      booked: 2,
      hours: 1.3,
    });
    expect(dayLoad([])).toEqual({ booked: 0, hours: 0 });
  });
});

describe('weekLoad (H:5933)', () => {
  it('weighs live chair time against 13 hours × at least two doctors', () => {
    // 60 min of 13h × 2 doctors = 1560 min → 4%.
    expect(weekLoad([booking('a', '10:00', 60)])).toEqual({
      booked: 1,
      percent: 4,
      tone: 'sage',
      overlap: false,
    });
  });

  it('leaves cancelled bookings out and bands the load sage, butter, blush', () => {
    const day = (minutes: number) =>
      weekLoad([
        booking('a', '09:00', minutes, { doctorId: DOCTOR }),
        booking('b', '09:00', minutes, { doctorId: OTHER }),
        booking('c', '09:00', 600, { status: 'cancelled' }),
      ]);
    expect(day(60).booked).toBe(2);
    expect(day(420).tone).toBe('sage'); // 840 / 1560 = 54%
    expect(day(430).tone).toBe('butter'); // 55%
    expect(day(660).tone).toBe('blush'); // 85%
    expect(day(1000).percent).toBe(100);
  });

  it('flags a double-booked doctor', () => {
    expect(weekLoad([booking('a', '11:00', 45), booking('b', '11:30', 30)]).overlap).toBe(
      true,
    );
  });
});

describe('doubleBookedIds', () => {
  it('names both bookings of a clash, and only a clash of one doctor', () => {
    expect(
      doubleBookedIds([
        booking('meera', '11:00', 45),
        booking('priti', '11:30', 30),
        booking('other', '11:15', 30, { doctorId: OTHER }),
      ]),
    ).toEqual(new Set(['meera', 'priti']));
  });
});

describe('doubleBooked', () => {
  it('is true only for one doctor’s overlapping live bookings', () => {
    expect(doubleBooked([booking('a', '11:00', 45), booking('b', '11:30', 30)])).toBe(
      true,
    );
    expect(
      doubleBooked([
        booking('a', '11:00', 45),
        booking('b', '11:30', 30, { doctorId: OTHER }),
      ]),
    ).toBe(false);
    expect(
      doubleBooked([
        booking('a', '11:00', 45),
        booking('b', '11:30', 30, { status: 'cancelled' }),
      ]),
    ).toBe(false);
    expect(doubleBooked([booking('a', '11:00', 30), booking('b', '11:30', 30)])).toBe(
      false,
    );
  });
});

describe('monthFit (H:5938)', () => {
  it('shows two before the cell is measured', () => {
    expect(monthFit(0, 5)).toBe(2);
    expect(monthFit(0, 1)).toBe(1);
  });

  it('shows every chip that fits under the date row', () => {
    // 124px cell: 124 − 34 = 90px of room → three 26px chips.
    expect(monthFit(124, 3)).toBe(3);
  });

  it('keeps a line for "+<n> more" when they do not all fit', () => {
    // 90px room: (90 − 24) / 26 → two chips and the "+2 more" line.
    expect(monthFit(124, 4)).toBe(2);
    expect(monthFit(40, 3)).toBe(0);
  });
});

describe('nowLineTop and pastVeil (H:5925, H:5933)', () => {
  it('puts the now line at the clock’s offset below 9 am', () => {
    expect(nowLineTop(9 * 60)).toBe(0);
    expect(nowLineTop(10 * 60 + 30)).toBe(132);
    expect(nowLineTop(8 * 60)).toBe(-88);
  });

  it('veils a past day whole, today down to now, a later day not at all', () => {
    expect(pastVeil('2026-10-02', '2026-10-03', 600)).toBe('all');
    expect(pastVeil('2026-10-03', '2026-10-03', 600)).toBe(88);
    expect(pastVeil('2026-10-03', '2026-10-03', 480)).toBe(0);
    expect(pastVeil('2026-10-04', '2026-10-03', 600)).toBe(0);
  });
});

describe('slotFromPointer (H:5952)', () => {
  it('rounds a press to the nearest quarter hour', () => {
    expect(slotFromPointer(0)).toBe('09:00');
    expect(slotFromPointer(88)).toBe('10:00');
    expect(slotFromPointer(88 + 30)).toBe('10:15'); // 10:20 → 10:15
    expect(slotFromPointer(88 + 38)).toBe('10:30'); // 10:26 → 10:30
    expect(slotFromPointer(88 * 2 - 5)).toBe('11:00'); // 10:57 → 11:00
  });

  it('keeps the slot on the rail', () => {
    expect(slotFromPointer(-20)).toBe('09:00');
    expect(slotFromPointer(RAIL_HEIGHT)).toBe('21:45');
  });
});

describe('the Month board (H:5936)', () => {
  it('dots a day by its load: one up to 6, two to 12, three above (H:5923)', () => {
    expect([0, 1, 6, 7, 12, 13].map(loadDots)).toEqual([0, 1, 1, 2, 2, 3]);
  });
});
