import { describe, expect, it } from 'vitest';

import { clinicInstant } from './clinic-time.ts';
import {
  findTaskOutcome,
  LISTED_TASK_RULES,
  TASK_FOLLOW_UP_SPANS,
  TASK_RULE_IDS,
  TASK_RULES,
  TASK_SNOOZE_SPANS,
  taskDueAt,
  taskListQuerySchema,
  taskOutcomeKey,
  taskRecordSchema,
  type TaskRuleOutcome,
  taskTimeAfter,
} from './tasks-contracts.ts';

// 10:00 in the clinic (IST, UTC+5:30) on 3 Oct 2026.
const NOW = new Date('2026-10-03T04:30:00Z');
const at = (date: string, time: string) => clinicInstant(date, time);
const outcomesOf = (rule: (typeof TASK_RULE_IDS)[number]): readonly TaskRuleOutcome[] =>
  TASK_RULES[rule].outcomes;

describe('the rule catalogue', () => {
  it('holds the 13 designed rules in the Rules popover order, then Today’s two kinds', () => {
    expect(LISTED_TASK_RULES).toEqual([
      'reply',
      'follow',
      'claim',
      'failed',
      'confirm',
      'arrive',
      'rebook',
      'feedback',
      'aftercare',
      'unhappy',
      'nextvisit',
      'noreply',
      'manual',
    ]);
    expect(TASK_RULE_IDS.filter((rule) => !TASK_RULES[rule].listed)).toEqual([
      'payment',
      'recall',
    ]);
    for (const rule of TASK_RULE_IDS) expect(TASK_RULES[rule].id).toBe(rule);
  });

  it('maps every rule onto one of the contract’s seven kinds', () => {
    expect(
      Object.fromEntries(TASK_RULE_IDS.map((rule) => [rule, TASK_RULES[rule].kind])),
    ).toEqual({
      reply: 'follow_up',
      follow: 'follow_up',
      claim: 'follow_up',
      failed: 'follow_up',
      confirm: 'confirm_visit',
      arrive: 'confirm_visit',
      rebook: 'follow_up',
      feedback: 'aftercare_call',
      aftercare: 'aftercare_call',
      unhappy: 'callback',
      nextvisit: 'follow_up',
      noreply: 'follow_up',
      manual: 'manual',
      payment: 'payment_reminder',
      recall: 'follow_up',
    });
  });

  it('derives only the condition rules; outcomes and members make the rest', () => {
    expect(TASK_RULE_IDS.filter((rule) => !TASK_RULES[rule].derived)).toEqual([
      'unhappy',
      'manual',
      'payment',
      'recall',
    ]);
    expect(TASK_RULE_IDS.filter((rule) => TASK_RULES[rule].automation)).toEqual([
      'reply',
      'follow',
      'failed',
      'confirm',
      'rebook',
      'feedback',
      'aftercare',
      'nextvisit',
    ]);
  });

  it('keeps outcome ids unique per rule and maps them onto the contract’s five outcomes', () => {
    for (const rule of TASK_RULE_IDS) {
      const outcomes = outcomesOf(rule);
      expect(new Set(outcomes.map((outcome) => outcome.id)).size, rule).toBe(
        outcomes.length,
      );
      for (const outcome of outcomes) {
        if (outcome.disposition.type === 'close') {
          expect(outcome.contractOutcome, `${rule}.${outcome.id}`).not.toBeNull();
        }
        if (outcome.id === 'noAnswer') expect(outcome.contractOutcome).toBe('no_answer');
        if (outcome.disposition.type === 'none') {
          expect(outcome.contractOutcome, `${rule}.${outcome.id}`).toBeNull();
        }
      }
    }
    expect(findTaskOutcome('feedback', 'happy')?.contractOutcome).toBe('happy');
    expect(findTaskOutcome('aftercare', 'doingWell')?.contractOutcome).toBe('doing_well');
    expect(findTaskOutcome('aftercare', 'logCheckIn')?.contractOutcome).toBe(
      'log_check_in',
    );
  });

  it('opens "What’s next" after a closing outcome only (`tasks.md:140`)', () => {
    for (const rule of TASK_RULE_IDS) {
      for (const outcome of outcomesOf(rule)) {
        expect(outcome.followOn.whatsNext, `${rule}.${outcome.id}`).toBe(
          outcome.disposition.type === 'close',
        );
      }
    }
  });

  it('finds an outcome by id and names it `<rule>.<outcome>`', () => {
    expect(findTaskOutcome('reply', 'bookedVisit')?.followOn).toEqual({
      opens: 'appointmentNew',
      whatsNext: true,
    });
    expect(findTaskOutcome('reply', 'claimIt')).toBeUndefined();
    expect(taskOutcomeKey('reply', 'bookedVisit')).toBe('reply.bookedVisit');
  });
});

