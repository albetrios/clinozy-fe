import { describe, expect, it } from 'vitest';

import { TASK_RULE_IDS } from '@/shared/api/clinic/tasks-contracts.ts';

import { TASK_RULE_ICONS } from './task-rule-icons.ts';

describe('TASK_RULE_ICONS', () => {
  it('draws every rule with its designed icon (`tasks.md:245–253`)', () => {
    expect(
      Object.fromEntries(
        TASK_RULE_IDS.map((rule) => [rule, TASK_RULE_ICONS[rule].displayName]),
      ),
    ).toEqual({
      reply: 'MessageSquare',
      follow: 'Phone',
      claim: 'Users',
      failed: 'Info',
      confirm: 'Calendar',
      arrive: 'Clock',
      rebook: 'RefreshCw',
      feedback: 'Sparkles',
      aftercare: 'Sparkles',
      unhappy: 'Info',
      nextvisit: 'Calendar',
      noreply: 'Phone',
      manual: 'Bell',
      // Today's two kinds have no designed icon (AMBER).
      payment: 'Wallet',
      recall: 'Calendar',
    });
  });
});
