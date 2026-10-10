import { describe, expect, it } from 'vitest';

import {
  taskContactWireRow,
  taskPerson,
  taskWireRow,
  TEST_TASK_LEAD_ID,
} from '@/tests/utils/task-doubles.ts';

import { clinicInstant } from './clinic-time.ts';
import {
  findTaskOutcome,
  normalizeTaskListQuery,
  TASK_FOLLOW_UP_SPANS,
  TASK_RULE_KEY_VALUES,
  TASK_TYPE_VALUES,
  TASK_TYPES,
  taskCreateBodyOf,
  type TaskOutcomeCode,
  taskOutcomeCodes,
  taskOutcomeFitsPerson,
  taskReassignCodes,
  taskResultTextOf,
  taskRuleSettingsBodyOf,
  taskRuleSettingWire,
  taskSnoozeLabelOf,
  taskSnoozeUntil,
  taskTimeAfter,
  type TaskType,
  taskTypeOf,
  taskTypeQueryOf,
  taskWire,
  toTaskPerson,
  toTaskRecord,
  toTaskRow,
  toTaskRuleSettings,
  visibleTaskOutcomes,
} from './tasks-contracts.ts';

const record = (patch: Record<string, unknown> = {}) =>
  toTaskRecord(taskWire.parse(taskWireRow(patch)));

describe('the wire', () => {
  it('reads a rule task: its type, owner queue, person and lead link', () => {
    expect(record()).toMatchObject({
      id: 'task_h7etxlhnxwzy1e2dxrins',
      kind: 'rule',
      ruleKey: 'reply',
      type: 'reply',
      ownerId: null,
      ownerRole: 'front_desk',
      contact: { name: 'Anaya Desai', phone: '+919826005869', preferenceTags: [] },
      link: { kind: 'lead', id: TEST_TASK_LEAD_ID },
      isResolvedAutomatically: false,
      priority: 'high',
    });
  });

  it('reads the medical rep visit rule and its link (D81 TASKS-M1)', () => {
    expect(
      record({
        rule_key: 'medical_rep_visit',
        lead_id: null,
        medical_rep_id: 'mrep_kq2p0000000000000000',
        owner_role: 'pharmacist',
      }),
    ).toMatchObject({
      type: 'medical_rep_visit',
      link: { kind: 'medicalRep', id: 'mrep_kq2p0000000000000000' },
    });
  });

  it('reads a task made by hand as "Follow-ups you set", with no link', () => {
    for (const kind of ['manual', 'follow_up'] as const) {
      const task = record({ kind, rule_key: null, lead_id: null, contact: null });
      expect(task).toMatchObject({ type: 'by_hand', link: null, contact: null });
      expect(taskTypeOf(task)).toBe('by_hand');
    }
  });

  it('reads the owner changes, newest first, and drops a role it does not know', () => {
    const task = record({
      owner_changes: [
        {
          from_membership_id: null,
          from_role: 'front_desk',
          to_membership_id: null,
          to_role: 'custom_role',
          changed_by_membership_id: 'mem_yls33gz5jj66ful8q4ads',
          created_at: '2026-10-10T05:00:00.000Z',
        },
      ],
    });
    expect(task.ownerChanges).toEqual([
      {
        fromId: null,
        fromRole: 'front_desk',
        toId: null,
        toRole: null,
        changedById: 'mem_yls33gz5jj66ful8q4ads',
        at: '2026-10-10T05:00:00.000Z',
      },
    ]);
  });

  it('refuses a rule key or a status the API does not send', () => {
    expect(taskWire.safeParse(taskWireRow({ rule_key: 'follow' })).success).toBe(false);
    expect(taskWire.safeParse(taskWireRow({ status: 'queue' })).success).toBe(false);
  });
});

