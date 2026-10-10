/**
 * Stand-ins for the drawers the Tasks page mounts over its list — the task
 * drawer and New task — so the list's suites (`TasksPage.test.tsx`,
 * `tasks-room.test.tsx`) test the list, the toolbar and the rules on their
 * own; the drawers have their own suites. New task's stand-in saves one task
 * by hand. The dialog-route reader's stand-in is `useTasksDialogRouteStub`
 * (`tasks-test-router.tsx`).
 */
import type { TaskRecord } from '@/shared/api/clinic/tasks-contracts.ts';

import { CREATED_TASK } from './tasks-test-data.ts';

/** New task: "Save" hands the page the created task, its owner and due in words. */
export function NewTaskDrawerStub({
  onCreated,
}: {
  onCreated: (created: { task: TaskRecord; owner: string; due: string }) => void;
}) {
  return (
    <div data-testid="new-task-drawer">
      <button
        type="button"
        onClick={() =>
          onCreated({ task: CREATED_TASK, owner: 'Riya S.', due: 'Tomorrow 11 am' })
        }
      >
        Save
      </button>
    </div>
  );
}

/** The task drawer, for the task the URL names. */
export function TaskDrawerStub() {
  return <div data-testid="task-drawer" />;
}
