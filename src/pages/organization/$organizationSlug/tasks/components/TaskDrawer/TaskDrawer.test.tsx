import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import { resolveAccessFromCodes } from '@/shared/api/clinic/access-api.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import { deleteTask, restoreTask } from '@/shared/api/clinic/tasks-api.ts';
import type { TaskDetail, TaskRow } from '@/shared/api/clinic/tasks-contracts.ts';
import type { ClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useContact } from '@/shared/hooks/useContacts/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import { appointmentRow, DOCTOR_NISHA } from '@/tests/utils/appointment-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';
import {
  taskPerson,
  taskRecord,
  taskRow,
  TEST_TASK_CONTACT_ID,
  TEST_TASK_LEAD_ID,
  TEST_TASK_MEMBER_ID,
} from '@/tests/utils/task-doubles.ts';

import type { TaskActions } from '../../hooks/useTaskActions/index.ts';
import type { TaskAssignees } from '../../hooks/useTaskAssignees/index.ts';
import { TaskDrawer } from './TaskDrawer.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));
const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: notifyMock,
}));
vi.mock('@/shared/api/clinic/tasks-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deleteTask: vi.fn(),
  restoreTask: vi.fn(),
}));

/** The member's clinozy-be codes. */
const member = vi.hoisted(() => ({ codes: [] as string[] }));
vi.mock('@/shared/hooks/useClinicAccess/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useClinicAccess: (): ClinicAccess => ({
    roles: [],
    previewRole: null,
    isResolved: true,
    ...resolveAccessFromCodes(member.codes),
    canCode: (code) => member.codes.includes(code),
  }),
}));

/** The rules run (D81 T7): the drawer asks for a re-read after a send from its chat. */
const refreshAfterRules = vi.hoisted(() => vi.fn());
vi.mock('@/shared/hooks/useTasks/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRefreshTasksAfterRules: () => refreshAfterRules,
}));
vi.mock('@/shared/hooks/useContacts/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useContact: vi.fn(() => ({ data: undefined })),
}));
/** The chat column's own suites cover it: here, the person it is bound to and its send. */
vi.mock('@/shared/components/ChatColumn/index.ts', async (importOriginal) => {
  const { createElement } = await import('react');
  return {
    ...(await importOriginal<object>()),
    ChatColumn: ({
      person,
      lead,
      onSent,
      onBookAppointment,
    }: {
      person: { contactId: string };
      lead?: { leadId: string };
      onSent?: () => void;
      onBookAppointment?: (booking: { reason: string | null }) => void;
    }) =>
      createElement(
        'div',
        {
          'data-testid': 'chat-column-stub',
          'data-contact': person.contactId,
          'data-lead': lead?.leadId ?? 'none',
        },
        createElement('button', { type: 'button', onClick: onSent }, 'Send'),
        onBookAppointment
          ? createElement(
              'button',
              { type: 'button', onClick: () => onBookAppointment({ reason: null }) },
              'Book',
            )
          : null,
      ),
  };
});

/** An Owner's codes: every task code, the records the outcomes write, the chat. */
const OWNER_CODES = [
  'task:read',
  'task:create',
  'task:update',
  'task:delete',
  'lead:read',
  'lead:update',
  'appointment:read',
  'appointment:create',
  'appointment:update',
  'contact:read',
  'contact_activity:read',
  'contact_activity:create',
  'contact_activity:update',
  'patient:read',
  'patient:update',
];
/** A Therapist: works tasks and visits, but no lead code (research-tasks §7). */
const THERAPIST_CODES = OWNER_CODES.filter(
  (code) => !code.startsWith('lead:') && code !== 'task:delete',
);

/** 10:30 in the clinic on Sat 10 Oct 2026. */
const NOW = new Date('2026-10-10T05:00:00.000Z');

const ASHA = {
  id: 'mem_asha0000000000000000',
  userId: 'usr_asha',
  name: 'Asha Mehta',
  initials: 'AM',
  tone: 'sage' as const,
  roleIds: [],
  branchIds: [],
};
const RIYA = {
  ...ASHA,
  id: TEST_TASK_MEMBER_ID,
  userId: 'usr_riya',
  name: 'Riya Shah',
  initials: 'RS',
};

