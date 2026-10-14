import { z } from 'zod';

import { type TaskKind, taskSchema } from './app-schema.ts';

/**
 * The fixture world's task record — what `world.tasks` holds for the chat column's fixture path:
 * the fixture chat history (`messages-api.ts`) and the fixture contact threads
 * (`fixtures/contact-threads.fixtures.ts`). The Tasks room and Today's work queue read clinozy-be
 * (`tasks-contracts.ts`, D155) — no fixture server or rule job runs on these any more; this goes
 * with the chat's fixture path.
 */

/**
 * The design's rule ids a fixture task carries, in the Rules popover's order (`tasks.md:42–56`),
 * then the two kinds the plan added for Today — Payment due and Recall.
 */
const TASK_RULE_IDS = [
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
  'payment',
  'recall',
] as const;
/** Zod enum of the rule ids. */
const taskRuleIdSchema = z.enum(TASK_RULE_IDS);
/** One fixture rule id. */
export type TaskRuleId = z.infer<typeof taskRuleIdSchema>;

/** The contract's `task_kind` each fixture rule's tasks store (`schema-routes.md` S:1498–1531). */
export const TASK_RULE_KINDS: Readonly<Record<TaskRuleId, TaskKind>> = {
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
};

/** New task's Type chips as the fixture record keeps them (the design's; the API has none). */
const MANUAL_TASK_TYPES = [
  'call_back',
  'follow_up',
  'send_price',
  'ask_for_photos',
  'feedback',
  'payment_reminder',
] as const;

/** New task's priority, "Normal · High". */
const TASK_PRIORITIES = ['normal', 'high'] as const;

/** Who resolved a task: a member, or Clinozy (a rule closing itself, an automation). */
const TASK_RESOLVERS = ['member', 'clinozy'] as const;

/** The outcome note's limit (`tasks.md:78`). */
const TASK_NOTE_MAX = 200;

/**
 * A task as the fixture world stores it: the contract's `Task` plus the plan-only fields the
 * design drew — its rule, the rule match it was derived for, the rule outcome that closed or
 * snoozed it, the result text, the note, who resolved it, the snooze label, the owners it was
 * moved from, and New task's type, priority and reminder.
 */
export const taskRecordSchema = taskSchema.extend({
  rule: taskRuleIdSchema,
  ruleKey: z.string().nullable(),
  ruleOutcome: z.string().nullable(),
  result: z.string().nullable(),
  note: z.string().max(TASK_NOTE_MAX).nullable(),
  resolvedBy: z.enum(TASK_RESOLVERS).nullable(),
  resolvedById: z.uuid().nullable(),
  snoozeLabel: z.string().nullable(),
  previousOwnerIds: z.array(z.uuid()),
  /** New task's Type; null for a task a rule or "What’s next" created. */
  manualType: z.enum(MANUAL_TASK_TYPES).nullable(),
  priority: z.enum(TASK_PRIORITIES),
  /** Minutes before due to remind the owner ("Remind 15 min before"); null for none. */
  remindMinutesBefore: z.number().int().positive().nullable(),
});
/** A stored fixture task. */
export type TaskRecord = z.infer<typeof taskRecordSchema>;
