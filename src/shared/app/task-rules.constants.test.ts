import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  TASK_FOLLOW_UP_WHEN,
  TASK_RULE_GROUPS,
  TASK_SNOOZE_OPTIONS,
  TASK_TYPE_VALUES,
  TASK_TYPES,
  type TaskType,
} from '@/shared/api/app/tasks-contracts.ts';

import { TASK_RULE_KEYS, TASK_RULES_NS } from './task-rules.constants.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const bundle = (locale: string) =>
  JSON.parse(
    readFileSync(join(root, `src/locales/${locale}/${TASK_RULES_NS}.json`), 'utf8'),
  ) as Record<string, unknown>;
const lookup = (tree: unknown, key: string) =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], tree);

/** The rules clinozy-be can take a step for itself (`can_be_automatic`, route map §4 #21). */
const AUTOMATIC_TYPES: readonly TaskType[] = [
  'confirm',
  'feedback',
  'payment_due',
  'gone_quiet',
];

/** The rules the design never drew — no "How" steps. */
const UNDRAWN_TYPES: readonly TaskType[] = [
  'payment_due',
  'settle_by',
  'medical_rep_visit',
];

describe('TASK_RULE_KEYS', () => {
  it('lives in the tasks namespace', () => {
    expect(TASK_RULES_NS).toBe('tasks');
  });

  it('names every type and every outcome of the catalogue — no more, no fewer', () => {
    expect(Object.keys(TASK_RULE_KEYS.rules)).toEqual([...TASK_TYPE_VALUES]);
    expect(Object.keys(TASK_RULE_KEYS.groups)).toEqual([...TASK_RULE_GROUPS]);
    expect(Object.keys(TASK_RULE_KEYS.snoozeOptions)).toEqual([...TASK_SNOOZE_OPTIONS]);
    expect(Object.keys(TASK_RULE_KEYS.followUpWhen)).toEqual([...TASK_FOLLOW_UP_WHEN]);
    for (const type of TASK_TYPE_VALUES) {
      const keys = TASK_RULE_KEYS.rules[type];
      const outcomes: readonly { id: string }[] = TASK_TYPES[type].outcomes;
      expect(Object.keys(keys.outcomes), type).toEqual(
        outcomes.map((outcome) => outcome.id),
      );
      expect(keys.automation !== null, type).toBe(AUTOMATIC_TYPES.includes(type));
      expect(keys.how, type).toHaveLength(UNDRAWN_TYPES.includes(type) ? 0 : 3);
    }
  });

  it('keeps the design’s rule ids as the copy’s segments', () => {
    expect(TASK_RULE_KEYS.rules.follow_up.label).toBe('rules.follow.label');
    expect(TASK_RULE_KEYS.rules.call_back.label).toBe('rules.unhappy.label');
    expect(TASK_RULE_KEYS.rules.gone_quiet.label).toBe('rules.noreply.label');
    expect(TASK_RULE_KEYS.rules.by_hand.label).toBe('rules.manual.label');
  });

  it('resolves every key to copy in every locale', () => {
    const keys: string[] = [
      ...Object.values(TASK_RULE_KEYS.groups),
      ...Object.values(TASK_RULE_KEYS.snoozeOptions),
      ...Object.values(TASK_RULE_KEYS.followUpWhen),
      ...Object.values(TASK_RULE_KEYS.rules).flatMap((rule) => [
        rule.label,
        rule.description,
        ...(rule.automation ? [rule.automation] : []),
        ...rule.how,
        ...Object.values(rule.outcomes).flatMap(
          (outcome: { label: string; effect: string }) => [outcome.label, outcome.effect],
        ),
      ]),
    ];
    for (const locale of [
      'en',
      'ar',
      'de',
      'es',
      'fr',
      'hi',
      'it',
      'ja',
      'ko',
      'pt',
      'zh',
    ]) {
      const copy = bundle(locale);
      for (const key of keys) {
        expect(typeof lookup(copy, key), `${locale} ${key}`).toBe('string');
      }
    }
  });
});
