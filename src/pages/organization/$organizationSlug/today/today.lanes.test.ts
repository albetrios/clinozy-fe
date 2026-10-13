import { describe, expect, it } from 'vitest';

import { ROLE_VALUES } from '@/shared/api/app/app-schema.ts';
import {
  type FloorStage,
  TODAY_LANES,
  type TodayLane,
} from '@/shared/api/app/today-contracts.ts';

import { enquiry, floorRow, publicId } from './__tests__/integration/today-fixtures.ts';

/** A row's id for the tests. */
const rowId = (n: number) => publicId('appt', n);
import {
  defaultTodayLane,
  groupTodayLanes,
  isLaneInFocus,
  laneFaces,
  laneHint,
  readableTodayLanes,
  TODAY_ROLE_FOCUS,
  todayFocus,
  type TodayLanes,
  todayPulse,
} from './today.lanes.ts';

/** Lanes with `n` placeholder cards in the named lanes (the rest empty). */
function lanesWith(counts: Partial<Record<TodayLane, number>>): TodayLanes {
  const rows = Object.entries(counts).flatMap(([lane, count]) =>
    Array.from({ length: count ?? 0 }, (_, index) => {
      const id = rowId(100 + index + TODAY_LANES.indexOf(lane as TodayLane) * 10);
      if (lane === 'enquiries') return { kind: 'enquiry' as const, id };
      return { kind: 'row' as const, id, lane: lane as TodayLane };
    }),
  );
  return groupTodayLanes(
    rows.flatMap((row) =>
      row.kind === 'row'
        ? [
            floorRow(
              row.lane === 'arriving'
                ? { id: row.id, status: 'scheduled' }
                : {
                    id: row.id,
                    status: 'checked_in',
                    visitStage: row.lane as FloorStage,
                  },
            ),
          ]
        : [],
    ),
    rows.flatMap((row) => (row.kind === 'enquiry' ? [enquiry({ id: row.id })] : [])),
  );
}

describe('groupTodayLanes (KICKOFF §6.2 Stage machine)', () => {
  it('puts every booking in its lane and each lane in time order', () => {
    const lanes = groupTodayLanes(
      [
        floorRow({ id: rowId(1), status: 'scheduled', startTime: '11:30' }),
        floorRow({ id: rowId(2), status: 'confirmed', startTime: '11:15' }),
        floorRow({ id: rowId(3), status: 'checked_in', startTime: '10:40' }),
        floorRow({
          id: rowId(4),
          status: 'checked_in',
          startTime: '10:20',
          visitStage: 'with_doctor',
          visitStageChangedAt: '2026-10-03T05:03:00.000Z',
        }),
      ],
      [enquiry({ id: rowId(6) })],
    );
    expect(lanes.arriving.map((card) => card.id)).toEqual([rowId(2), rowId(1)]);
    expect(lanes.waiting.map((card) => card.id)).toEqual([rowId(3)]);
    expect(lanes.with_doctor.map((card) => card.id)).toEqual([rowId(4)]);
    expect(lanes.enquiries).toMatchObject([{ kind: 'enquiry', time: '10:31' }]);
    expect(Object.keys(lanes)).toEqual([...TODAY_LANES]);
    expect(Object.values(lanes).flat()).toHaveLength(5);
  });
});

describe('role focus (today.md:7; H:2981–2989)', () => {
  it('maps every clinic role', () => {
    expect(Object.keys(TODAY_ROLE_FOCUS).sort()).toEqual([...ROLE_VALUES].sort());
  });

  it.each([
    ['front_desk', ['enquiries', 'arriving', 'waiting', 'checkout']],
    ['doctor', ['waiting', 'with_doctor']],
    ['therapist', ['treatment']],
    ['counsellor', ['with_doctor', 'checkout']],
    ['pharmacist', ['pharmacy']],
    ['accountant', ['checkout']],
    ['marketing', ['enquiries']],
  ] as const)('%s keeps an eye on %j', (role, lanes) => {
    const focus = todayFocus([role]);
    expect([...focus].sort()).toEqual([...lanes].sort());
    for (const lane of TODAY_LANES) {
      expect(isLaneInFocus(lane, focus)).toBe(
        (lanes as readonly string[]).includes(lane),
      );
    }
  });

  it('dims nothing for an Owner or an Admin', () => {
    for (const role of ['owner', 'admin'] as const) {
      const focus = todayFocus([role]);
      expect(focus.size).toBe(0);
      expect(TODAY_LANES.every((lane) => isLaneInFocus(lane, focus))).toBe(true);
    }
  });

  it('adds roles up — a desk Admin keeps the desk’s lanes', () => {
    expect([...todayFocus(['front_desk', 'admin'])].sort()).toEqual(
      ['arriving', 'checkout', 'enquiries', 'waiting'].sort(),
    );
    expect([...todayFocus(['doctor', 'therapist'])].sort()).toEqual(
      ['treatment', 'waiting', 'with_doctor'].sort(),
    );
  });
});

