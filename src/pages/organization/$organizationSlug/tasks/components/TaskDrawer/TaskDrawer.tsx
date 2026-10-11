import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type TaskDetail,
  type TaskPerson,
  taskReassignCodes,
  type TaskRow,
} from '@/shared/api/app/tasks-contracts.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/app/task-rules.constants.ts';
import type { TaskTarget } from '@/shared/app/task-targets.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useRefreshTasksAfterRules } from '@/shared/hooks/useTasks/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import type { TaskActions } from '../../hooks/useTaskActions/index.ts';
import type { TaskAssignees } from '../../hooks/useTaskAssignees/index.ts';
import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';
import { lowerFirst } from '../../tasks.display.ts';
import { taskDrawerColumns } from './task-drawer-columns.ts';
import { TaskDeleteConfirm } from './TaskDeleteConfirm.tsx';
import { TaskDrawerChat } from './TaskDrawerChat.tsx';
import { TaskDrawerFooterControls } from './TaskDrawerFooter.tsx';
import {
  type TaskCanCode,
  TaskDrawerBody,
  TaskDueOwner,
  TaskRuleTile,
} from './TaskDrawerSections.tsx';

const K = TASKS_KEYS.drawer;
const IDS = TASKS_TEST_IDS.drawer;

/** Props of {@link TaskDrawer}. */
export interface TaskDrawerProps {
  /** The task's read; undefined while it loads (the frame shows bars). */
  detail: TaskDetail | undefined;
  /** The screen's clock — due labels, and what an outcome's or a snooze's times count from. */
  now: Date;
  actions: TaskActions;
  assignees: TaskAssignees;
  /** Backdrop, ×, "Close", Esc — and after an outcome, a snooze, a claim or a delete. */
  onClose: () => void;
  /** The source button, a follow-on, the chat's "Book". */
  onOpenTarget: (target: TaskTarget) => void;
  /** The person's contact card actions. */
  contactActions?: ContactCardActions;
  /** The record the source button and the cards name ("Task"), while it loads. */
  pendingTitle: string;
  /** The read failed (a dropped connection, a 5xx): the body shows the error with Retry. */
  failed?: boolean;
  /** Read the task again. */
  onRetry?: () => void;
}

/**
 * Closes the drawer when its task resolves itself while open — a "Reply to"
 * task once a reply goes out from its chat and the rules close it (D81 T7) —
 * but never for a task that was already resolved when it opened, nor during
 * the member's own write (which closes it itself).
 */
function useClosesWhenResolved(
  detail: TaskDetail | undefined,
  busy: boolean,
  onClose: () => void,
) {
  // Whether the task was already resolved when its read first arrived.
  const [openedResolved, setOpenedResolved] = useState<boolean | null>(null);
  if (detail && openedResolved === null) {
    setOpenedResolved(detail.task.status === 'done');
  }
  const resolved = detail?.task.status === 'done';
  useEffect(() => {
    if (resolved && openedResolved === false && !busy) onClose();
  }, [resolved, openedResolved, busy, onClose]);
}

/**
 * The header's sub line (`tasks.md` › Task drawer › Header): a rule's "Created
 * by Clinozy · <rule, lower-case>", a task made by hand's "Added by hand" (the
 * API names no creator, research-tasks T15) — none while the task loads.
 */
function useTaskDrawerSub(detail: TaskDetail | undefined): string | undefined {
  const { t, i18n } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  if (!detail) return undefined;
  if (detail.task.kind !== 'rule') return t(K.subByHand);
  const rule = lowerFirst(
    tRules(TASK_RULE_KEYS.rules[detail.task.type].description),
    i18n.language,
  );
  return t(K.sub, { rule });
}

/** What the member may do with the task — each by its clinozy-be codes (research-tasks §7). */
interface TaskDrawerGates {
  canCode: TaskCanCode;
  canSnooze: boolean;
  canReassign: boolean;
  /** A task made by hand only — a rule's task is a `409 rule_task`. */
  canDelete: boolean;
  /** The chat column reads the person's stream (`contact_activity:read`). */
  canChat: boolean;
  canReadContact: boolean;
  canBook: boolean;
}

/** The drawer's gates for a task, from the member's codes (all false under View-as). */
function useTaskDrawerGates(row: TaskRow | undefined): TaskDrawerGates {
  const access = useAppAccess();
  const canCode: TaskCanCode = (code) => access.isResolved && access.canCode(code);
  return {
    canCode,
    canSnooze: canCode('task:update'),
    canReassign: row ? taskReassignCodes(row).every(canCode) : false,
    canDelete: row !== undefined && row.kind !== 'rule' && canCode('task:delete'),
    canChat: canCode('contact_activity:read'),
    canReadContact: canCode('contact:read'),
    canBook: canCode('appointment:create'),
  };
}

/** What the chat column needs beside the person. */
interface TaskChatAsideOptions {
  /** The task's read — the lead it points at names the thread. */
  detail: TaskDetail;
  gates: TaskDrawerGates;
  viewportWidth: number;
  chatWidth: number;
  contactActions?: ContactCardActions;
  onOpenTarget: (target: TaskTarget) => void;
  onSent: () => void;
}

/**
 * The record drawer's aside: the person's chat column — "Book" for a member
 * with Appointments create (the booking is the person's, by their contact).
 */
