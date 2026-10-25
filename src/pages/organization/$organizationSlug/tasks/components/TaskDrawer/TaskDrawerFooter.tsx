import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import {
  TASK_SNOOZE_OPTIONS,
  type TaskAssignee,
  type TaskRow,
  type TaskSnoozeOption,
} from '@/shared/api/app/tasks-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { shortPersonName } from '@/shared/components/Cells/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useBranchHours } from '@/shared/hooks/useBranchHours/index.ts';
import { ChevronDown } from '@/shared/icons/index.ts';

import {
  TASK_QUEUE_ROLES,
  taskAssigneeKeyOf,
  taskAssigneeOfKey,
  type TaskAssignees,
} from '../../hooks/useTaskAssignees/index.ts';
import { useTaskSnoozeWords } from '../../hooks/useTaskSnoozeWords/index.ts';
import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';

const K = TASKS_KEYS.drawer;
const IDS = TASKS_TEST_IDS.drawer;

/** The footer's 36px outline buttons (`tasks.md` › Task drawer › Footer), on the outline `Button`. */
const FOOTER_BUTTON = 'bg-card hover:bg-muted text-foreground gap-1.5 shadow-none';

/** The Assigned list's key for the task's owner: the member, else its role's queue. */
function ownerKeyOf(row: Pick<TaskRow, 'ownerId' | 'ownerRole'>): string | null {
  if (row.ownerId) return taskAssigneeKeyOf({ membershipId: row.ownerId });
  return row.ownerRole ? taskAssigneeKeyOf({ role: row.ownerRole }) : null;
}

/** A dropdown's chevron, turned over while its list is open. */
function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      aria-hidden="true"
      className={cn(
        'text-muted-foreground size-3.5 transition-transform duration-150',
        open && 'rotate-180',
      )}
    />
  );
}

/**
 * Where the task was before, oldest first ("Was <A> → <B>"): each move's
 * member by short name, a role's queue by its name, "Anyone" for neither; a
 * member who has left the team is skipped.
 */
function usePreviousOwners(row: TaskRow, assignees: TaskAssignees): string[] {
  const { t } = useTranslation(TASKS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  return [...row.ownerChanges].reverse().flatMap((change) => {
    if (change.fromId) {
      const member = assignees.byId.get(change.fromId);
      return member ? [shortPersonName(member.name)] : [];
    }
    if (change.fromRole) return [tApp(APP_KEYS.roles[change.fromRole])];
    return [t(TASKS_KEYS.row.anyone)];
  });
}

/** The Assigned list: the team who can work tasks, then the role queues. */
function useAssigneeOptions(
  assignees: TaskAssignees,
): PickerOption<DirectoryMember | null>[] {
  const { t } = useTranslation(TASKS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const team = t(K.assignGroups.team);
  const queues = t(K.assignGroups.queues);
  return [
    ...assignees.options.map((option) => ({ ...option, group: team })),
    ...TASK_QUEUE_ROLES.map((role): PickerOption<DirectoryMember | null> => ({
      key: taskAssigneeKeyOf({ role }),
      label: tApp(APP_KEYS.roles[role]),
      group: queues,
      leading: { kind: 'none' },
      data: null,
    })),
  ];
}

/** The Assigned trigger's words: the member, the queue, or "Anyone". */
function useOwnerWords(row: TaskRow, assignees: TaskAssignees): string {
  const { t } = useTranslation(TASKS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const member = row.ownerId ? assignees.byId.get(row.ownerId) : undefined;
  if (member) return shortPersonName(member.name);
  if (row.ownerRole) return tApp(APP_KEYS.roles[row.ownerRole]);
  return row.ownerId ? '' : t(TASKS_KEYS.row.anyone);
}

/** Props of {@link TaskDrawerFooterControls}. */
interface TaskDrawerFooterControlsProps {
  row: TaskRow;
  assignees: TaskAssignees;
  busy: boolean;
  /** "Snooze" — the member holds `task:update`. */
  canSnooze: boolean;
  /** "Assigned" — `task:update`, and `lead:update` for a lead's task (`taskReassignCodes`). */
  canReassign: boolean;
  /** The drawer's clock: "Tomorrow" names the branch's next opening from it. */
  now: Date;
  onSnooze: (option: TaskSnoozeOption) => void;
  onReassign: (assignee: TaskAssignee) => void;
}

/**
 * The task column's footer controls (`tasks.md` › Task drawer › Footer), at
 * the record drawer footer's start: "Snooze ⌄" (1 hour · 3 hours · the task's
 * branch's next opening, "Tomorrow 10:00 am" · Next week), "Assigned <name> ⌄"
 * (the team who can work tasks, the
 * member "(you)", then the role queues) with "Was <A> → <B>" after a move.
 * The footer's own "Close" (and Delete, for a task made by hand) follows; no
 * primary — the outcomes are the actions. A closed task has none of these; a
 * member without the codes sees who has it, read-only.
 */
export function TaskDrawerFooterControls({
  row,
  assignees,
  busy,
  canSnooze,
  canReassign,
  now,
  onSnooze,
  onReassign,
}: TaskDrawerFooterControlsProps) {
  const { t } = useTranslation(TASKS_NS);
  const owner = useOwnerWords(row, assignees);
  const was = usePreviousOwners(row, assignees);
  const options = useAssigneeOptions(assignees);
  const snoozeWords = useTaskSnoozeWords();
  const hours = useBranchHours()(row.branchId);
  if (row.status === 'done') return null;
  return (
    <>
      {canSnooze ? (
        <Picker
          menu
          label={t(K.snooze)}
          value={null}
          options={TASK_SNOOZE_OPTIONS.map((option) => ({
            key: option,
            label: snoozeWords(option, { now, hours }),
            leading: { kind: 'none' },
          }))}
          onChange={(key) => {
            const option = TASK_SNOOZE_OPTIONS.find((candidate) => candidate === key);
            if (option) onSnooze(option);
          }}
          minWidth={200}
          disabled={busy}
          testId={IDS.snooze}
          className="flex flex-none"
          renderTrigger={({ open: listOpen }) => (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              data-testid={IDS.snooze}
              className={cn(FOOTER_BUTTON, 'ps-3.5 pe-2.5')}
            >
              {t(K.snooze)}
              <Chevron open={listOpen} />
            </Button>
          )}
        />
      ) : null}
      <Picker
        label={t(K.assigned)}
        value={ownerKeyOf(row)}
        options={options}
        onChange={(key) => {
          if (key) onReassign(taskAssigneeOfKey(key));
        }}
        searchable
        searchPlaceholder={t(K.searchTeam)}
        minWidth={260}
        disabled={busy || !canReassign}
        testId={IDS.assign}
        className="flex min-w-0 flex-none"
        renderTrigger={({ open: listOpen }) => (
          <Button
            type="button"
            variant="outline"
            disabled={busy || !canReassign}
            data-testid={IDS.assign}
            title={t(K.assignTip)}
            className={cn(FOOTER_BUTTON, 'max-w-full min-w-0 ps-3 pe-2.5')}
          >
            <span className="text-muted-foreground">{t(K.assigned)}</span>
            <span dir="auto" className="min-w-0 truncate">
              {owner}
            </span>
            {canReassign ? <Chevron open={listOpen} /> : null}
          </Button>
        )}
      />
      {was.length > 0 ? (
        <span
          data-testid={IDS.was}
          className="text-muted-foreground text-xs whitespace-nowrap"
        >
          {t(K.was, { names: was.join(' → ') })}
        </span>
      ) : null}
    </>
  );
}
