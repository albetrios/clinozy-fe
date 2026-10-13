import { describe, expect, it } from 'vitest';

import { TASK_TYPE_VALUES } from '@/shared/api/app/tasks-contracts.ts';

import { TASK_RULE_ICONS } from './task-rule-icons.ts';

describe('TASK_RULE_ICONS', () => {
  it('draws every type with its designed icon (`tasks.md:245–253`)', () => {
    expect(
      Object.fromEntries(
        TASK_TYPE_VALUES.map((type) => [type, TASK_RULE_ICONS[type].displayName]),
      ),
    ).toEqual({
      reply: 'MessageSquare',
      follow_up: 'Phone',
      claim: 'Users',
      failed_message: 'Info',
      confirm: 'Calendar',
      arrive: 'Clock',
      rebook: 'RefreshCw',
      feedback: 'Sparkles',
      call_back: 'Info',
      aftercare: 'Sparkles',
      next_visit: 'Calendar',
      gone_quiet: 'Phone',
      by_hand: 'Bell',
      // The rules the design did not draw take their section's icon (AMBER).
      payment_due: 'Wallet',
      settle_by: 'ReceiptText',
      medical_rep_visit: 'Pill',
    });
  });
});