describe('defaultTodayLane (today.md:35)', () => {
  it('opens the first lane in focus that has people', () => {
    const lanes = lanesWith({ enquiries: 2, waiting: 1, with_doctor: 1 });
    expect(defaultTodayLane(lanes, todayFocus(['doctor']))).toBe('waiting');
    expect(defaultTodayLane(lanes, todayFocus(['front_desk']))).toBe('enquiries');
  });

  it('falls back to the first lane with people, then Enquiries', () => {
    expect(
      defaultTodayLane(lanesWith({ treatment: 1 }), todayFocus(['pharmacist'])),
    ).toBe('treatment');
    expect(defaultTodayLane(lanesWith({ checkout: 2 }), todayFocus(['owner']))).toBe(
      'checkout',
    );
    expect(defaultTodayLane(lanesWith({}), todayFocus(['doctor']))).toBe('enquiries');
  });

  it('picks among the lanes the member can read only (F3, D163)', () => {
    const floorOnly = readableTodayLanes({ leads: false, appointments: true });
    expect(
      defaultTodayLane(
        lanesWith({ enquiries: 3 }),
        todayFocus(['front_desk']),
        floorOnly,
      ),
    ).toBe('arriving');
  });
});

describe('readableTodayLanes (F3, D163)', () => {
  it('keeps Enquiries for a lead reader and the floor for an appointment reader', () => {
    expect(readableTodayLanes({ leads: true, appointments: true })).toEqual(TODAY_LANES);
    expect(readableTodayLanes({ leads: true, appointments: false })).toEqual([
      'enquiries',
    ]);
    expect(readableTodayLanes({ leads: false, appointments: true })).toEqual(
      TODAY_LANES.filter((lane) => lane !== 'enquiries'),
    );
    expect(readableTodayLanes({ leads: false, appointments: false })).toEqual([]);
  });
});

describe('laneHint (today.md:33)', () => {
  const cards = (times: string[]) =>
    groupTodayLanes(
      times.map((startTime, index) =>
        floorRow({ id: rowId(index + 1), status: 'checked_in', startTime }),
      ),
      [],
    ).waiting;

  it('names the earliest card: oldest, next or since', () => {
    expect(laneHint('enquiries', cards(['10:31', '09:58']))).toEqual({
      kind: 'oldest',
      time: '09:58',
    });
    expect(laneHint('arriving', cards(['11:30', '11:15']))).toEqual({
      kind: 'next',
      time: '11:15',
    });
    expect(laneHint('waiting', cards(['10:45', '10:40']))).toEqual({
      kind: 'since',
      time: '10:40',
    });
  });

  it('has none for an empty lane', () => {
    expect(laneHint('pharmacy', [])).toBeNull();
  });
});

describe('laneFaces (today.md:32)', () => {
  it('shows up to four initials, then how many more', () => {
    const names = [
      'Rhea Shah',
      'Nikhil Rao',
      'Meera Joshi',
      'Faizan Shaikh',
      'Priti Soni',
      'Sana',
    ];
    const lanes = groupTodayLanes(
      names.map((name, index) =>
        floorRow({
          id: rowId(index + 1),
          status: 'checked_in',
          startTime: `10:0${index}`,
          name,
        }),
      ),
      [],
    );
    expect(laneFaces(lanes.waiting)).toEqual({
      faces: [
        { id: rowId(1), initials: 'RS' },
        { id: rowId(2), initials: 'NR' },
        { id: rowId(3), initials: 'MJ' },
        { id: rowId(4), initials: 'FS' },
      ],
      more: 2,
    });
    expect(laneFaces([])).toEqual({ faces: [], more: 0 });
  });
});

describe('todayPulse (S:1578)', () => {
  it('counts everyone in clinic, the waiting and the arriving', () => {
    const lanes = lanesWith({
      enquiries: 2,
      arriving: 3,
      waiting: 2,
      with_doctor: 1,
      treatment: 1,
      checkout: 1,
      pharmacy: 1,
    });
    expect(todayPulse(lanes)).toEqual({ inClinic: 6, waiting: 2, arriving: 3 });
  });
});
