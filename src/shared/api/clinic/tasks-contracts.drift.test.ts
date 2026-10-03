import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TASK_RULE_ICONS } from '@/shared/clinic/task-rule-icons.ts';
import { TASK_RULE_KEYS } from '@/shared/clinic/task-rules.constants.ts';

import {
  CONFIRMED_BY_WHATSAPP_RESULT,
  type OutcomeServerText,
  selfCloseResult,
  suggestedMessage,
  TASK_AUTOMATION_TEXT,
  TASK_OUTCOME_TEXT,
  TASK_SNOOZE_LABELS,
  taskClosedLine,
  taskMovedLine,
  unhappyTaskText,
} from './fixtures/task-rules.fixtures.ts';
import {
  findTaskOutcome,
  LISTED_TASK_RULES,
  TASK_RULES,
  type TaskDueRule,
  type TaskFollowOnForm,
  taskOutcomeKey,
  type TaskOwnerRule,
  type TaskRuleId,
  type TaskRuleOutcome,
  type TaskTimeSpan,
} from './tasks-contracts.ts';

/**
 * The rule catalogue is the design's, verbatim (KICKOFF §6.10): this reads the
 * locked intake specs — `tasks.md` (the rules table, the outcome table, the
 * Copy rows) and `today.md` (the two kinds the plan adds) — and holds the
 * catalogue, its English copy, the server's text and the icons to them.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const intake = (file: string) =>
  readFileSync(
    join(root, 'iterations/launch-2026-09-30-jxmr/intake-files', file),
    'utf8',
  );
const tasksMd = intake('tasks.md').split('\n');
const todayMd = intake('today.md').split('\n');
const en = JSON.parse(readFileSync(join(root, 'src/locales/en/tasks.json'), 'utf8')) as {
  ruleGroups: Record<string, string>;
  rules: Record<
    string,
    {
      label: string;
      description: string;
      automation?: string;
      how?: Record<string, string>;
      outcomes: Record<string, { label: string; effect: string }>;
    }
  >;
  snoozeOptions: Record<string, string>;
  followUpWhen: Record<string, string>;
};

/** A table row's cells — an escaped `\|` stays inside its cell. */
const cells = (line: string) =>
  line
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((cell) => cell.trim());
/** The "…"-quoted strings of a cell, in order (the spec's inner quotes are curly). */
const quoted = (text: string) =>
  text.split('"').filter((_part, index) => index % 2 === 1);
/** The quoted strings of the Copy row that starts with `prefix`. */
const copyRow = (prefix: string) =>
  quoted(cells(tasksMd.find((row) => row.startsWith(`| ${prefix}`)) ?? '')[1] ?? '');
const keyPath = (key: string) =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], en);
/** `<owner>` in the spec is `{{owner}}` in the namespace. */
const asI18n = (text: string) => text.replace(/<(owner|doctor|first)>/g, '{{$1}}');

/** The literal stretches of a spec template, around its `<placeholders>`. */
function literalParts(template: string): string[] {
  const parts = [''];
  let inside = false;
  for (const char of template) {
    if (char === '<') {
      inside = true;
      parts.push('');
    } else if (char === '>' && inside) {
      inside = false;
    } else if (!inside) {
      parts[parts.length - 1] += char;
    }
  }
  return parts;
}

/** Whether `text` is the template with each `<placeholder>` filled in. */
function fitsTemplate(text: string, template: string): boolean {
  const parts = literalParts(template);
  if (parts.length === 1) return text === template;
  const head = parts[0] ?? '';
  const tail = parts.at(-1) ?? '';
  if (!(text.startsWith(head) && text.endsWith(tail))) return false;
  let cursor = head.length;
  for (const part of parts.slice(1, -1)) {
    const found = text.indexOf(part, cursor + 1);
    if (found < 0) return false;
    cursor = found + part.length;
  }
  return cursor < text.length - tail.length;
}

const expectFits = (text: string | undefined, template: string) =>
  expect(fitsTemplate(text ?? '', template), `"${text}" ≁ "${template}"`).toBe(true);

const DESIGNED = LISTED_TASK_RULES;
const ruleByLabel = new Map<string, TaskRuleId>(
  DESIGNED.map((rule) => [en.rules[rule]?.label ?? '', rule]),
);
const ruleOf = (label: string): TaskRuleId => {
  const rule = ruleByLabel.get(label);
  if (!rule) throw new Error(`no rule labelled "${label}"`);
  return rule;
};

