import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { TaskGroupId } from '@/shared/api/clinic/task-views.ts';
import type { TaskTab } from '@/shared/api/clinic/tasks-contracts.ts';

/** The Tasks room's i18n namespace. */
export const TASKS_NS = I18N_NAMESPACES.tasks;

/**
 * The Tasks room's keys, verbatim from `tasks.md` › Copy (KICKOFF §6.10). The
 * rule catalogue's copy — labels, descriptions, automations, how-to steps,
 * outcomes, the Snooze options — shares the namespace through
 * `TASK_RULE_KEYS` (`src/shared/clinic/task-rules.constants.ts`). Copy naming
 * the product reads `{{productName}}`.
 */
export const TASKS_KEYS = {
  manifest: { title: 'manifest.title' },
  /** The record's name in "Task not found · it may have been deleted" (`S:115`). */
  record: 'record',
  views: {
    /** The view tabs' accessible name ("Task view"). */
    label: 'views.label',
    queue: 'views.queue',
    snoozed: 'views.snoozed',
    done: 'views.done',
  } satisfies Record<TaskTab | 'label', string>,
  search: { placeholder: 'search.placeholder', label: 'search.label' },
  type: {
    /** The dropdown's name ("Task type"). */
    label: 'type.label',
    all: 'type.all',
    /** "<n> types" (plural). */
    count: 'type.count',
  },
  scope: { label: 'scope.label', mine: 'scope.mine', everyone: 'scope.everyone' },
  rulesPopover: {
    button: 'rulesPopover.button',
    /** The popover's accessible name ("Task rules"). */
    label: 'rulesPopover.label',
    title: 'rulesPopover.title',
    description: 'rulesPopover.description',
    /** A rule's line: "<source> · <description>". */
    line: 'rulesPopover.line',
    handle: 'rulesPopover.handle',
    handled: 'rulesPopover.handled',
    /** Why the switches are read-only for everyone but an Owner or Admin (AMBER). */
    readOnly: 'rulesPopover.readOnly',
  },
  primary: { newTask: 'primary.newTask' },
  groups: {
    overdue: 'groups.overdue',
    today: 'groups.today',
    later: 'groups.later',
    snoozed: 'groups.snoozed',
    done: 'groups.done',
  } satisfies Record<TaskGroupId, string>,
  row: {
    /** The pill on a rule handed to the product ("Clinozy can do this"). */
    automation: 'row.automation',
    anyone: 'row.anyone',
    /** "<owner> · was <first name>" after a reassign. */
    was: 'row.was',
    /** "✓ <result>" on a Done row. */
    result: 'row.result',
  },
  /** The source chip under the person's name: "Lead #2363", "Appt #2838", … */
  sources: {
    lead: 'sources.lead',
    appointment: 'sources.appointment',
    treatment: 'sources.treatment',
    patient: 'sources.patient',
    invoice: 'sources.invoice',
    contact: 'sources.contact',
  },
  due: {
    overdue: {
      minutes: 'due.overdue.minutes',
      hours: 'due.overdue.hours',
      days: 'due.overdue.days',
    },
    soon: { minutes: 'due.soon.minutes', hours: 'due.soon.hours' },
    /** "<day> <time>" — "Today 11:30 am", "Wed 7 Oct 3:30 pm". */
    at: 'due.at',
    snoozed: 'due.snoozed',
    done: 'due.done',
    doneNow: 'due.doneNow',
    doneByClinozy: 'due.doneByClinozy',
  },
  empty: {
    queue: 'empty.queue',
    snoozed: 'empty.snoozed',
    done: 'empty.done',
  } satisfies Record<TaskTab, string>,
} as const;

/** The room's list id: the toolbar's test-id prefix and the list error's toast id. */
export const TASKS_TABLE_ID = 'tasks';

/** `data-testid`s the room adds beside the toolbar's (`roomToolbarTestIds('tasks')`). */
export const TASKS_TEST_IDS = {
  list: 'tasks-list',
  group: (group: TaskGroupId) => `tasks-group-${group}`,
  row: 'tasks-row',
  empty: 'tasks-empty',
  emptyNew: 'tasks-empty-new',
  /** The type dropdown (the picker derives `-trigger`, `-panel`, … from it). */
  type: 'tasks-type',
  /** The Scope tablist's prefix: `tasks-scope-tabs`, `tasks-scope-tab-mine`. */
  scope: 'tasks-scope',
  rulesTrigger: 'tasks-rules-trigger',
  rules: 'tasks-rules',
  rule: (rule: string) => `tasks-rule-${rule}`,
  ruleSwitch: (rule: string) => `tasks-rule-${rule}-switch`,
  ruleHandle: (rule: string) => `tasks-rule-${rule}-handle`,
} as const;
