import { describe, expect, it } from 'vitest';

import { WEEKDAY_VALUES } from './app-schema.ts';
import { WEEK } from './app-week.ts';

describe('WEEK', () => {
  it('is the contract’s weekday enum, in its order', () => {
    expect([...WEEK]).toEqual([...WEEKDAY_VALUES]);
  });
});