describe('the rules table (`tasks.md:42–56`)', () => {
  const start = tasksMd.findIndex((line) => line.startsWith('| Rule | Tone · icon'));
  const rows = tasksMd.slice(start + 2, start + 15).map(cells);

  const OWNERS: Record<string, TaskOwnerRule> = {
    'lead owner': 'leadOwner',
    'none ("Anyone")': 'nobody',
    me: 'viewer',
    "the visit's doctor": 'visitDoctor',
    'as picked': 'picked',
  };
  const DUES: Record<string, TaskDueRule> = {
    '30 min after their message': { from: 'message', minutes: 30 },
    'follow-up date 11:00': { from: 'followUpDate', at: '11:00' },
    'now + 3 h': { from: 'now', minutes: 180 },
    '25 min ago (always overdue)': { from: 'now', minutes: -25 },
    '2 h before the visit if it is < 20 h away, else 18:00 the day before': {
      from: 'visitStart',
      minutes: -120,
      beyondHours: 20,
      dayBeforeAt: '18:00',
    },
    'start + 15 min': { from: 'visitStart', minutes: 15 },
    'next day 11:00': { from: 'visitDay', days: 1, at: '11:00' },
    'today 12:00': { from: 'today', at: '12:00' },
    'treatment date + N days': { from: 'treatmentDay', at: '11:00' },
    'today 18:00': { from: 'today', at: '18:00' },
    'today 17:00': { from: 'today', at: '17:00' },
    'as picked': { from: 'picked' },
  };
  const pascal = (icon: string) =>
    icon
      .replace(/`/g, '')
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');

  it('lists the 13 rules in the catalogue’s order, with their labels', () => {
    expect(rows).toHaveLength(13);
    expect(rows.map(([label]) => ruleOf(label ?? ''))).toEqual([...DESIGNED]);
  });

  it.each(DESIGNED.map((rule, index) => [rule, index] as const))(
    '%s: tone, icon, due and owner',
    (rule, index) => {
      const [, toneIcon = '', , , , due = '', owner = ''] = rows[index] ?? [];
      const [tone, icon = ''] = toneIcon.split(' · ');
      expect(TASK_RULES[rule].tone).toBe(tone);
      expect(TASK_RULE_ICONS[rule].displayName).toBe(pascal(icon));
      expect(TASK_RULES[rule].due).toEqual(DUES[due]);
      expect(TASK_RULES[rule].owner).toBe(OWNERS[owner]);
    },
  );

  it('writes the Unhappy patients task’s title and why as designed', () => {
    const [title = '', why = ''] = quoted(rows[9]?.[4] ?? '');
    const made = unhappyTaskText({
      first: '<first>',
      service: '<service>',
      visitDate: '2026-10-02',
      today: '2026-10-03',
    });
    expect(made.title).toBe(title);
    expectFits(made.why, why);
  });
});

describe('the rule copy (`tasks.md:314–346`)', () => {
  it.each([...DESIGNED])('%s: group, description, automation and steps', (rule) => {
    const copy = en.rules[rule];
    const [line = '', automation] = copyRow(`rule — ${copy?.label} |`);
    const [group, description] = line.split(' · ');
    expect(en.ruleGroups[TASK_RULES[rule].group]).toBe(group);
    expect(copy?.description).toBe(description);
    expect(copy?.automation).toBe(automation);
    expect(TASK_AUTOMATION_TEXT[rule]).toBe(automation);
    expect(TASK_RULES[rule].automation).toBe(automation !== undefined);
    expect(Object.values(copy?.how ?? {})).toEqual(copyRow(`how — ${copy?.label} |`));
    expect(TASK_RULE_KEYS.rules[rule].how).toHaveLength(3);
  });

  it('names the Snooze options and the "What’s next" When chips verbatim', () => {
    const snooze = copyRow('snooze options');
    expect(Object.values(en.snoozeOptions)).toEqual(snooze);
    expect(Object.values(TASK_SNOOZE_LABELS)).toEqual(snooze);
    expect(Object.values(en.followUpWhen)).toEqual(copyRow('what’s next chips').slice(5));
  });

  it('closes a task itself with the designed results (`tasks.md:310`)', () => {
    const [confirm, reply, other = '', whatsApp] = copyRow('resolved by');
    expect(selfCloseResult('confirm')).toBe(confirm);
    expect(selfCloseResult('reply')).toBe(reply);
    expectFits(selfCloseResult('rebook'), other);
    expect(selfCloseResult('rebook')).toBe('Resolved in Appointments');
    expect(CONFIRMED_BY_WHATSAPP_RESULT).toBe(whatsApp);
  });

  it('writes the chat lines and the suggested WhatsApps verbatim (`tasks.md:348, 357`)', () => {
    const [closed, moved] = copyRow('lead chat lines');
    expect(taskClosedLine('<result>')).toBe(closed);
    expect(taskMovedLine('<A>', '<B>')).toBe(moved);
    const segments = (
      cells(tasksMd.find((row) => row.startsWith('| suggested WhatsApp')) ?? '')[1] ?? ''
    ).split('"');
    const names = segments
      .filter((_part, index) => index % 2 === 0)
      .map((part) => part.replace('·', '').trim())
      .filter(Boolean);
    const messages = segments.filter((_part, index) => index % 2 === 1);
    const RULE: Record<string, TaskRuleId> = {
      reply: 'reply',
      'follow-up': 'follow',
      confirm: 'confirm',
      rebook: 'rebook',
      feedback: 'feedback',
      aftercare: 'aftercare',
    };
    expect(names).toEqual(Object.keys(RULE));
    names.forEach((name, index) => {
      expect(
        suggestedMessage(RULE[name] ?? 'manual', {
          first: '<first>',
          interest: '<interest>',
          visit: { service: '<service>', day: '<day>', time: '<h:mm am>' },
        }),
      ).toBe(messages[index]);
    });
  });
});

describe('the outcome table (`tasks.md:185–227`)', () => {
  const start = tasksMd.findIndex((line) =>
    line.startsWith('| Rule | Outcome | Effect line'),
  );
  const end = tasksMd.findIndex((line, index) => index > start && !line.startsWith('|'));
  const rows = tasksMd
    .slice(start + 2, end)
    .map(cells)
    .filter(([rule]) => rule !== 'any rule with an automation');

  const SAMPLE = { doctor: 'Dr. Reenal', followUpDate: '2026-10-17', visitSeq: 2838 };

  const spanOf = (label: string): TaskTimeSpan => {
    const [amount = '', unit] = label.split(' ');
    if (unit === 'h') return { kind: 'minutes', minutes: Number(amount) * 60 };
    if (unit === 'min') return { kind: 'minutes', minutes: Number(amount) };
    if (label.startsWith('a week')) return { kind: 'days', days: 7 };
    return { kind: 'tomorrowAt', at: '10:00' };
  };

  const FORMS: ReadonlyArray<readonly [string, TaskFollowOnForm]> = [
    ['appointment form (move)', 'appointmentMove'],
    ['Log review drawer', 'reviewLog'],
    ['Visit check-in drawer', 'visitCheckIn'],
    ['Aftercare check-in drawer', 'aftercareCheckIn'],
    ['patient file', 'patientFile'],
  ];
  const followOnOf = (then: string, effect: string) => {
    if (then.startsWith('none')) return { opens: null, whatsNext: false };
    if (then.startsWith('drawer closes'))
      return { opens: 'personRecord', whatsNext: false };
    const form = FORMS.find(([words]) => then.includes(words))?.[1];
    const booking = effect.includes('same service')
      ? 'appointmentRebook'
      : 'appointmentNew';
    return {
      opens: form ?? (then.includes('appointment form') ? booking : null),
      whatsNext: then.includes('What’s next'),
    };
  };

  /** The catalogue outcome a table row names. */
  const outcomeOfRow = (ruleLabel: string, outcomeCell: string) => {
    const rule = ruleOf(ruleLabel);
    const label = quoted(outcomeCell)[0];
    const outcome = (TASK_RULES[rule].outcomes as readonly TaskRuleOutcome[]).find(
      (candidate) => en.rules[rule]?.outcomes[candidate.id]?.label === label,
    );
    if (!(outcome && findTaskOutcome(rule, outcome.id))) {
      throw new Error(`no outcome "${label}" on ${rule}`);
    }
    return { rule, outcome };
  };

  /** "What it writes": a closing result, a snooze label, a call note, a WhatsApp. */
  const writesOf = (writes: string) => {
    const quotedAfter = (marker: string) =>
      writes.includes(`${marker} "`)
        ? writes.split(`${marker} "`)[1]?.split('"')[0]
        : undefined;
    return {
      result: quotedAfter('result'),
      snoozed: quotedAfter('snoozed'),
      callNote: quotedAfter('call logged'),
      whatsApp: quotedAfter('WhatsApp'),
    };
  };

  const expectDisposition = (
    outcome: TaskRuleOutcome,
    text: OutcomeServerText | undefined,
    { result, snoozed }: ReturnType<typeof writesOf>,
  ) => {
    if (result) {
      expect(outcome.disposition.type).toBe('close');
      expectFits(text?.result?.(SAMPLE), result);
    } else if (snoozed) {
      expect(outcome.disposition).toEqual({ type: 'snooze', span: spanOf(snoozed) });
      expect(text?.snoozeLabel).toBe(snoozed);
    } else {
      expect(outcome.disposition.type).toBe('none');
    }
  };

  const expectMessages = (
    outcome: TaskRuleOutcome,
    text: OutcomeServerText | undefined,
    { callNote, whatsApp }: ReturnType<typeof writesOf>,
  ) => {
    if (callNote) {
      expect(outcome.effects).toContainEqual({ type: 'logCall' });
      expect(text?.callNote).toBe(callNote);
    }
    if (whatsApp) {
      expect(outcome.effects).toContainEqual({ type: 'sendWhatsApp' });
      expectFits(text?.whatsApp?.(SAMPLE), whatsApp);
    }
  };

  it('has every designed outcome, in button order, for every designed rule', () => {
    expect(rows).toHaveLength(40);
    for (const rule of DESIGNED) {
      const designed = rows
        .filter(([label]) => ruleOf(label ?? '') === rule)
        .map(([, outcome = '']) => quoted(outcome)[0]);
      const labels = TASK_RULES[rule].outcomes.map(
        (outcome) => en.rules[rule]?.outcomes[outcome.id]?.label,
      );
      expect(labels, rule).toEqual(designed);
    }
  });

  it.each(rows.map((row) => [`${row[0]} · ${quoted(row[1] ?? '')[0]}`, row] as const))(
    '%s',
    (
      _name,
      [ruleLabel = '', outcomeCell = '', effectCell = '', writes = '', then = ''],
    ) => {
      const { rule, outcome } = outcomeOfRow(ruleLabel, outcomeCell);
      const effect = quoted(effectCell)[0] ?? '';
      const keys = TASK_RULE_KEYS.rules[rule].outcomes as Record<
        string,
        { effect: string }
      >;
      // The button's effect line (UI copy), and what follows the outcome.
      expect(keyPath(keys[outcome.id]?.effect ?? '')).toBe(asI18n(effect));
      expect(outcome.followOn).toEqual(followOnOf(then, effect));
      // What it writes (server text).
      const text = TASK_OUTCOME_TEXT[taskOutcomeKey(rule, outcome.id)];
      expect(text, `${rule}.${outcome.id}`).toBeDefined();
      expectDisposition(outcome, text, writesOf(writes));
      expectMessages(outcome, text, writesOf(writes));
    },
  );
});

