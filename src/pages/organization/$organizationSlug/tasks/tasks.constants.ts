import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { TaskGroupId } from '@/shared/api/app/task-views.ts';
import type {
  TaskLinkKind,
  TaskPriority,
  TaskTab,
} from '@/shared/api/app/tasks-contracts.ts';
import { TASK_QUEUE_KEYS } from '@/shared/app/task-rules.constants.ts';

/** The Tasks room's i18n namespace. */
export const TASKS_NS = I18N_NAMESPACES.tasks;

/**
 * The Tasks room's keys, verbatim from `tasks.md` › Copy (KICKOFF §6.10). The
 * rule catalogue's copy — labels, descriptions, automations, how-to steps,
 * outcomes, the Snooze options — shares the namespace through
 * `TASK_RULE_KEYS` (`src/shared/app/task-rules.constants.ts`). Copy naming
 * the product reads `{{productName}}`.
 */
export const TASKS_KEYS = {
  manifest: { title: 'manifest.title' },
  /** The record's name in "Task not found · it may have been deleted" (`S:115`). */
  record: 'record',
  views: {
    /** The view tabs' accessible name ("Task view"). */
    label: 'views.label',
    /** To do — the API's `open`. */
    open: 'views.queue',
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
  scope: { label: 'scope.label', ...TASK_QUEUE_KEYS.scope },
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
    anyone: TASK_QUEUE_KEYS.anyone,
    /** "<owner> · was <first name>" after a reassign. */
    was: 'row.was',
    /** "✓ <result>" on a Done row. */
    result: 'row.result',
  },
  /**
   * The source chip under the person's name — the kind of record the task points at ("Lead",
   * "Visit", "Treatment"; the API sends no record numbers, research-tasks T10), else the person:
   * "Patient", "Contact".
   */
  sources: {
    lead: 'sources.lead',
    appointment: 'sources.appointment',
    treatment: 'sources.treatment',
    checkIn: 'sources.checkIn',
    review: 'sources.review',
    invoice: 'sources.invoice',
    pendingCredit: 'sources.pendingCredit',
    medicalRep: 'sources.medicalRep',
    patient: 'sources.patient',
    contact: 'sources.contact',
  } satisfies Record<TaskLinkKind | 'patient' | 'contact', string>,
  /** To do's empty-state title over the queue line (change-empty-states R34). */
  emptyCaughtUp: TASK_QUEUE_KEYS.caughtUp,
  empty: {
    open: TASK_QUEUE_KEYS.empty,
    snoozed: 'empty.snoozed',
    done: 'empty.done',
  } satisfies Record<TaskTab, string>,
  /** New task (KICKOFF §6.10 New task, H:1869–1882; Q-T4 — the plan's where the design has none). */
  newTask: {
    title: 'newTask.title',
    /** "For <person> · shows in Tasks and on this person’s timeline". */
    sub: 'newTask.sub',
    /** The sub line before anyone is picked (a plan addition). */
    subNoPerson: 'newTask.subNoPerson',
    steps: {
      what: 'newTask.steps.what',
      when: 'newTask.steps.when',
      how: 'newTask.steps.how',
    },
    forField: {
      label: 'newTask.forField.label',
      placeholder: 'newTask.forField.placeholder',
      search: 'newTask.forField.search',
    },
    titleField: {
      label: 'newTask.titleField.label',
      placeholder: 'newTask.titleField.placeholder',
      /** An empty title saves as "Follow up · <first name>" (H:6072; no Type, route map §4 #22). */
      fallback: 'newTask.titleField.fallback',
      /** What New task cannot save without: a title, or a person to name it after. */
      missing: 'newTask.titleField.missing',
    },
    due: {
      label: 'newTask.due.label',
      today: 'newTask.due.today',
      tomorrow: 'newTask.due.tomorrow',
      inThreeDays: 'newTask.due.inThreeDays',
      nextWeek: 'newTask.due.nextWeek',
      date: 'newTask.due.date',
      time: 'newTask.due.time',
    },
    owner: {
      label: 'newTask.owner.label',
      missing: 'newTask.owner.missing',
    },
    priority: {
      label: 'newTask.priority.label',
      normal: 'newTask.priority.normal',
      high: 'newTask.priority.high',
    } satisfies Record<Exclude<TaskPriority, 'low'> | 'label', string>,
    notes: { label: 'newTask.notes.label', placeholder: 'newTask.notes.placeholder' },
    /** "↔ <person>". */
    footer: 'newTask.footer',
    save: 'newTask.save',
    /** "Task added for <owner> · <due>" with Undo (D28). */
    added: 'newTask.added',
  },
  /** The team pickers' row for the signed-in member: "<name> (you)". */
  assignee: { you: 'assignee.you' },
  /** The task drawer (KICKOFF §6.10 Task drawer; `tasks.md:103–132`). */
  drawer: {
    /** "Created by <product> · <rule description, lower-case>". */
    sub: 'drawer.sub',
    /** A task made by hand's sub line — the API names no creator (research-tasks T15). */
    subByHand: 'drawer.subByHand',
    /** The header chip's name ("Assigned to"). */
    assignedTo: 'drawer.assignedTo',
    sections: {
      what: 'drawer.sections.what',
      how: 'drawer.sections.how',
      close: 'drawer.sections.close',
    },
    /** The quoted message: "“<message>”". */
    quote: 'drawer.quote',
    /** The source button: "Open appointment", "Open lead" … (no record numbers, T10). */
    source: {
      appointment: 'drawer.source.appointment',
      lead: 'drawer.source.lead',
      treatment: 'drawer.source.treatment',
      checkIn: 'drawer.source.checkIn',
      review: 'drawer.source.review',
      patient: 'drawer.source.patient',
      invoice: 'drawer.source.invoice',
    },
    tiles: {
      visit: 'drawer.tiles.visit',
      service: 'drawer.tiles.service',
      doctor: 'drawer.tiles.doctor',
      status: 'drawer.tiles.status',
      treatment: 'drawer.tiles.treatment',
      doneOn: 'drawer.tiles.doneOn',
      session: 'drawer.tiles.session',
      therapist: 'drawer.tiles.therapist',
      source: 'drawer.tiles.source',
      interestedIn: 'drawer.tiles.interestedIn',
      owner: 'drawer.tiles.owner',
      mobile: 'drawer.tiles.mobile',
    },
    /** Tile values: "<day> · <time> · <n> min", "#<n>". */
    tileValues: {
      visit: 'drawer.tileValues.visit',
      session: 'drawer.tileValues.session',
    },
    outcomeNote: {
      label: 'drawer.outcomeNote.label',
      placeholder: 'drawer.outcomeNote.placeholder',
    },
    snooze: 'drawer.snooze',
    assigned: 'drawer.assigned',
    /** The Assigned button's tooltip. */
    assignTip: 'drawer.assignTip',
    searchTeam: 'drawer.searchTeam',
    /** The Assigned list's two groups: the members, then the role queues (owner_role). */
    assignGroups: {
      team: 'drawer.assignGroups.team',
      queues: 'drawer.assignGroups.queues',
    },
    /** A task made by hand's delete confirm (`task:delete`): "Delete this task?". */
    deleteTitle: 'drawer.deleteTitle',
    /** "Was <A> → <B>" after a reassign. */
    was: 'drawer.was',
    close: 'drawer.close',
  },
  /**
   * The drawer's toasts (`tasks.md:180–233`) — no Undo: the API has no way back for an outcome,
   * a snooze, a claim or a move (research-tasks §4, Q7).
   */
  toasts: {
    closed: 'toasts.closed',
    snoozed: 'toasts.snoozed',
    claimed: 'toasts.claimed',
    moved: 'toasts.moved',
    /** "<task> removed" with Undo (a restore) after a delete. */
    removed: 'toasts.removed',
    /** A write on a task someone — or the rules — closed first (`409 transition_not_allowed`). */
    alreadyClosed: TASK_QUEUE_KEYS.alreadyClosed,
    /** A claim without `lead:update` (`403 missing_permission`, D81 TASKS-M3). */
    claimNeedsLeads: 'toasts.claimNeedsLeads',
    /** A lead's task moved without `lead:update` (`403 missing_permission`, D81 TASKS-M3). */
    reassignNeedsLeads: 'toasts.reassignNeedsLeads',
  },
  /** "What’s next for <first>?" (KICKOFF §6.10; `tasks.md:86–99, 134–146`). */
  whatsNext: {
    title: 'whatsNext.title',
    /** The title for a task about nobody. */
    titleNoPerson: 'whatsNext.titleNoPerson',
    sub: 'whatsNext.sub',
    section: 'whatsNext.section',
    step: {
      label: 'whatsNext.step.label',
      callAgain: 'whatsNext.step.callAgain',
      sendWhatsApp: 'whatsNext.step.sendWhatsApp',
      bookVisit: 'whatsNext.step.bookVisit',
      collectPayment: 'whatsNext.step.collectPayment',
      sendOffer: 'whatsNext.step.sendOffer',
    },
    when: 'whatsNext.when',
    owner: 'whatsNext.owner',
    note: {
      label: 'whatsNext.note.label',
      placeholder: 'whatsNext.note.placeholder',
    },
    nothingNext: 'whatsNext.nothingNext',
    create: 'whatsNext.create',
    pickStep: 'whatsNext.pickStep',
    pickWhen: 'whatsNext.pickWhen',
    /** "Next task set · <step> · <when, lower-case>". */
    created: 'whatsNext.created',
    /** The new task's title: "<step> · <first name>". */
    taskTitle: 'whatsNext.taskTitle',
    /** Its why line without a note: "Planned after: <task title> · <result>". */
    plannedAfter: 'whatsNext.plannedAfter',
  },
} as const;

