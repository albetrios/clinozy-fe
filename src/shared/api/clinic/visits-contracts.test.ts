import { describe, expect, it } from 'vitest';

import {
  canMoveVisit,
  stageAfter,
  VISIT_NOTE_LIMITS,
  VISIT_STAGE_FLOW,
  VISIT_STAGES,
  visitNoteSchema,
} from './visits-contracts.ts';

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

describe('stageAfter (a tab’s record leaves the visit where its records put it)', () => {
  it('moves the visit forward to where the record takes it', () => {
    expect(stageAfter('with_doctor', 'checkout')).toBe('checkout');
    expect(stageAfter('waiting', 'treatment')).toBe('treatment');
  });

  it('never moves it back', () => {
    expect(stageAfter('checkout', 'treatment')).toBe('checkout');
    expect(stageAfter('pharmacy', 'checkout')).toBe('pharmacy');
    expect(stageAfter('done', 'pharmacy')).toBe('done');
  });
});

describe('the consult note (Appendix F)', () => {
  it('takes complaint and plan up to 120 characters, trimmed', () => {
    const note = visitNoteSchema.parse({
      complaint: '  Review  ',
      findings: '',
      diagnoses: ['Melasma'],
      plan: 'x'.repeat(VISIT_NOTE_LIMITS.plan),
    });
    expect(note.complaint).toBe('Review');
    expect(
      visitNoteSchema.safeParse({ ...note, complaint: 'x'.repeat(121) }).success,
    ).toBe(false);
  });
});