describe('Today’s two kinds in the catalogue (`today.md:72, 238–242`)', () => {
  /** The `"Outcome" → "Result"` pairs of Today's seed tasks of one kind. */
  const pairsOf = (prefix: string) =>
    todayMd
      .filter((line) => line.startsWith(`| ${prefix}`))
      .flatMap((line) => {
        // Quoted and unquoted stretches alternate; a lone " → " joins a pair.
        const segments = (cells(line)[1] ?? '').split('"');
        const pairs: Array<[string, string]> = [];
        for (let index = 2; index + 1 < segments.length; index += 2) {
          if (segments[index] === ' → ') {
            pairs.push([segments[index - 1] ?? '', segments[index + 1] ?? '']);
          }
        }
        return pairs;
      });

  it('names Payment due and Recall in their work-queue tones', () => {
    const kinds = todayMd.find((line) => line.startsWith('Kinds and tones:')) ?? '';
    expect(kinds).toContain(`"${en.rules.payment?.label}" ${TASK_RULES.payment.tone}`);
    expect(kinds).toContain(`"${en.rules.recall?.label}" ${TASK_RULES.recall.tone}`);
  });

  it.each([
    ['payment', 'seed task — Payment due'],
    ['recall', 'seed task — Recall'],
  ] as const)('%s keeps its designed outcomes and results', (rule, prefix) => {
    const designed = new Map<string, string>();
    for (const [outcome, result] of pairsOf(prefix)) {
      if (!designed.has(outcome)) designed.set(outcome, result);
    }
    const outcomes = TASK_RULES[rule].outcomes as readonly TaskRuleOutcome[];
    expect(
      outcomes.map((outcome) => en.rules[rule]?.outcomes[outcome.id]?.label),
    ).toEqual([...designed.keys()]);
    for (const outcome of outcomes) {
      const result = designed.get(en.rules[rule]?.outcomes[outcome.id]?.label ?? '');
      const text = TASK_OUTCOME_TEXT[taskOutcomeKey(rule, outcome.id)];
      expect(
        outcome.disposition.type === 'snooze'
          ? `Snoozed ${text?.snoozeLabel}`
          : text?.result?.({ doctor: '', followUpDate: '', visitSeq: null }),
      ).toBe(result);
    }
  });
});
