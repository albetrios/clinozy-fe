import { describe, expect, it } from 'vitest';

import { owedOn, settleProblem, settleStart } from './settle-credit.ts';

describe('the give-back form (payments.md:170–180)', () => {
  it('opens on everything still owed, in UPI', () => {
    expect(owedOn({ amount: 50_000, adjusted: 20_000 })).toBe(30_000);
    expect(owedOn({ amount: 50_000, adjusted: 60_000 })).toBe(0);
    expect(settleStart(30_000)).toEqual({ splits: [{ mode: 'upi', amount: 30_000 }] });
  });

  it('wants an amount, and at most what is owed', () => {
    expect(settleProblem({ splits: [{ mode: 'upi', amount: 0 }] }, 50_000)).toBe(
      'amount',
    );
    expect(
      settleProblem(
        {
          splits: [
            { mode: 'upi', amount: 40_000 },
            { mode: 'cash', amount: 20_000 },
          ],
        },
        50_000,
      ),
    ).toBe('moreThanOwed');
    expect(
      settleProblem({ splits: [{ mode: 'cash', amount: 50_000 }] }, 50_000),
    ).toBeNull();
  });
});
