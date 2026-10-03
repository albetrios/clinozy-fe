import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  TASK_FOLLOW_UP_WHEN,
  TASK_RULE_GROUPS,
  TASK_RULE_IDS,
  TASK_RULES,
  TASK_SNOOZE_OPTIONS,
} from '@/shared/api/clinic/tasks-contracts.ts';

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

describe('TASK_RULE_KEYS', () => {
  it('lives in the tasks namespace', () => {
    expect(TASK_RULES_NS).toBe('tasks');
  });

  it('names every rule and every outcome of the catalogue — no more, no fewer', () => {
    expect(Object.keys(TASK_RULE_KEYS.rules)).toEqual([...TASK_RULE_IDS]);
    expect(Object.keys(TASK_RULE_KEYS.groups)).toEqual([...TASK_RULE_GROUPS]);
    expect(Object.keys(TASK_RULE_KEYS.snoozeOptions)).toEqual([...TASK_SNOOZE_OPTIONS]);
    expect(Object.keys(TASK_RULE_KEYS.followUpWhen)).toEqual([...TASK_FOLLOW_UP_WHEN]);
    for (const rule of TASK_RULE_IDS) {
      const keys = TASK_RULE_KEYS.rules[rule];
      expect(Object.keys(keys.outcomes), rule).toEqual(
        TASK_RULES[rule].outcomes.map((outcome) => outcome.id),
      );
      expect(keys.automation !== null, rule).toBe(TASK_RULES[rule].automation);
      expect(keys.how, rule).toHaveLength(TASK_RULES[rule].listed ? 3 : 0);
    }
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