describe('the person', () => {
  it('adds what their contact record says: first name, numbers, patient file, open lead', () => {
    const task = record();
    const row = toTaskRow(
      task,
      new Map([
        [
          'con_8hb15isod6txlpljrn1f7',
          {
            id: 'con_8hb15isod6txlpljrn1f7',
            contactNumber: 9,
            firstName: 'Anaya',
            lastName: 'Desai',
            name: 'Anaya Desai',
            primaryPhone: '+919826005869',
            email: null,
            instagramHandles: [],
            defaultChannel: 'whatsapp' as const,
            preferenceTags: [],
            patientId: null,
            openLeadId: TEST_TASK_LEAD_ID,
            lastActivityAt: null,
            lastReceivedAt: null,
            isAwaitingReply: true,
            updatedAt: taskContactWireRow().updated_at,
            patientNumber: null,
          },
        ],
      ]),
    );
    expect(row.person).toMatchObject({
      firstName: 'Anaya',
      contactNumber: 9,
      patientId: null,
      openLeadId: TEST_TASK_LEAD_ID,
    });
  });

  it('keeps the task’s own fields when the record could not be read', () => {
    expect(
      toTaskPerson(
        { id: 'con_x', name: '  Kavya Mehta', phone: null, preferenceTags: [] },
        undefined,
      ),
    ).toMatchObject({ firstName: 'Kavya', contactNumber: null, patientId: null });
  });
});

/**
 * The outcomes clinozy-be offers each rule (D81 TASKS-M2, `TASK_RULE_OUTCOMES` and
 * `TASK_HAND_OUTCOME_VALUES` in its `tasks.constants.ts`) — a resolve with any other is a `400`.
 */
const SERVER_OUTCOMES: Readonly<Record<TaskType, readonly TaskOutcomeCode[]>> = {
  reply: ['done'],
  failed_message: ['done'],
  follow_up: ['done', 'no_answer'],
  claim: ['done'],
  confirm: ['done', 'no_answer'],
  arrive: ['done'],
  rebook: ['done'],
  feedback: ['happy', 'unhappy', 'log_check_in'],
  aftercare: ['log_check_in', 'doing_well', 'no_answer'],
  call_back: ['done'],
  next_visit: ['done'],
  gone_quiet: ['done'],
  payment_due: ['done'],
  settle_by: ['done'],
  medical_rep_visit: ['done'],
  by_hand: ['done', 'no_answer'],
};