describe('taskDueAt', () => {
  const due = (rule: (typeof TASK_RULE_IDS)[number], anchors = {}) =>
    taskDueAt(TASK_RULES[rule].due, { now: NOW, ...anchors });

  it('anchors each rule where the rules table says (`tasks.md:42–56`)', () => {
    expect(due('reply', { messageAt: '2026-10-03T04:00:00.000Z' })).toBe(
      '2026-10-03T04:30:00.000Z',
    );
    expect(due('follow', { followUpDate: '2026-10-02' })).toBe(at('2026-10-02', '11:00'));
    expect(due('claim')).toBe('2026-10-03T07:30:00.000Z');
    expect(due('failed')).toBe('2026-10-03T04:05:00.000Z');
    expect(due('arrive', { visit: { date: '2026-10-03', startTime: '09:30' } })).toBe(
      at('2026-10-03', '09:45'),
    );
    expect(due('rebook', { visit: { date: '2026-10-01', startTime: '11:30' } })).toBe(
      at('2026-10-02', '11:00'),
    );
    expect(due('feedback')).toBe(at('2026-10-03', '12:00'));
    expect(due('unhappy')).toBe(at('2026-10-03', '18:00'));
    expect(due('nextvisit')).toBe(at('2026-10-03', '17:00'));
    expect(due('noreply')).toBe(at('2026-10-03', '12:00'));
    expect(
      due('aftercare', { treatment: { date: '2026-10-03', callAfterDays: 2 } }),
    ).toBe(at('2026-10-05', '11:00'));
  });

  it('confirms a near visit 2 h before it and a far one at 18:00 the day before', () => {
    expect(due('confirm', { visit: { date: '2026-10-03', startTime: '15:30' } })).toBe(
      at('2026-10-03', '13:30'),
    );
    expect(due('confirm', { visit: { date: '2026-10-04', startTime: '15:30' } })).toBe(
      at('2026-10-03', '18:00'),
    );
  });

  it('has no due of its own for a picked rule or a missing anchor', () => {
    expect(due('manual')).toBeNull();
    expect(due('reply')).toBeNull();
    expect(due('confirm')).toBeNull();
  });
});

describe('time spans', () => {
  it('snoozes "Tomorrow 10:00" to 10:00 tomorrow in the clinic, not 24 hours on', () => {
    // 01:30 on 4 Oct in the clinic: tomorrow is the 5th.
    const lateNight = new Date('2026-10-03T20:00:00Z');
    expect(taskTimeAfter(TASK_SNOOZE_SPANS.tomorrow, lateNight)).toBe(
      at('2026-10-05', '10:00'),
    );
    expect(taskTimeAfter(TASK_SNOOZE_SPANS.oneHour, NOW)).toBe(
      '2026-10-03T05:30:00.000Z',
    );
    expect(taskTimeAfter(TASK_SNOOZE_SPANS.threeHours, NOW)).toBe(
      '2026-10-03T07:30:00.000Z',
    );
    expect(taskTimeAfter(TASK_SNOOZE_SPANS.nextWeek, NOW)).toBe(
      '2026-10-10T04:30:00.000Z',
    );
  });

  it('dates a "What’s next" follow-up in 3 h, tomorrow 11:00, in 3 or 7 days (`tasks.md:98`)', () => {
    expect(taskTimeAfter(TASK_FOLLOW_UP_SPANS.inThreeHours, NOW)).toBe(
      '2026-10-03T07:30:00.000Z',
    );
    expect(taskTimeAfter(TASK_FOLLOW_UP_SPANS.tomorrow, NOW)).toBe(
      at('2026-10-04', '11:00'),
    );
    expect(taskTimeAfter(TASK_FOLLOW_UP_SPANS.inThreeDays, NOW)).toBe(
      '2026-10-06T04:30:00.000Z',
    );
    expect(taskTimeAfter(TASK_FOLLOW_UP_SPANS.nextWeek, NOW)).toBe(
      '2026-10-10T04:30:00.000Z',
    );
  });
});

describe('the list query', () => {
  it('defaults to my To do, every type, no search', () => {
    expect(taskListQuerySchema.parse({})).toEqual({
      tab: 'queue',
      scope: 'mine',
      type: [],
      q: '',
    });
  });

  it('trims the search and refuses one longer than 80 characters or an unknown rule', () => {
    expect(taskListQuerySchema.parse({ q: '  priti ' }).q).toBe('priti');
    expect(taskListQuerySchema.safeParse({ q: 'x'.repeat(81) }).success).toBe(false);
    expect(taskListQuerySchema.safeParse({ type: ['reply', 'nope'] }).success).toBe(
      false,
    );
    expect(taskListQuerySchema.safeParse({ tab: 'open' }).success).toBe(false);
  });
});

describe('the task record', () => {
  const record = {
    organizationId: '5f0c8a43-5e8e-4f45-9f8a-0d0b7d6c1a10',
    createdAt: '2026-10-03T04:30:00Z',
    updatedAt: '2026-10-03T04:30:00Z',
    createdById: '5f0c8a43-5e8e-4f45-9f8a-0d0b7d6c1a11',
    deletedAt: null,
    deleteReason: null,
    deleteNote: null,
    id: '5f0c8a43-5e8e-4f45-9f8a-0d0b7d6c1a12',
    kind: 'follow_up',
    title: 'Reply to Kabir',
    why: 'Wrote on Instagram · waiting 12 min',
    ownerId: null,
    ownerRole: null,
    patientId: null,
    leadId: null,
    sourceType: 'lead',
    sourceId: null,
    dueAt: '2026-10-03T05:00:00Z',
    status: 'done',
    snoozedUntil: null,
    outcome: 'done',
    resolvedAt: '2026-10-03T04:40:00Z',
    rule: 'reply',
    ruleKey: 'reply:lead:message',
    ruleOutcome: 'reply.notInterested',
    result: 'Not interested · asked twice',
    note: 'asked twice',
    resolvedBy: 'member',
    resolvedById: '5f0c8a43-5e8e-4f45-9f8a-0d0b7d6c1a11',
    snoozeLabel: null,
    previousOwnerIds: [],
  };

  it('is the contract’s Task plus the plan’s fields', () => {
    expect(taskRecordSchema.strict().parse(record)).toEqual(record);
  });

  it('refuses an unknown rule or a note over 200 characters', () => {
    expect(taskRecordSchema.safeParse({ ...record, rule: 'nope' }).success).toBe(false);
    expect(taskRecordSchema.safeParse({ ...record, note: 'x'.repeat(201) }).success).toBe(
      false,
    );
  });
});
