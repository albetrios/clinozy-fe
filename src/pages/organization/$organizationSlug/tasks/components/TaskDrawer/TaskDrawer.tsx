import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { TaskDetail } from '@/shared/api/clinic/tasks-contracts.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/clinic/task-rules.constants.ts';
import type { TaskTarget } from '@/shared/clinic/task-targets.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import type { TaskActions } from '../../hooks/useTaskActions/index.ts';
import type { TaskAssignees } from '../../hooks/useTaskAssignees/index.ts';
import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';
import { lowerFirst } from '../../tasks.display.ts';
import { taskDrawerColumns } from './task-drawer-columns.ts';
import { TaskDrawerChat } from './TaskDrawerChat.tsx';
import { TaskDrawerFooterControls } from './TaskDrawerFooter.tsx';
import { TaskDrawerBody, TaskDueOwner, TaskRuleTile } from './TaskDrawerSections.tsx';

const K = TASKS_KEYS.drawer;
const IDS = TASKS_TEST_IDS.drawer;

/** Props of {@link TaskDrawer}. */
export interface TaskDrawerProps {
  /** The task's read; undefined while it loads (the frame shows bars). */
  detail: TaskDetail | undefined;
  now: Date;
  actions: TaskActions;
  assignees: TaskAssignees;
  /** Backdrop, ×, "Close", Esc — and after an outcome, a snooze, a claim or a hand-over. */
  onClose: () => void;
  /** The source button, a follow-on, the chat's "Book". */
  onOpenTarget: (target: TaskTarget) => void;
  /** The person's contact card actions. */
  contactActions?: ContactCardActions;
  /** The record the source button and the cards name ("Task"), while it loads. */
  pendingTitle: string;
}

/**
 * Closes the drawer when its task resolves itself while open — a "Reply to"
 * task once a reply goes out from its chat (`tasks.md` › Chat column) — but
 * never for a task that was already resolved when it opened, nor during the
 * member's own write (which closes it itself).
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
 * The header's sub line (`tasks.md` › Task drawer › Header): "Created by
 * Clinozy · <rule, lower-case>" — none while the task loads.
 */
function useTaskDrawerSub(detail: TaskDetail | undefined): string | undefined {
  const { t, i18n } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  if (!detail) return undefined;
  const rule = lowerFirst(
    tRules(TASK_RULE_KEYS.rules[detail.task.rule].description),
    i18n.language,
  );
  return t(K.sub, { rule });
}

/**
 * The task drawer (KICKOFF §6.10 Task drawer; `tasks.md:103–132`;
 * H:2156–2211) — the record drawer: from `md` `min(900px, 100vw − 40px)` in
 * two columns, the task column and the shared chat column at the width
 * `taskDrawerColumns` gives (1440: 480 + 420; 820: 409 + 371), with the
 * floating ×; on a phone the full screen, the task column alone and the ×
 * inside. The header: the rule's tile, the title over "Created by Clinozy ·
 * <rule>", the due label over the "Assigned to" chip. The body: who, What,
 * context, How, "Clinozy can do this", the outcomes and their note. The
 * footer: Snooze and Assigned at its start, then "Close". Focus starts on the
 * title; while the task loads the frame shows bars.
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
}: TaskDrawerProps) {
  const { t } = useTranslation(TASKS_NS);
  const leadChatWidth = useDevicePrefsStore((state) => state.leadChatWidth);
  const [viewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  );
  const columns = taskDrawerColumns(viewportWidth, leadChatWidth);
  const [note, setNote] = useState('');
  const sub = useTaskDrawerSub(detail);
  useClosesWhenResolved(detail, actions.busy, onClose);
  const row = detail?.task;

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={row ? row.title : pendingTitle}
      sub={sub}
      headerStart={detail ? <TaskRuleTile detail={detail} /> : undefined}
      headerEnd={detail ? <TaskDueOwner detail={detail} now={now} /> : undefined}
      panelWidth={columns.total}
      aside={
        detail
          ? {
              width: columns.chat,
              content: (
                <div
                  data-testid={IDS.chat}
                  data-slot="surface"
                  className="bg-canvas relative flex min-h-0 flex-1 flex-col"
                >
                  <TaskDrawerChat
                    detail={detail}
                    viewportWidth={viewportWidth}
                    chatWidth={columns.chat}
                    contactActions={contactActions}
                    onBookAppointment={() => {
                      const who =
                        detail.task.person.patientId ?? detail.task.person.leadId;
                      if (who) onOpenTarget({ kind: 'newAppointment', whoId: who });
                    }}
                  />
                </div>
              ),
            }
          : undefined
      }
      footerStart={
        row ? (
          <TaskDrawerFooterControls
            row={row}
            assignees={assignees}
            busy={actions.busy}
            onSnooze={(option) => actions.snooze(row, option)}
            onReassign={(ownerId) => actions.reassign(row, ownerId)}
          />
        ) : undefined
      }
      hideFooter={!detail}
      dismissLabel={t(K.close)}
      flushBody
      testId={IDS.root}
    >
      {detail && row ? (
        <TaskDrawerBody
          detail={detail}
          now={now}
          busy={actions.busy}
          note={note}
          onNote={setNote}
          onOutcome={(outcomeId) => actions.recordOutcome(detail, outcomeId, note)}
          onHandOver={() => actions.handOver(row)}
          onOpenTarget={onOpenTarget}
          contactActions={contactActions}
        />
      ) : (
        <SkeletonRows rows={6} className="p-(--drawer-body-pad)" />
      )}
    </RecordDrawer>
  );
}