function taskChatAside(
  person: TaskPerson,
  {
    detail,
    gates,
    viewportWidth,
    chatWidth,
    contactActions,
    onOpenTarget,
    onSent,
  }: TaskChatAsideOptions,
) {
  return {
    width: chatWidth,
    content: (
      <div
        data-testid={IDS.chat}
        data-slot="surface"
        className="bg-canvas relative flex min-h-0 flex-1 flex-col"
      >
        <TaskDrawerChat
          person={person}
          lead={detail.source?.kind === 'lead' ? detail.source.lead : null}
          canReadContact={gates.canReadContact}
          viewportWidth={viewportWidth}
          chatWidth={chatWidth}
          contactActions={contactActions}
          onBookAppointment={
            gates.canBook
              ? () => onOpenTarget({ kind: 'newAppointment', whoId: person.id })
              : undefined
          }
          onSent={onSent}
        />
      </div>
    ),
  };
}

/** The header's two ends once the task is read: the type's tile, the due label and owner. */
function taskDrawerHeader(
  detail: TaskDetail | undefined,
  now: Date,
  assignees: TaskAssignees,
) {
  if (!detail) return {};
  return {
    headerStart: <TaskRuleTile detail={detail} />,
    headerEnd: <TaskDueOwner detail={detail} now={now} assignees={assignees} />,
  };
}

/** The body while the task is not there: its error with Retry, else bars. */
function PendingBody({ failed, onRetry }: { failed: boolean; onRetry?: () => void }) {
  if (failed && onRetry) {
    return (
      <div className="p-(--drawer-body-pad)">
        <RetryError onRetry={onRetry} />
      </div>
    );
  }
  return <SkeletonRows rows={6} className="p-(--drawer-body-pad)" />;
}

/**
 * The task drawer (KICKOFF §6.10 Task drawer; `tasks.md:103–132`;
 * H:2156–2211) on clinozy-be — the record drawer: from `md` `min(900px,
 * 100vw − 40px)` in two columns, the task column and the person's chat column
 * at the width `taskDrawerColumns` gives (1440: 480 + 420; 820: 409 + 371),
 * with the floating ×; on a phone the full screen, the task column alone and
 * the × inside. The header: the type's tile, the title over "Created by
 * Clinozy · <rule>" (or "Added by hand"), the due label over the owner chip.
 * The body: who and the source button, What and the quoted message, the
 * record's tiles, How, the outcomes the member's codes can run and their
 * note. The footer: Snooze and Assigned at its start, Delete for a task made
 * by hand, then "Close". Focus starts on the title; while the task loads the
 * frame shows bars, and a failed read its error with Retry. A task about
 * nobody, or a member who may not read the person's stream, has no chat
 * column.
 */
export function TaskDrawer({
  detail,
  now,
  actions,
  assignees,
  onClose,
  onOpenTarget,
  contactActions,
  pendingTitle,
  failed = false,
  onRetry,
}: TaskDrawerProps) {
  const { t } = useTranslation(TASKS_NS);
  const leadChatWidth = useDevicePrefsStore((state) => state.leadChatWidth);
  const [viewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  );
  const [note, setNote] = useState('');
  const [deleting, setDeleting] = useState(false);
  const refreshAfterRules = useRefreshTasksAfterRules();
  const sub = useTaskDrawerSub(detail);
  useClosesWhenResolved(detail, actions.busy, onClose);
  const row = detail?.task;
  const gates = useTaskDrawerGates(row);
  const person = row?.person ?? null;
  const chatPerson = gates.canChat ? person : null;
  const columns = taskDrawerColumns(viewportWidth, leadChatWidth);

  return (
    <>
      <RecordDrawer
        open
        onClose={onClose}
        title={row ? row.title : pendingTitle}
        sub={sub}
        {...taskDrawerHeader(detail, now, assignees)}
        panelWidth={chatPerson ? columns.total : columns.task}
        aside={
          chatPerson && detail
            ? taskChatAside(chatPerson, {
                detail,
                gates,
                viewportWidth,
                chatWidth: columns.chat,
                contactActions,
                onOpenTarget,
                onSent: refreshAfterRules,
              })
            : undefined
        }
        footerStart={
          row ? (
            <TaskDrawerFooterControls
              row={row}
              assignees={assignees}
              busy={actions.busy}
              canSnooze={gates.canSnooze}
              canReassign={gates.canReassign}
              onSnooze={(option) => actions.snooze(row, option, now)}
              onReassign={(assignee) => actions.reassign(row, assignee)}
            />
          ) : undefined
        }
        onDelete={gates.canDelete ? () => setDeleting(true) : undefined}
        hideFooter={!detail}
        dismissLabel={t(K.close)}
        flushBody
        testId={IDS.root}
      >
        {detail ? (
          <TaskDrawerBody
            detail={detail}
            now={now}
            busy={actions.busy}
            canCode={gates.canCode}
            assignees={assignees}
            note={note}
            onNote={setNote}
            onOutcome={(outcomeId) =>
              actions.recordOutcome(detail, { outcomeId, note, now })
            }
            onOpenTarget={onOpenTarget}
            contactActions={contactActions}
          />
        ) : (
          <PendingBody failed={failed} onRetry={onRetry} />
        )}
      </RecordDrawer>
      <TaskDeleteConfirm
        task={deleting && row ? row : null}
        onClose={() => setDeleting(false)}
        onDeleted={onClose}
      />
    </>
  );
}
