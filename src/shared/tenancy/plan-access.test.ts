import { describe, expect, it } from 'vitest';

import { ACTIVE_PLAN_ACCESS, parsePlanAccess } from './plan-access.ts';

describe('parsePlanAccess', () => {
  const GRACE_ENDS_AT = '2026-10-31T00:00:00.000Z';

  it.each([
    ['active', null, { state: 'active', graceEndsAt: null }],
    ['grace', GRACE_ENDS_AT, { state: 'grace', graceEndsAt: GRACE_ENDS_AT }],
    ['read_only', null, { state: 'read_only', graceEndsAt: null }],
  ])('maps the %s state', (state, graceEndsAt, expected) => {
    expect(parsePlanAccess({ state, grace_ends_at: graceEndsAt })).toEqual(expected);
  });

  it('reads an absent plan_access (an older backend) as active', () => {
    expect(parsePlanAccess(undefined)).toEqual(ACTIVE_PLAN_ACCESS);
  });

  it('reads a plan_access it cannot understand (a state added later) as active', () => {
    expect(parsePlanAccess({ state: 'archived', grace_ends_at: 'soon' })).toEqual(
      ACTIVE_PLAN_ACCESS,
    );
  });
});