describe('the catalogue', () => {
  it('holds every rule the API keys, and "Follow-ups you set", in the popover’s order', () => {
    expect(Object.keys(TASK_TYPES)).toEqual([...TASK_TYPE_VALUES]);
    expect([...TASK_TYPE_VALUES].filter((type) => type !== 'by_hand').sort()).toEqual(
      [...TASK_RULE_KEY_VALUES].sort(),
    );
  });

  it('resolves each type only with an outcome the server offers its rule', () => {
    for (const type of TASK_TYPE_VALUES) {
      const outcomes: readonly { id: string; write: { type: string } }[] =
        TASK_TYPES[type].outcomes;
      expect(new Set(outcomes.map((outcome) => outcome.id)).size, type).toBe(
        outcomes.length,
      );
      for (const outcome of TASK_TYPES[type].outcomes) {
        if (outcome.write.type === 'resolve') {
          expect(SERVER_OUTCOMES[type], `${type}.${outcome.id}`).toContain(
            outcome.write.outcome,
          );
        }
      }
    }
  });

  it('opens "What’s next" after a closing outcome only (`tasks.md:140`)', () => {
    for (const type of TASK_TYPE_VALUES) {
      for (const outcome of TASK_TYPES[type].outcomes) {
        if (outcome.whatsNext) expect(outcome.write.type, outcome.id).toBe('resolve');
      }
    }
  });

  it('plans each outcome’s record writes before its own (research-tasks §2.1)', () => {
    expect(findTaskOutcome('reply', 'bookedVisit')).toMatchObject({
      steps: [{ type: 'leadStatus', status: 'follow_up' }],
      write: { type: 'resolve', outcome: 'done' },
      opens: 'appointmentNew',
    });
    expect(findTaskOutcome('follow_up', 'callBackTomorrow')?.steps).toEqual([
      { type: 'leadFollowUpTomorrow', at: '11:00' },
      { type: 'logCall' },
    ]);
    expect(findTaskOutcome('confirm', 'cancelledByPatient')?.steps).toEqual([
      { type: 'appointment', action: 'cancel' },
    ]);
    expect(findTaskOutcome('arrive', 'runningLate')?.write).toEqual({
      type: 'snooze',
      span: { kind: 'minutes', minutes: 30 },
    });
    expect(findTaskOutcome('failed_message', 'fixTheNumber')).toMatchObject({
      write: { type: 'none' },
      opens: 'personRecord',
    });
    expect(findTaskOutcome('reply', 'claimIt')).toBeUndefined();
  });

  it('names the codes an outcome needs — its writes, the task’s, the form it opens', () => {
    expect(
      taskOutcomeCodes('reply', TASK_TYPES.reply.outcomes[0]).sort((a, b) =>
        a.localeCompare(b),
      ),
    ).toEqual(['appointment:create', 'lead:update', 'task:update']);
    expect(taskOutcomeCodes('claim', TASK_TYPES.claim.outcomes[0])).toEqual([
      'task:update',
      'lead:update',
    ]);
    expect(taskOutcomeCodes('claim', TASK_TYPES.claim.outcomes[1])).toEqual([
      'task:update',
    ]);
    expect(
      taskOutcomeCodes('failed_message', TASK_TYPES.failed_message.outcomes[2]),
    ).toEqual([]);
  });

  it('keeps the patient-file outcomes for a person with a file', () => {
    const doingWell = TASK_TYPES.aftercare.outcomes[1];
    const setFollowUp = TASK_TYPES.next_visit.outcomes[1];
    const noAnswer = TASK_TYPES.aftercare.outcomes[2];
    expect(taskOutcomeFitsPerson(doingWell, null)).toBe(false);
    expect(taskOutcomeFitsPerson(setFollowUp, null)).toBe(false);
    expect(taskOutcomeFitsPerson(noAnswer, null)).toBe(true);
    expect(taskOutcomeFitsPerson(doingWell, 'pat_9e6j52vjb8uhvz44ebe94')).toBe(true);
  });

  it('offers the outcomes a member’s codes run that fit the person — none without task:update', () => {
    const ids = (codes: readonly string[], patientId: string | null) =>
      visibleTaskOutcomes(
        { type: 'aftercare', person: taskPerson({ patientId }) },
        (code) => codes.includes(code),
      ).map((plan) => plan.id);
    const worker = ['task:update', 'patient:update', 'contact_activity:create'];
    expect(ids(worker, 'pat_9e6j52vjb8uhvz44ebe94')).toEqual([
      'logCheckIn',
      'doingWell',
      'noAnswer',
    ]);
    // Without a patient file the check-in outcomes go; without the call log, "No answer".
    expect(ids(['task:update', 'patient:update'], null)).toEqual([]);
    expect(ids(worker, null)).toEqual(['noAnswer']);
    expect(ids(['task:read'], 'pat_9e6j52vjb8uhvz44ebe94')).toEqual([]);
  });

  it('asks `lead:update` to move a lead’s task (D81 TASKS-M3)', () => {
    expect(taskReassignCodes({ link: { kind: 'lead', id: TEST_TASK_LEAD_ID } })).toEqual([
      'task:update',
      'lead:update',
    ]);
    expect(taskReassignCodes({ link: null })).toEqual(['task:update']);
  });
});

describe('time', () => {
  it('snoozes "tomorrow at" to that time tomorrow in the clinic, not 24 hours on', () => {
    const now = new Date(clinicInstant('2026-10-03', '23:30'));
    expect(taskTimeAfter({ kind: 'tomorrowAt', at: '10:00' }, now)).toBe(
      clinicInstant('2026-10-04', '10:00'),
    );
    expect(taskTimeAfter({ kind: 'minutes', minutes: 30 }, now)).toBe(
      new Date(now.getTime() + 30 * 60_000).toISOString(),
    );
    expect(taskSnoozeUntil('tomorrow', now.toISOString())).toBe(
      clinicInstant('2026-10-04', '10:00'),
    );
    expect(taskSnoozeUntil('nextWeek', now.toISOString())).toBe(
      new Date(now.getTime() + 7 * 86_400_000).toISOString(),
    );
  });

  it('dates a "What’s next" follow-up in 3 h, tomorrow 11:00, in 3 or 7 days (`tasks.md:98`)', () => {
    const now = new Date(clinicInstant('2026-10-03', '10:00'));
    expect(taskTimeAfter(TASK_FOLLOW_UP_SPANS.inThreeHours, now)).toBe(
      clinicInstant('2026-10-03', '13:00'),
    );
    expect(taskTimeAfter(TASK_FOLLOW_UP_SPANS.tomorrow, now)).toBe(
      clinicInstant('2026-10-04', '11:00'),
    );
    expect(taskTimeAfter(TASK_FOLLOW_UP_SPANS.inThreeDays, now)).toBe(
      clinicInstant('2026-10-06', '10:00'),
    );
  });
});

