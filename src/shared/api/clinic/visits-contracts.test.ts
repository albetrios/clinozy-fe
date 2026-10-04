import { describe, expect, it } from 'vitest';

import { canMoveVisit, VISIT_STAGE_FLOW, VISIT_STAGES } from './visits-contracts.ts';

describe('the Visit stage machine (KICKOFF §6.2; D18)', () => {
  it('names a flow for every stage', () => {
    expect(Object.keys(VISIT_STAGE_FLOW)).toEqual([...VISIT_STAGES]);
  });

  it('moves forward through the floor: Send in, Approve, Complete session, Receive, Dispense', () => {
    expect(canMoveVisit('waiting', 'with_doctor')).toBe(true);
    expect(canMoveVisit('with_doctor', 'treatment')).toBe(true);
    expect(canMoveVisit('with_doctor', 'checkout')).toBe(true);
    expect(canMoveVisit('treatment', 'checkout')).toBe(true);
    expect(canMoveVisit('checkout', 'pharmacy')).toBe(true);
    expect(canMoveVisit('checkout', 'done')).toBe(true);
    expect(canMoveVisit('pharmacy', 'done')).toBe(true);
  });

  it('refuses skips, steps back and anything out of Done', () => {
    expect(canMoveVisit('waiting', 'checkout')).toBe(false);
    expect(canMoveVisit('with_doctor', 'waiting')).toBe(false);
    expect(canMoveVisit('done', 'waiting')).toBe(false);
    expect(VISIT_STAGE_FLOW.done).toEqual([]);
  });
});