const ASSIGNEES: TaskAssignees = {
  options: [RIYA, ASHA].map((entry) => ({
    key: entry.id,
    label: entry.id === RIYA.id ? `${entry.name} (you)` : entry.name,
    leading: { kind: 'avatar', initials: entry.initials },
    data: entry,
  })),
  myMembershipId: RIYA.id,
  byId: new Map([
    [RIYA.id, RIYA],
    [ASHA.id, ASHA],
    [DOCTOR_NISHA.id, DOCTOR_NISHA],
  ]),
  isPending: false,
};

/** Anaya's open lead, the reply task's record — Asha owns it. */
const ANAYA_LEAD: LeadRecord = {
  id: TEST_TASK_LEAD_ID,
  leadNumber: 2363,
  contactId: TEST_TASK_CONTACT_ID,
  person: null,
  name: 'Anaya Desai',
  phone: '+919826005869',
  patientId: null,
  status: 'new',
  source: 'instagram',
  interests: ['peel', 'lhr'],
  kind: 'enquiry',
  retargetReason: null,
  ownerId: ASHA.id,
  involvedIds: [],
  heldUntil: null,
  followUpAt: null,
  branchId: null,
  notes: null,
  lastActivityAt: null,
  isAwaitingReply: true,
  createdAt: '2026-10-09T20:00:00.000Z',
  updatedAt: '2026-10-09T20:00:00.000Z',
};

/** The reply task's read: Anaya's lead and her unreplied message. */
function replyDetail(patch: Partial<TaskRow> = {}): TaskDetail {
  return {
    task: taskRow(patch),
    source: { kind: 'lead', lead: ANAYA_LEAD },
    quote: {
      activityId: 'act_anaya0000000000000000',
      text: 'Is the peel available on Saturday?',
      at: '2026-10-09T20:01:53.787Z',
    },
  };
}

/** Priti's confirm task and her visit with Dr. Nisha. */
function confirmDetail(): TaskDetail {
  return {
    task: taskRow({
      id: 'task_confirmpriti0000000',
      type: 'confirm',
      ruleKey: 'confirm',
      title: 'Confirm Priti’s visit',
      why: 'Visit on 11 Oct at 10:30',
      ownerId: RIYA.id,
      ownerRole: null,
      link: { kind: 'appointment', id: 'appt_priti00000000000000' },
      person: taskPerson({
        id: 'con_priti00000000000000',
        name: 'Priti Soni',
        firstName: 'Priti',
      }),
    }),
    source: {
      kind: 'appointment',
      appointment: appointmentRow({ id: 'appt_priti00000000000000', date: '2026-10-11' }),
    },
    quote: null,
  };
}

function spyActions(busy = false): TaskActions {
  return { busy, recordOutcome: vi.fn(), snooze: vi.fn(), reassign: vi.fn() };
}

/** Hands the drawer a new read, as the page does when the task is read again. */
const harness = { read: (_next: TaskDetail | undefined) => {} };

/** The drawer over its read — which a test may change. */
function DrawerHarness({
  initial,
  ...props
}: Omit<ComponentProps<typeof TaskDrawer>, 'detail'> & {
  initial: TaskDetail | undefined;
}) {
  const [detail, setDetail] = useState(initial);
  useEffect(() => {
    harness.read = setDetail;
  }, []);
  return <TaskDrawer detail={detail} {...props} />;
}

async function openDrawer(
  detail: TaskDetail | undefined,
  extra: { failed?: boolean; onRetry?: () => void; actions?: TaskActions } = {},
) {
  const actions = extra.actions ?? spyActions();
  const onClose = vi.fn();
  const onOpenTarget = vi.fn();
  const view = renderWithProviders(
    <DrawerHarness
      initial={detail}
      now={NOW}
      actions={actions}
      assignees={ASSIGNEES}
      onClose={onClose}
      onOpenTarget={onOpenTarget}
      pendingTitle="Task"
      failed={extra.failed}
      onRetry={extra.onRetry}
    />,
  );
  await view.router.load();
  const drawer = await screen.findByTestId('task-drawer');
  const rerender = (next: TaskDetail | undefined) => act(() => harness.read(next));
  return { drawer, actions, onClose, onOpenTarget, rerender, user: userEvent.setup() };
}

