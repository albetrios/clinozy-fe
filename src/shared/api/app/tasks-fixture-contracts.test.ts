import { describe, expect, it } from 'vitest';

import { TASK_RULE_KINDS, taskRecordSchema } from './tasks-fixture-contracts.ts';

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
    manualType: null,
    priority: 'normal',
    remindMinutesBefore: null,
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

describe('the fixture rules’ kinds', () => {
  it('stores each rule as one of the contract’s seven kinds', () => {
    expect(TASK_RULE_KINDS).toMatchObject({
      confirm: 'confirm_visit',
      aftercare: 'aftercare_call',
      unhappy: 'callback',
      manual: 'manual',
      payment: 'payment_reminder',
      recall: 'follow_up',
    });
  });
});