/** The room's list id: the toolbar's test-id prefix and the list error's toast id. */
export const TASKS_TABLE_ID = 'tasks';

/** `data-testid`s the room adds beside the toolbar's (`roomToolbarTestIds('tasks')`). */
export const TASKS_TEST_IDS = {
  list: 'tasks-list',
  group: (group: TaskGroupId) => `tasks-group-${group}`,
  row: 'tasks-row',
  empty: 'tasks-empty',
  /** The type dropdown (the picker derives `-trigger`, `-panel`, … from it). */
  type: 'tasks-type',
  /** The Scope tablist's prefix: `tasks-scope-tabs`, `tasks-scope-tab-mine`. */
  scope: 'tasks-scope',
  rulesTrigger: 'tasks-rules-trigger',
  rules: 'tasks-rules',
  rule: (rule: string) => `tasks-rule-${rule}`,
  ruleSwitch: (rule: string) => `tasks-rule-${rule}-switch`,
  ruleHandle: (rule: string) => `tasks-rule-${rule}-handle`,
  /** New task's drawer (the record drawer derives `-save`, `-close`, `-step-<id>` …) and fields. */
  newTask: {
    drawer: 'new-task-drawer',
    /** The "For" picker (`-trigger`, `-panel`, `-search` …). */
    person: 'new-task-for',
    title: 'new-task-title',
    /** Due chips: `new-task-due-<preset>`. */
    due: 'new-task-due',
    dueDate: 'new-task-due-date',
    dueTime: 'new-task-due-time',
    /** The team picker (`-trigger`, `-panel` …). */
    owner: 'new-task-owner',
    /** Priority chips: `new-task-priority-<priority>`. */
    priority: 'new-task-priority',
    notes: 'new-task-notes',
  },
  /** The task drawer's parts (its root is the manifest's `task-drawer`). */
  drawer: {
    root: 'task-drawer',
    title: 'task-drawer-title',
    due: 'task-drawer-due',
    owner: 'task-drawer-owner',
    person: 'task-drawer-person',
    source: 'task-drawer-source',
    quote: 'task-drawer-quote',
    tiles: 'task-drawer-tiles',
    how: 'task-drawer-how',
    outcome: (outcome: string) => `task-drawer-outcome-${outcome}`,
    note: 'task-drawer-note',
    /** The Snooze menu (`-panel`, `-option-<option>`). */
    snooze: 'task-drawer-snooze',
    /** The Assigned picker (`-panel`, `-option-<id>`). */
    assign: 'task-drawer-assign',
    was: 'task-drawer-was',
    dismiss: 'task-drawer-dismiss',
    chat: 'task-drawer-chat',
  },
  /** "What’s next" (the record drawer derives `-save`, `-dismiss` …). */
  whatsNext: {
    drawer: 'whats-next-drawer',
    /** Next step chips: `whats-next-step-<step>`. */
    step: 'whats-next-step',
    /** When chips: `whats-next-when-<when>`. */
    when: 'whats-next-when',
    owner: 'whats-next-owner',
    note: 'whats-next-note',
  },
} as const;