beforeEach(() => {
  member.codes = [...OWNER_CODES];
  viewport.tier = 'desktop';
  for (const mock of Object.values(notifyMock)) mock.mockReset();
  refreshAfterRules.mockReset();
  vi.mocked(useContact).mockClear();
  vi.mocked(deleteTask).mockReset();
  vi.mocked(restoreTask).mockReset();
  signInTestMember();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('TaskDrawer (KICKOFF §6.10 Task drawer) on clinozy-be', () => {
  it('opens a lead’s reply task: header, who, What and the quote, the lead’s tiles, How, outcomes, chat', async () => {
    const { drawer } = await openDrawer(replyDetail());
    expect(screen.getByTestId('task-drawer-title')).toHaveTextContent('Reply to Anaya');
    expect(drawer).toHaveAccessibleDescription(
      expect.stringContaining(`Created by ${PRODUCT_NAME} · `),
    );
    // Unowned, in the front desk's queue (research-tasks Q3).
    expect(screen.getByTestId('task-drawer-owner')).toHaveTextContent('Front desk');
    expect(screen.getByTestId('task-drawer-person')).toHaveTextContent('Anaya Desai');
    expect(screen.getByTestId('task-drawer-source')).toHaveTextContent('Open lead');
    expect(screen.getByTestId('task-drawer-quote')).toHaveTextContent(
      'Is the peel available on Saturday?',
    );
    const tiles = within(screen.getByTestId('task-drawer-tiles'));
    expect(tiles.getByText('New')).toBeInTheDocument();
    expect(tiles.getByText('Instagram')).toBeInTheDocument();
    expect(tiles.getByText('Peel, LHR')).toBeInTheDocument();
    expect(tiles.getByText('Asha M.')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('task-drawer-how')).getAllByRole('listitem'),
    ).toHaveLength(3);
    expect(screen.getByTestId('task-drawer-outcome-bookedVisit')).toHaveClass(
      'bg-primary',
    );
    expect(screen.getByTestId('task-drawer-outcome-notInterested')).toBeInTheDocument();
    expect(
      screen.getByTestId('task-drawer-outcome-spamOrWrongNumber'),
    ).toBeInTheDocument();
    // The person's one stream, by their contact (D32).
    const chat = screen.getByTestId('chat-column-stub');
    expect(chat).toHaveAttribute('data-contact', TEST_TASK_CONTACT_ID);
    // The thread's divider names the lead the task points at.
    expect(chat).toHaveAttribute('data-lead', TEST_TASK_LEAD_ID);
    // A rule's task is never deleted by hand.
    expect(screen.queryByTestId('task-drawer-delete')).toBeNull();
    expect(useContact).toHaveBeenLastCalledWith(TEST_TASK_CONTACT_ID);
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('shows a visit’s tiles and names the doctor and the member from the team', async () => {
    await openDrawer(confirmDetail());
    expect(screen.getByTestId('task-drawer-owner')).toHaveTextContent('Riya S. (you)');
    expect(screen.getByTestId('task-drawer-source')).toHaveTextContent(
      'Open appointment',
    );
    const tiles = within(screen.getByTestId('task-drawer-tiles'));
    for (const label of ['Visit', 'Service', 'Doctor', 'Status']) {
      expect(tiles.getByText(label)).toBeInTheDocument();
    }
    expect(tiles.getByText('Consultation')).toBeInTheDocument();
    expect(tiles.getByText('Nisha S.')).toBeInTheDocument();
  });

  it('records an outcome with its note and the screen’s clock', async () => {
    const detail = replyDetail();
    const { user, actions } = await openDrawer(detail);
    await user.type(screen.getByTestId('task-drawer-note'), 'Wants Saturday');
    await user.click(screen.getByTestId('task-drawer-outcome-notInterested'));
    expect(actions.recordOutcome).toHaveBeenCalledWith(detail, {
      outcomeId: 'notInterested',
      note: 'Wants Saturday',
      now: NOW,
    });
  });

  it('holds the outcomes while a write is in flight', async () => {
    await openDrawer(replyDetail(), { actions: spyActions(true) });
    expect(screen.getByTestId('task-drawer-outcome-bookedVisit')).toBeDisabled();
  });

  it('hides what a Therapist’s codes can’t do on a lead’s task — Snooze stays, Assigned is read-only', async () => {
    member.codes = [...THERAPIST_CODES];
    await openDrawer(replyDetail());
    // Every reply outcome writes the lead (lead:update), so the section goes.
    expect(screen.queryByTestId('task-drawer-outcome-bookedVisit')).toBeNull();
    expect(screen.queryByTestId('task-drawer-note')).toBeNull();
    // No lead:read: no tiles' record, no "Open lead".
    expect(screen.queryByTestId('task-drawer-source')).toBeNull();
    expect(screen.getByTestId('task-drawer-snooze')).toBeInTheDocument();
    // Moving a lead's task moves its lead too (D81 TASKS-M3).
    expect(screen.getByTestId('task-drawer-assign')).toBeDisabled();
  });

  it('hides the check-in outcomes for a person without a patient file', async () => {
    await openDrawer({
      task: taskRow({
        type: 'aftercare',
        ruleKey: 'aftercare',
        title: 'Aftercare call · Anaya',
        link: { kind: 'treatment', id: 'ptr_anaya0000000000000000' },
      }),
      source: null,
      quote: null,
    });
    expect(screen.queryByTestId('task-drawer-outcome-logCheckIn')).toBeNull();
    expect(screen.queryByTestId('task-drawer-outcome-doingWell')).toBeNull();
    expect(screen.getByTestId('task-drawer-outcome-noAnswer')).toBeInTheDocument();
  });

  it('opens the record from the source button', async () => {
    const { user, onOpenTarget } = await openDrawer(replyDetail());
    await user.click(screen.getByTestId('task-drawer-source'));
    expect(onOpenTarget).toHaveBeenCalledWith({
      kind: 'lead',
      leadId: TEST_TASK_LEAD_ID,
    });
  });

  it('snoozes from the footer with the screen’s clock', async () => {
    const detail = replyDetail();
    const { user, actions } = await openDrawer(detail);
    await user.click(screen.getByTestId('task-drawer-snooze'));
    await user.click(
      within(await screen.findByTestId('task-drawer-snooze-panel')).getByText('1 hour'),
    );
    expect(actions.snooze).toHaveBeenCalledWith(detail.task, 'oneHour', NOW);
  });

  it('gives the task to a member or to a role’s queue', async () => {
    const detail = replyDetail();
    const { user, actions } = await openDrawer(detail);
    await user.click(screen.getByTestId('task-drawer-assign'));
    const panel = within(await screen.findByTestId('task-drawer-assign-panel'));
    expect(panel.getByText('Role queues')).toBeInTheDocument();
    await user.click(panel.getByText('Asha Mehta'));
    expect(actions.reassign).toHaveBeenCalledWith(detail.task, {
      membershipId: ASHA.id,
    });
    await user.click(screen.getByTestId('task-drawer-assign'));
    await user.click(
      within(await screen.findByTestId('task-drawer-assign-panel')).getByText(
        'Counsellor',
      ),
    );
    expect(actions.reassign).toHaveBeenLastCalledWith(detail.task, {
      role: 'counsellor',
    });
  });

  it('names where the task was before: "Was <A> → <B>"', async () => {
    await openDrawer(
      replyDetail({
        ownerId: ASHA.id,
        ownerRole: null,
        ownerChanges: [
          {
            fromId: RIYA.id,
            fromRole: null,
            toId: ASHA.id,
            toRole: null,
            changedById: RIYA.id,
            at: '2026-10-10T04:00:00.000Z',
          },
          {
            fromId: null,
            fromRole: 'front_desk',
            toId: RIYA.id,
            toRole: null,
            changedById: RIYA.id,
            at: '2026-10-10T03:00:00.000Z',
          },
        ],
      }),
    );
    expect(screen.getByTestId('task-drawer-was')).toHaveTextContent(
      'Was Front desk → Riya S.',
    );
  });

  it('reads a closed task: its result, no outcomes, no Snooze or Assigned', async () => {
    await openDrawer(
      replyDetail({
        status: 'done',
        outcome: 'done',
        resultText: `Done by ${PRODUCT_NAME}`,
        isResolvedAutomatically: true,
        resolvedAt: '2026-10-10T04:50:00.000Z',
      }),
    );
    expect(screen.getByText(`✓ Done by ${PRODUCT_NAME}`)).toBeInTheDocument();
    expect(screen.queryByTestId('task-drawer-outcome-bookedVisit')).toBeNull();
    expect(screen.queryByTestId('task-drawer-snooze')).toBeNull();
    expect(screen.queryByTestId('task-drawer-assign')).toBeNull();
  });

  it('closes itself when a reply from its chat lets the rules close it (D81 T7)', async () => {
    const { user, rerender, onClose } = await openDrawer(replyDetail());
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(refreshAfterRules).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    rerender(replyDetail({ status: 'done', isResolvedAutomatically: true }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('books from the chat for a member with Appointments create — the person by their contact', async () => {
    const { user, onOpenTarget } = await openDrawer(replyDetail());
    await user.click(screen.getByRole('button', { name: 'Book' }));
    expect(onOpenTarget).toHaveBeenCalledWith({
      kind: 'newAppointment',
      whoId: TEST_TASK_CONTACT_ID,
    });
  });

  it('has no chat column for a task about nobody, or without the stream’s read code', async () => {
    const { rerender } = await openDrawer({
      task: taskRow({
        kind: 'manual',
        type: 'by_hand',
        ruleKey: null,
        title: 'Order more gloves',
        why: null,
        contact: null,
        person: null,
        link: null,
      }),
      source: null,
      quote: null,
    });
    expect(screen.queryByTestId('chat-column-stub')).toBeNull();
    expect(screen.queryByTestId('task-drawer-person')).toBeNull();
    // Nothing to say under "1 · What" without a why line.
    expect(screen.queryByText('1 · What')).toBeNull();
    member.codes = OWNER_CODES.filter((code) => code !== 'contact_activity:read');
    rerender(replyDetail());
    expect(screen.queryByTestId('chat-column-stub')).toBeNull();
  });

  it('deletes a task made by hand with a reason, and its Undo restores it', async () => {
    vi.mocked(deleteTask).mockResolvedValue(undefined);
    vi.mocked(restoreTask).mockResolvedValue(taskRecord({ kind: 'manual' }));
    const byHand = replyDetail({
      kind: 'manual',
      type: 'by_hand',
      ruleKey: null,
      title: 'Call Anaya about the peel',
    });
    const { drawer, user, onClose } = await openDrawer(byHand);
    expect(drawer).toHaveAccessibleDescription('Added by hand');
    await user.click(screen.getByTestId('task-drawer-delete'));
    const confirm = await screen.findByTestId('confirm-dialog');
    expect(within(confirm).getByText('Delete this task?')).toBeInTheDocument();
    expect(within(confirm).getByTestId('confirm-record')).toHaveTextContent(
      'Call Anaya about the peel',
    );
    await user.click(within(confirm).getByTestId('confirm-reason-duplicate'));
    await user.click(within(confirm).getByTestId('confirm-accept'));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(deleteTask).toHaveBeenCalledWith({
      taskId: byHand.task.id,
      reason: 'duplicate',
      note: null,
    });
    const [message, options] = notifyMock.undo.mock.lastCall as [
      string,
      { onUndo: () => void },
    ];
    expect(message).toBe('Call Anaya about the peel removed');
    options.onUndo();
    await waitFor(() =>
      expect(restoreTask).toHaveBeenCalledWith(byHand.task.id, expect.any(String)),
    );
  });

  it('offers no Delete without task:delete', async () => {
    member.codes = OWNER_CODES.filter((code) => code !== 'task:delete');
    await openDrawer(replyDetail({ kind: 'manual', type: 'by_hand', ruleKey: null }));
    expect(screen.queryByTestId('task-drawer-delete')).toBeNull();
  });

  it('shows bars while the task loads', async () => {
    await openDrawer(undefined);
    expect(screen.getByTestId('task-drawer-title')).toHaveTextContent('Task');
    expect(screen.queryByTestId('retry-error')).toBeNull();
    expect(screen.queryByTestId('task-drawer-dismiss')).toBeNull();
  });

  it('shows a failed read’s error with Retry in place', async () => {
    const onRetry = vi.fn();
    const { user } = await openDrawer(undefined, { failed: true, onRetry });
    await user.click(screen.getByTestId('retry-button'));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
