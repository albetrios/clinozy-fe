import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils.ts';
import type { TaskDetail } from '@/shared/api/clinic/tasks-contracts.ts';
import type { TaskTarget } from '@/shared/clinic/task-targets.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import {
  RECORD_DRAWER_OVERLAY_CLASS,
  RECORD_DRAWER_PANEL_CLASS,
  RecordDrawerClose,
} from '@/shared/components/RecordDrawer/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { Sheet, SheetContent, SheetTitle } from '@/shared/components/ui/sheet.tsx';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import type { TaskActions } from '../../hooks/useTaskActions/index.ts';
import type { TaskAssignees } from '../../hooks/useTaskAssignees/index.ts';
import { TASKS_TEST_IDS } from '../../tasks.constants.ts';
import { taskDrawerColumns } from './task-drawer-columns.ts';
import { TaskDrawerChat } from './TaskDrawerChat.tsx';
import { TaskDrawerFooter } from './TaskDrawerFooter.tsx';
import { TaskDrawerBody, TaskDrawerHeader } from './TaskDrawerSections.tsx';

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
 * The task drawer (KICKOFF §6.10 Task drawer; `tasks.md:103–132`;
 * H:2156–2211): from `md` a sheet at the inline end, `min(900px, 100vw −
 * 40px)`, in two columns — the task column and the shared chat column at the
 * width `taskDrawerColumns` gives (1440: 480 + 420; 820: 409 + 371) — with
 * the floating ×; on a phone the full screen, the task column alone and the ×
 * inside. The task column: the header, the body (who, What, context, How,
 * "Clinozy can do this", the outcomes and their note) and the footer (Snooze,
 * Assigned, Close). Focus starts on the title.
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
  const phone = useViewportTier() === 'phone';
  const leadChatWidth = useDevicePrefsStore((state) => state.leadChatWidth);
  const [viewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  );
  const columns = taskDrawerColumns(viewportWidth, leadChatWidth);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [note, setNote] = useState('');
  useClosesWhenResolved(detail, actions.busy, onClose);

  const style = {
    '--task-total': `${columns.total}px`,
    '--task-chat-w': `${columns.chat}px`,
  } as CSSProperties;
  const row = detail?.task;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="end"
        showCloseButton={false}
        overlayClassName={RECORD_DRAWER_OVERLAY_CLASS}
        data-testid={IDS.root}
        style={style}
        // Without a task there is no sub line to describe the dialog with.
        {...(detail ? {} : { 'aria-describedby': undefined })}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        className={cn(
          RECORD_DRAWER_PANEL_CLASS,
          'md:grid md:w-(--task-total) md:grid-cols-[minmax(0,1fr)_var(--task-chat-w)]',
        )}
      >
        {phone ? null : (
          <RecordDrawerClose placement="floating" onClose={onClose} testId={IDS.root} />
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:border-e">
          {detail && row ? (
            <>
              <TaskDrawerHeader
                detail={detail}
                now={now}
                titleRef={titleRef}
                close={
                  phone ? (
                    <RecordDrawerClose
                      placement="inside"
                      onClose={onClose}
                      testId={IDS.root}
                    />
                  ) : null
                }
              />
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
              <TaskDrawerFooter
                row={row}
                assignees={assignees}
                busy={actions.busy}
                onSnooze={(option) => actions.snooze(row, option)}
                onReassign={(ownerId) => actions.reassign(row, ownerId)}
                onClose={onClose}
              />
            </>
          ) : (
            <>
              <div className="relative flex h-(--drawer-header-height) flex-none items-center border-b p-(--drawer-header-pad)">
                <SheetTitle ref={titleRef} tabIndex={-1} className="sr-only outline-none">
                  {pendingTitle}
                </SheetTitle>
                {phone ? (
                  <RecordDrawerClose
                    placement="inside"
                    onClose={onClose}
                    testId={IDS.root}
                  />
                ) : null}
              </div>
              <SkeletonRows rows={6} className="p-(--drawer-body-pad)" />
            </>
          )}
        </div>
        {phone || !detail ? null : (
          <aside
            data-testid={IDS.chat}
            data-slot="surface"
            className="bg-canvas relative flex min-h-0 min-w-0 flex-col"
          >
            <TaskDrawerChat
              detail={detail}
              viewportWidth={viewportWidth}
              chatWidth={columns.chat}
              contactActions={contactActions}
              onBookAppointment={() => {
                const who = detail.task.person.patientId ?? detail.task.person.leadId;
                if (who) onOpenTarget({ kind: 'newAppointment', whoId: who });
              }}
            />
          </aside>
        )}
      </SheetContent>
    </Sheet>
  );
}
