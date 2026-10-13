import { describe, expect, it } from 'vitest';

import {
  clearRoomFilter,
  countRoomFilters,
  dateRangeEnds,
  isDateRange,
  type RoomFilterFields,
  roomFilterSearchPatch,
  roomFilterValues,
  setRoomDateFilter,
  showsAutomaticSection,
  toggleRoomFilterOption,
  withDateRangeEnd,
} from './room-filters.ts';

const FIELDS = {
  gender: { kind: 'options', values: ['female', 'male', 'other'] },
  status: { kind: 'options', values: ['new', 'regular', 'vip'], single: true },
  created: { kind: 'date', presets: 'created' },
  followUp: { kind: 'date', presets: 'followUp' },
} as const satisfies RoomFilterFields;

describe('roomFilterValues', () => {
  it('reads each filter with the shared readers, dropping what they reject', () => {
    expect(
      roomFilterValues(FIELDS, {
        q: 'asha',
        gender: ['female', 'alien', 'female'],
        status: 'vip',
        created: '2026-09-01..2026-09-30',
        followUp: 'last_7',
        other: ['x'],
      }),
    ).toEqual({
      gender: ['female'],
      status: ['vip'],
      created: ['2026-09-01..2026-09-30'],
    });
  });

  it('reads a comma list, a single pick from a list, and open-ended ranges', () => {
    expect(
      roomFilterValues(FIELDS, {
        gender: 'female,male',
        status: ['regular', 'vip'],
        followUp: '..2026-10-05',
      }),
    ).toEqual({
      gender: ['female', 'male'],
      status: ['regular'],
      followUp: ['..2026-10-05'],
    });
  });
});

describe('roomFilterSearchPatch', () => {
  it('writes every key the filters own, in the URL form the room parses', () => {
    expect(
      roomFilterSearchPatch(FIELDS, {
        gender: ['female', 'other'],
        status: ['vip'],
        created: ['last_30'],
      }),
    ).toEqual({
      gender: ['female', 'other'],
      status: 'vip',
      created: 'last_30',
      followUp: undefined,
    });
  });

  it('round-trips through the URL', () => {
    const values = {
      gender: ['male'],
      followUp: ['2026-10-01..'],
    };
    expect(roomFilterValues(FIELDS, roomFilterSearchPatch(FIELDS, values))).toEqual(
      values,
    );
  });

  it('drops retired values and a range with neither end', () => {
    expect(
      roomFilterSearchPatch(FIELDS, { gender: ['retired'], created: ['..'] }),
    ).toMatchObject({ gender: undefined, created: undefined });
  });
});

describe('countRoomFilters', () => {
  it('counts each picked option and each date section once', () => {
    expect(
      countRoomFilters(FIELDS, {
        gender: ['female', 'male'],
        status: ['vip'],
        created: ['2026-09-01..2026-09-30'],
      }),
    ).toBe(4);
    expect(countRoomFilters(FIELDS, {})).toBe(0);
  });
});

describe('editing the pending set', () => {
  it('toggles options: several at once, or one for a single filter', () => {
    const picked = toggleRoomFilterOption({}, 'gender', 'female');
    expect(toggleRoomFilterOption(picked, 'gender', 'male')).toEqual({
      gender: ['female', 'male'],
    });
    expect(toggleRoomFilterOption(picked, 'gender', 'female')).toEqual({});
    const single = toggleRoomFilterOption({ status: ['new'] }, 'status', 'vip', true);
    expect(single).toEqual({ status: ['vip'] });
    expect(toggleRoomFilterOption(single, 'status', 'vip', true)).toEqual({});
  });

  it('sets a date section to a preset, a range, or Any', () => {
    const preset = setRoomDateFilter({ gender: ['male'] }, 'created', 'today');
    expect(preset).toEqual({ gender: ['male'], created: ['today'] });
    expect(setRoomDateFilter(preset, 'created', undefined)).toEqual({ gender: ['male'] });
  });

  it('moves one end of a custom range at a time, either end open', () => {
    expect(isDateRange('2026-09-01..2026-09-30')).toBe(true);
    expect(isDateRange('last_7')).toBe(false);
    expect(isDateRange(undefined)).toBe(false);
    expect(dateRangeEnds('..2026-09-30')).toEqual({ from: null, to: '2026-09-30' });
    expect(withDateRangeEnd('2026-09-01..2026-09-30', 'from', '2026-09-10')).toBe(
      '2026-09-10..2026-09-30',
    );
    expect(withDateRangeEnd('2026-09-01..2026-09-30', 'to', null)).toBe('2026-09-01..');
  });
});

describe('a people filter (the Leads "Team")', () => {
  const PEOPLE = { owner: { kind: 'people' } } as const satisfies RoomFilterFields;
  const RIYA = 'mem_riya00000000000000000';
  const NIDHI = 'mem_nidhi0000000000000000';

  it('reads membership ids from the URL and drops anything else', () => {
    expect(roomFilterValues(PEOPLE, { owner: [RIYA, 'riya', NIDHI] })).toEqual({
      owner: [RIYA, NIDHI],
    });
    expect(
      roomFilterValues(PEOPLE, { owner: '00000000-0000-4000-8000-000000000012' }),
    ).toEqual({});
  });

  it('writes the picked ids as a list and counts each person', () => {
    expect(roomFilterSearchPatch(PEOPLE, { owner: [RIYA, NIDHI] })).toEqual({
      owner: [RIYA, NIDHI],
    });
    expect(roomFilterSearchPatch(PEOPLE, {})).toEqual({ owner: undefined });
    expect(countRoomFilters(PEOPLE, { owner: [RIYA, NIDHI] })).toBe(2);
  });

  it('keeps one person, as a plain value, when the filter is single', () => {
    const ONE = {
      member: { kind: 'people', single: true },
    } as const satisfies RoomFilterFields;
    expect(roomFilterValues(ONE, { member: [NIDHI, RIYA] })).toEqual({ member: [NIDHI] });
    expect(roomFilterSearchPatch(ONE, { member: [RIYA] })).toEqual({ member: RIYA });
    expect(toggleRoomFilterOption({ member: [RIYA] }, 'member', NIDHI, true)).toEqual({
      member: [NIDHI],
    });
  });

  it('clears one section with "Clear", the others kept', () => {
    expect(clearRoomFilter({ owner: [RIYA], gender: ['female'] }, 'owner')).toEqual({
      gender: ['female'],
    });
  });
});

describe('a date filter without some presets', () => {
  const DATES = {
    followUp: { kind: 'date', presets: 'followUp', without: ['not_set'] },
  } as const satisfies RoomFilterFields;

  it('drops a preset the room cannot filter by, keeps the rest and ranges', () => {
    expect(roomFilterValues(DATES, { followUp: 'not_set' })).toEqual({});
    expect(roomFilterValues(DATES, { followUp: 'overdue' })).toEqual({
      followUp: ['overdue'],
    });
    expect(roomFilterSearchPatch(DATES, { followUp: ['not_set'] })).toEqual({
      followUp: undefined,
    });
    expect(roomFilterValues(DATES, { followUp: '2026-10-01..2026-10-07' })).toEqual({
      followUp: ['2026-10-01..2026-10-07'],
    });
  });
});

describe('showsAutomaticSection', () => {
  it('shows a section of 2 to 10 distinct values only', () => {
    expect(showsAutomaticSection(1)).toBe(false);
    expect(showsAutomaticSection(2)).toBe(true);
    expect(showsAutomaticSection(10)).toBe(true);
    expect(showsAutomaticSection(11)).toBe(false);
  });
});
