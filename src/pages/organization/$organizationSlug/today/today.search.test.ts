import { describe, expect, it } from 'vitest';

import { TODAY_LANES } from '@/shared/api/clinic/today-contracts.ts';

import {
  TODAY_LANE_VALUES,
  TODAY_QUEUE_VALUES,
  validateTodaySearch,
} from './today.search.ts';

describe('validateTodaySearch (KICKOFF §6.2)', () => {
  it('declares the contract’s lanes, in order', () => {
    expect(TODAY_LANE_VALUES).toEqual(TODAY_LANES);
    expect(TODAY_QUEUE_VALUES).toEqual(['mine', 'everyone']);
  });

  it('keeps a known lane and scope', () => {
    expect(validateTodaySearch({ lane: 'with_doctor', queue: 'everyone' })).toEqual({
      lane: 'with_doctor',
      queue: 'everyone',
    });
  });

  it('drops what the URL can’t hold — and answers every key', () => {
    expect(validateTodaySearch({ lane: 'done', queue: 'all', branch: 'x' })).toEqual({
      lane: undefined,
      queue: undefined,
    });
    expect(validateTodaySearch({})).toEqual({ lane: undefined, queue: undefined });
  });
});
