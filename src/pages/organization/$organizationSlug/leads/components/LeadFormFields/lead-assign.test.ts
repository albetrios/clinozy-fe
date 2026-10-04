import { describe, expect, it } from 'vitest';

import { canAssign } from './lead-assign.ts';

describe('canAssign (H:5704, A-L6)', () => {
  it('lets only the assignee reassign, to the roles theirs may', () => {
    expect(canAssign(['front_desk'], ['counsellor'], true)).toEqual({ ok: true });
    expect(canAssign(['front_desk'], ['doctor'], true)).toEqual({
      ok: false,
      reason: 'role',
    });
    expect(canAssign(['front_desk'], ['counsellor'], false)).toEqual({
      ok: false,
      reason: 'notAssignee',
    });
    expect(canAssign(['counsellor'], ['doctor'], true).ok).toBe(true);
    expect(canAssign(['doctor'], ['therapist'], true).ok).toBe(true);
    expect(canAssign(['doctor'], ['admin'], true).ok).toBe(false);
  });

  it('lets an Admin or Owner assign anyone, and Marketing as Front desk', () => {
    expect(canAssign(['admin'], ['doctor'], false)).toEqual({ ok: true });
    expect(canAssign(['owner'], ['pharmacist'], false)).toEqual({ ok: true });
    expect(canAssign(['marketing'], ['counsellor'], true).ok).toBe(true);
    expect(canAssign(['marketing'], ['doctor'], true).ok).toBe(false);
  });

  it('allows when any of several roles may', () => {
    expect(canAssign(['front_desk', 'counsellor'], ['doctor'], true).ok).toBe(true);
    expect(canAssign(['therapist'], ['front_desk', 'doctor'], true).ok).toBe(false);
  });
});