describe('the list query', () => {
  it('defaults to my To do, every type, no search — and orders the types like the catalogue', () => {
    expect(normalizeTaskListQuery()).toEqual({
      tab: 'open',
      scope: 'mine',
      type: [],
      q: '',
    });
    expect(
      normalizeTaskListQuery({
        type: ['by_hand', 'confirm', 'reply', 'confirm'],
        q: `  ${'a'.repeat(90)} `,
      }),
    ).toEqual({
      tab: 'open',
      scope: 'mine',
      type: ['reply', 'confirm', 'by_hand'],
      q: 'a'.repeat(80),
    });
  });

  it('asks for the rules by key and "Follow-ups you set" by kind, together (D81 T6)', () => {
    expect(taskTypeQueryOf([])).toEqual({});
    expect(taskTypeQueryOf(['reply', 'confirm'])).toEqual({ rule_key: 'reply,confirm' });
    expect(taskTypeQueryOf(['by_hand'])).toEqual({ kind: 'follow_up,manual' });
    expect(taskTypeQueryOf(['confirm', 'by_hand'])).toEqual({
      rule_key: 'confirm',
      kind: 'follow_up,manual',
    });
  });
});

describe('writes', () => {
  it('creates by hand: the owner, the person and the one link; a blank why is left out', () => {
    expect(
      taskCreateBodyOf({
        title: ' Call again · Anaya ',
        why: '  ',
        dueAt: '2026-10-11T05:30:00.000Z',
        assignee: { role: 'front_desk' },
        priority: 'normal',
        contactId: 'con_8hb15isod6txlpljrn1f7',
        link: { kind: 'lead', id: TEST_TASK_LEAD_ID },
      }),
    ).toEqual({
      title: 'Call again · Anaya',
      due_at: '2026-10-11T05:30:00.000Z',
      owner_role: 'front_desk',
      contact_id: 'con_8hb15isod6txlpljrn1f7',
      lead_id: TEST_TASK_LEAD_ID,
      priority: 'normal',
    });
    expect(
      taskCreateBodyOf({
        title: 'Check stock',
        why: 'Before Friday',
        dueAt: '2026-10-11T05:30:00.000Z',
        assignee: { membershipId: 'mem_yls33gz5jj66ful8q4ads' },
        priority: 'high',
        contactId: null,
        link: null,
      }),
    ).toEqual({
      title: 'Check stock',
      due_at: '2026-10-11T05:30:00.000Z',
      owner_membership_id: 'mem_yls33gz5jj66ful8q4ads',
      why: 'Before Friday',
      priority: 'high',
    });
  });

  it('clamps the words to the server’s limits, and sends none for blank words', () => {
    expect(taskResultTextOf('x'.repeat(250))).toHaveLength(200);
    expect(taskSnoozeLabelOf('Tomorrow 10:00 — they asked us to call back')).toHaveLength(
      40,
    );
    expect(taskSnoozeLabelOf('   ')).toBeUndefined();
    expect(taskSnoozeLabelOf(null)).toBeUndefined();
  });

  it('reads the rule settings by rule and sends only the switches that moved', () => {
    const settings = toTaskRuleSettings(
      [
        {
          id: null,
          rule_key: 'confirm',
          is_on: true,
          is_automatic: false,
          can_be_automatic: true,
          updated_at: null,
        },
      ].map((row) => taskRuleSettingWire.parse(row)),
    );
    expect(settings.confirm).toEqual({
      isOn: true,
      isAutomatic: false,
      canBeAutomatic: true,
      updatedAt: null,
    });
    expect(
      taskRuleSettingsBodyOf([
        { ruleKey: 'confirm', isAutomatic: true },
        { ruleKey: 'settle_by', isOn: false },
      ]),
    ).toEqual({
      rules: [
        { rule_key: 'confirm', is_automatic: true },
        { rule_key: 'settle_by', is_on: false },
      ],
    });
  });
});
