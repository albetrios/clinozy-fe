/**
 * The Tasks room's test world on clinozy-be's shapes: a front desk member's
 * day — her own and her queue's tasks, a colleague's, one snoozed, two closed —
 * the rule settings, the team, and doubles for the api modules the room reads
 * (`tasks-api.ts` list, rule settings and delete; the team directory; the
 * member's membership id), answering as the server does: To do · Snoozed ·
 * Done, Mine (mine and my roles' queues) · Everyone, the types (rules ORed
 * with the tasks made by hand, D81 T6), the search, the header's branches
 * (tasks under no branch always kept) and a rule switched off hidden from
 * every view.
 */
import { vi } from 'vitest';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type { TaskPage } from '@/shared/api/app/tasks-api.ts';
import {
  normalizeTaskListQuery,
  TASK_RULE_KEY_VALUES,
  type TaskListQueryInput,
  type TaskRecord,
  type TaskRow,
  type TaskRuleKey,
  type TaskRuleSettingChange,
  type TaskRuleSettings,
} from '@/shared/api/app/tasks-contracts.ts';
import {
  taskPerson,
  taskRecord,
  taskRow,
  TEST_TASK_MEMBER_ID,
} from '@/tests/utils/task-doubles.ts';

/** 10:30 in the clinic on Sat 10 Oct 2026. */
export const NOW = new Date('2026-10-10T05:00:00.000Z');

/** The two branches the tasks file under. */
export const ADAJAN = 'brn_53j4b7hz7nfb0otr2d920';
const VESU = 'brn_thsaog1i8bv6m9rd9ucoy';

const member = (id: string, name: string, initials: string): DirectoryMember => ({
  id,
  userId: `usr_${id}`,
  name,
  initials,
  tone: 'sky',
  roleIds: [],
  branchIds: [],
});

/** The member the tests sign in as — on the front desk. */
export const RIYA = member(TEST_TASK_MEMBER_ID, 'Riya Shah', 'RS');
/** A counsellor colleague. */
const ASHA = member('mem_asha0000000000000000', 'Asha Mehta', 'AM');

/** The roles whose queues the signed-in member's Mine includes. */
const MY_ROLES = ['front_desk'] as const;

/** The rules the server can do (`can_be_automatic`). */
const AUTOMATIC: readonly TaskRuleKey[] = [
  'confirm',
  'feedback',
  'payment_due',
  'gone_quiet',
];

/** The room's server: its tasks and rule settings, as each test leaves them. */
export interface TasksWorld {
  tasks: TaskRow[];
  ruleSettings: TaskRuleSettings;
  team: DirectoryMember[];
  /** Fail the list read while set (a dropped connection). */
  failList: boolean;
}

/** Every rule on, by hand. */
function freshRuleSettings(): TaskRuleSettings {
  return Object.fromEntries(
    TASK_RULE_KEY_VALUES.map((ruleKey) => [
      ruleKey,
      {
        isOn: true,
        isAutomatic: false,
        canBeAutomatic: AUTOMATIC.includes(ruleKey),
        updatedAt: null,
      },
    ]),
  );
}

/** The seeded world: five open tasks, one snoozed, two closed today. */
export function seededTasksWorld(): TasksWorld {
  return {
    tasks: [
      // In the front desk queue, overdue — a lead waiting for a reply.
      taskRow({ dueAt: '2026-10-09T20:31:53.787Z' }),
      taskRow({
        id: 'task_confirmpriti0000000',
        type: 'confirm',
        ruleKey: 'confirm',
        title: 'Confirm Priti’s visit',
        why: 'Visit on 10 Oct at 16:00',
        ownerId: RIYA.id,
        ownerRole: null,
        link: { kind: 'appointment', id: 'apt_priti00000000000000' },
        dueAt: '2026-10-10T08:30:00.000Z',
        person: taskPerson({
          id: 'con_priti00000000000000',
          name: 'Priti Soni',
          firstName: 'Priti',
          patientId: 'pat_priti00000000000000',
          patientNumber: 7,
        }),
      }),
      taskRow({
        id: 'task_callbackkavya00000',
        type: 'call_back',
        ruleKey: 'call_back',
        title: 'Call Kavya back · unhappy',
        why: 'Unhappy after a facial',
        ownerId: ASHA.id,
        ownerRole: null,
        link: { kind: 'checkIn', id: 'chk_kavya00000000000000' },
        dueAt: '2026-10-10T12:30:00.000Z',
        branchId: VESU,
        person: taskPerson(),
      }),
      taskRow({
        id: 'task_followrhea00000000',
        type: 'by_hand',
        ruleKey: null,
        kind: 'manual',
        title: 'Call Rhea about her package',
        why: null,
        ownerId: RIYA.id,
        ownerRole: null,
        link: null,
        dueAt: '2026-10-11T05:30:00.000Z',
        branchId: null,
        person: taskPerson({
          id: 'con_rhea000000000000000',
          name: 'Rhea Shah',
          firstName: 'Rhea',
          patientId: 'pat_rhea000000000000000',
          patientNumber: 3,
        }),
      }),
      taskRow({
        id: 'task_arrivefaizan00000',
        type: 'arrive',
        ruleKey: 'arrive',
        title: 'Has Faizan arrived?',
        why: 'Visit at 10:15',
        ownerId: null,
        ownerRole: 'front_desk',
        link: { kind: 'appointment', id: 'apt_faizan0000000000000' },
        status: 'snoozed',
        snoozedUntil: '2026-10-10T05:30:00.000Z',
        snoozeLabel: 'Running late',
        dueAt: '2026-10-10T04:45:00.000Z',
        person: taskPerson({
          id: 'con_faizan000000000000',
          name: 'Faizan Shaikh',
          firstName: 'Faizan',
        }),
      }),
      taskRow({
        id: 'task_confirmwalkin00000',
        type: 'confirm',
        ruleKey: 'confirm',
        title: 'Confirm Walkin’s visit',
        why: 'Visit on 10 Oct at 16:45',
        ownerId: null,
        ownerRole: 'front_desk',
        link: { kind: 'appointment', id: 'apt_walkin0000000000000' },
        status: 'done',
        outcome: 'done',
        resultText: `Done by ${PRODUCT_NAME}`,
        isResolvedAutomatically: true,
        resolvedAt: '2026-10-10T02:40:00.051Z',
        dueAt: '2026-10-10T02:30:00.000Z',
        person: taskPerson({ id: 'con_walkin000000000000', name: 'Walkin Probe' }),
      }),
      taskRow({
        id: 'task_researchkavya0000',
        type: 'by_hand',
        ruleKey: null,
        kind: 'manual',
        title: 'Ask Kavya about her review',
        why: null,
        ownerId: RIYA.id,
        ownerRole: null,
        link: null,
        status: 'done',
        outcome: 'done',
        resultText: 'Called',
        resolvedAt: '2026-10-10T04:52:12.920Z',
        resolvedById: RIYA.id,
        dueAt: '2026-10-10T04:30:00.000Z',
        person: taskPerson(),
      }),
    ],
    ruleSettings: freshRuleSettings(),
    team: [RIYA, ASHA],
    failList: false,
  };
}

