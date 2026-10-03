import { describe, expect, it } from 'vitest';

import {
  countRoomFilters,
  dateRangeEnds,
  isDateRange,
  type RoomFilterFields,
  roomFilterSearchPatch,
  roomFilterValues,
  setRoomDateFilter,
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
