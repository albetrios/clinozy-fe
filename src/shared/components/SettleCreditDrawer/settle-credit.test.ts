import { describe, expect, it } from 'vitest';

import { creditRow } from '@/tests/utils/payments-doubles.ts';

import {
  owedInPaise,
  settlementOf,
  settleProblem,
  settleStart,
} from './settle-credit.ts';

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');

describe('the give-back form (payments.md:170–180)', () => {
  it('opens on what the server says is left, in UPI, today, at the branch given', () => {
    expect(owedInPaise(creditRow({ left: 30 }))).toBe(3_000);
    expect(owedInPaise(creditRow({ left: 1_250.5 }))).toBe(125_050);
    expect(settleStart({ owed: 3_000, branchId: 'brn_a', today: '2026-10-10' })).toEqual({
      branchId: 'brn_a',
      paidOn: '2026-10-10',
      splits: [{ mode: 'upi', amount: 3_000 }],
    });
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

describe('what a give-back or a get-back sends', () => {
  it('gives back at the branch, in rupees, with no day for today', () => {
    expect(
      settlementOf({
        values: {
          branchId: 'brn_a',
          paidOn: '2026-10-10',
          splits: [
            { mode: 'cash', amount: 10_050 },
            { mode: 'upi', amount: 0 },
          ],
        },
        direction: 'give',
        fallbackBranch: 'brn_main',
        now: NOW,
      }),
    ).toEqual({
      action: 'give_back',
      branchId: 'brn_a',
      splits: [{ mode: 'cash', amount: 100.5 }],
    });
  });

  it('gets back on an earlier day as that clinic day at the clock time now', () => {
    expect(
      settlementOf({
        values: {
          branchId: null,
          paidOn: '2026-10-09',
          splits: [{ mode: 'upi', amount: 5_000 }],
        },
        direction: 'take',
        fallbackBranch: 'brn_main',
        now: NOW,
      }),
    ).toEqual({
      action: 'got_back',
      branchId: 'brn_main',
      splits: [{ mode: 'upi', amount: 50 }],
      paidAt: '2026-10-09T04:30:00.000Z',
    });
  });
});