/** Whether a task is the signed-in member's under "Mine": theirs, or unowned in their roles' queues. */
const isMine = (task: TaskRow) =>
  task.ownerId === RIYA.id ||
  (task.ownerId === null &&
    task.ownerRole !== null &&
    (MY_ROLES as readonly string[]).includes(task.ownerRole));

/** Whether a task matches the type filter — its rule, or "Follow-ups you set" for a task by hand. */
const matchesTypes = (task: TaskRow, types: readonly string[]) =>
  types.length === 0 || types.includes(task.type);

/** Whether a task matches the search — its title, why line or person's name. */
const matchesSearch = (task: TaskRow, q: string) =>
  q === '' ||
  [task.title, task.why ?? '', task.person?.name ?? ''].some((text) =>
    text.toLowerCase().includes(q.toLowerCase()),
  );

/** `listTasks` as clinozy-be answers the room's query over `world`. */
function listTasksOver(world: TasksWorld, input: TaskListQueryInput): TaskPage {
  if (world.failList) throw new Error('connection dropped');
  const query = normalizeTaskListQuery(input);
  const branches = query.branchIds ?? [];
  const rows = world.tasks.filter(
    (task) =>
      task.status === query.tab &&
      (task.ruleKey === null || world.ruleSettings[task.ruleKey]?.isOn !== false) &&
      (query.scope === 'everyone' || isMine(task)) &&
      matchesTypes(task, query.type) &&
      matchesSearch(task, query.q) &&
      (branches.length === 0 ||
        task.branchId === null ||
        branches.includes(task.branchId)),
  );
  return {
    rows: [...rows].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)),
    next: null,
    total: rows.length,
  };
}

/** `saveTaskRuleSettings` over `world`: each change applied, every rule answered. */
function saveRuleSettingsOver(
  world: TasksWorld,
  changes: readonly TaskRuleSettingChange[],
): TaskRuleSettings {
  for (const { ruleKey, ...patch } of changes) {
    const setting = world.ruleSettings[ruleKey];
    if (setting) world.ruleSettings[ruleKey] = { ...setting, ...patch };
  }
  return structuredClone(world.ruleSettings);
}

/**
 * The room's `tasks-api.ts` reads and writes over `world` — the list, the rule
 * settings and their save, who can work tasks, and a delete (New task's Undo).
 */
export function tasksApiDouble(world: TasksWorld) {
  return {
    listTasks: vi.fn(async (query: TaskListQueryInput, _after?: string) =>
      listTasksOver(world, query),
    ),
    fetchTaskRuleSettings: vi.fn(async () => structuredClone(world.ruleSettings)),
    saveTaskRuleSettings: vi.fn(
      async ({ changes }: { changes: readonly TaskRuleSettingChange[] }) =>
        saveRuleSettingsOver(world, changes),
    ),
    fetchTaskWorkerIds: vi.fn(async () => world.team.map((entry) => entry.id)),
    deleteTask: vi.fn(async ({ taskId }: { taskId: string }) => {
      world.tasks = world.tasks.filter((task) => task.id !== taskId);
    }),
  };
}

/** The team directory over `world` (`GET /app/memberships`). */
export function directoryApiDouble(world: TasksWorld) {
  return { fetchTeamDirectory: vi.fn(async () => structuredClone(world.team)) };
}

/** The task New task's stand-in saves. */
export const CREATED_TASK: TaskRecord = taskRecord({
  id: 'task_created000000000000',
  kind: 'manual',
  ruleKey: null,
  type: 'by_hand',
  title: 'Follow up · Anaya',
});
