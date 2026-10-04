import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { TaskGroupId } from '@/shared/api/clinic/task-views.ts';
import type {
  ManualTaskType,
  TaskPriority,
  TaskTab,
} from '@/shared/api/clinic/tasks-contracts.ts';

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
      /** The list before a search is typed. */
      empty: 'newTask.forField.empty',
      /** Whom New task cannot save without. */
      missing: 'newTask.forField.missing',
    },
    type: {
      label: 'newTask.type.label',
      call_back: 'newTask.type.callBack',
      follow_up: 'newTask.type.followUp',
      send_price: 'newTask.type.sendPrice',
      ask_for_photos: 'newTask.type.askForPhotos',
      feedback: 'newTask.type.feedback',
      payment_reminder: 'newTask.type.paymentReminder',
    } satisfies Record<ManualTaskType | 'label', string>,
    titleField: {
      label: 'newTask.titleField.label',
      placeholder: 'newTask.titleField.placeholder',
      /** An empty title saves as "<type> · <first name>" (H:6072). */
      fallback: 'newTask.titleField.fallback',
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
    } satisfies Record<TaskPriority | 'label', string>,
    /** "Remind 15 min before". */
    remind: 'newTask.remind',
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
    /** The header chip's name ("Assigned to"). */
    assignedTo: 'drawer.assignedTo',
    sections: {
      what: 'drawer.sections.what',
      how: 'drawer.sections.how',
      close: 'drawer.sections.close',
    },
    /** The quoted message: "“<message>”". */
    quote: 'drawer.quote',
    /** The source button: "Open appointment · Appt #2848" … */
    source: {
      appointment: 'drawer.source.appointment',
      lead: 'drawer.source.lead',
      treatment: 'drawer.source.treatment',
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
    automation: {
      title: 'drawer.automation.title',
      action: 'drawer.automation.action',
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
    /** "Was <A> → <B>" after a reassign. */
    was: 'drawer.was',
    close: 'drawer.close',
  },
  /** The drawer's toasts (`tasks.md:180–233`), each with Undo. */
  toasts: {
    closed: 'toasts.closed',
    snoozed: 'toasts.snoozed',
    claimed: 'toasts.claimed',
    claimedUnowned: 'toasts.claimedUnowned',
    moved: 'toasts.moved',
    movedUnowned: 'toasts.movedUnowned',
    automation: 'toasts.automation',
  },
  /** "What’s next for <first>?" (KICKOFF §6.10; `tasks.md:86–99, 134–146`). */
  whatsNext: {
    title: 'whatsNext.title',
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
  /** New task's drawer (the record drawer derives `-save`, `-close`, `-step-<id>` …) and fields. */
  newTask: {
    drawer: 'new-task-drawer',
    /** The "For" picker (`-trigger`, `-panel`, `-search` …). */
    person: 'new-task-for',
    /** Type chips: `new-task-type-<type>`. */
    type: 'new-task-type',
    title: 'new-task-title',
    /** Due chips: `new-task-due-<preset>`. */
    due: 'new-task-due',
    dueDate: 'new-task-due-date',
    dueTime: 'new-task-due-time',
    /** The team picker (`-trigger`, `-panel` …). */
    owner: 'new-task-owner',
    /** Priority chips: `new-task-priority-<priority>`. */
    priority: 'new-task-priority',
    remind: 'new-task-remind',
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
    automation: 'task-drawer-automation',
    automationAction: 'task-drawer-automation-action',
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
