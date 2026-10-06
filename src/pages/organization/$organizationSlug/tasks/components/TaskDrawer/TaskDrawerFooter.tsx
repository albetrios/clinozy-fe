import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  TASK_SNOOZE_OPTIONS,
  type TaskRow,
  type TaskSnoozeOption,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/clinic/task-rules.constants.ts';
import { personFullName, shortPersonName } from '@/shared/components/Cells/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { ChevronDown } from '@/shared/icons/index.ts';

import type { TaskAssignees } from '../../hooks/useTaskAssignees/index.ts';
import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';

const K = TASKS_KEYS.drawer;
const IDS = TASKS_TEST_IDS.drawer;

/** The footer's 36px outline buttons (`tasks.md` › Task drawer › Footer), on the outline `Button`. */
const FOOTER_BUTTON = 'bg-card hover:bg-muted text-foreground gap-1.5 shadow-none';

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
 * The task column's footer controls (`tasks.md` › Task drawer › Footer), at
 * the record drawer footer's start: "Snooze ⌄" (1 hour · 3 hours · Tomorrow
 * 10:00 · Next week), "Assigned <name> ⌄" (the team, the member "(you)") with
 * "Was <A> → <B>" after a reassign. The footer's own "Close" follows; no
 * primary — the outcomes are the actions. A resolved task has none of these.
 */
export function TaskDrawerFooterControls({
  row,
  assignees,
  busy,
  onSnooze,
  onReassign,
}: {
  row: TaskRow;
  assignees: TaskAssignees;
  busy: boolean;
  onSnooze: (option: TaskSnoozeOption) => void;
  onReassign: (ownerId: string) => void;
}) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const open = row.status !== 'done';
  const owner = row.owner
    ? shortPersonName(personFullName(row.owner))
    : t(TASKS_KEYS.row.anyone);
  const was = row.previousOwners.map((staff) => shortPersonName(personFullName(staff)));
  if (!open) return null;
  return (
    <>
      <Picker
        menu
        label={t(K.snooze)}
        value={null}
        options={TASK_SNOOZE_OPTIONS.map((option) => ({
          key: option,
          label: tRules(TASK_RULE_KEYS.snoozeOptions[option]),
          leading: { kind: 'none' },
        }))}
        onChange={(key) => {
          if (key) onSnooze(key as TaskSnoozeOption);
        }}
        minWidth={200}
        disabled={busy}
        testId={IDS.snooze}
        className="flex flex-none"
        renderTrigger={({ open: listOpen }) => (
          <Button
            type="button"
            variant="outline"
            className={cn(FOOTER_BUTTON, 'ps-3.5 pe-2.5')}
          >
            {t(K.snooze)}
            <Chevron open={listOpen} />
          </Button>
        )}
      />
      <Picker
        label={t(K.assigned)}
        value={row.ownerId}
        options={assignees.options}
        onChange={(key) => {
          if (key) onReassign(key);
        }}
        searchable
        searchPlaceholder={t(K.searchTeam)}
        minWidth={260}
        disabled={busy}
        testId={IDS.assign}
        className="flex min-w-0 flex-none"
        renderTrigger={({ open: listOpen }) => (
          <Button
            type="button"
            variant="outline"
            title={t(K.assignTip)}
            className={cn(FOOTER_BUTTON, 'max-w-full min-w-0 ps-3 pe-2.5')}
          >
            <span className="text-muted-foreground">{t(K.assigned)}</span>
            <span className="min-w-0 truncate">{owner}</span>
            <Chevron open={listOpen} />
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
