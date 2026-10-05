import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { isTaskOverdue } from '@/shared/api/clinic/task-views.ts';
import { TASK_RULES, type TaskRow } from '@/shared/api/clinic/tasks-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  TASK_QUEUE_KEYS,
  TASK_RULE_KEYS,
  TASK_RULES_NS,
} from '@/shared/clinic/task-rules.constants.ts';
import { personFullName, shortPersonName } from '@/shared/components/Cells/index.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useTaskDueLabel } from '@/shared/hooks/useTaskDueLabel/index.ts';

import type { WorkQueueEntry, WorkQueueScope } from '../../hooks/useWorkQueue/index.ts';
import { TODAY_KEYS, TODAY_NS, TODAY_TEST_IDS } from '../../today.constants.ts';

/** Props for {@link WorkQueue}. */
export interface WorkQueueProps {
  entries: readonly WorkQueueEntry[];
  /** Every open task, whatever the scope. */
  openCount: number;
  /** The first load: four skeleton cards stand in. */
  loading?: boolean;
  scope: WorkQueueScope;
  onScopeChange: (scope: WorkQueueScope) => void;
  /** The clock the due labels read. */
  now: Date;
  onOutcome: (row: TaskRow, outcomeId: string) => void;
  className?: string;
}

/** How many skeleton cards the first load shows (the prototype's placeholder count, H:620). */
const SKELETON_CARDS = ['first', 'second', 'third', 'fourth'] as const;

/** A work-queue card's shape while the tasks first load — flat bars, no shimmer (§3.5). */
function QueueCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-background flex flex-col gap-1.5 rounded-lg border p-2.5"
    >
      <span className="flex items-center justify-between gap-1.5">
        <SkeletonBar className="h-4 w-20" />
        <SkeletonBar className="h-3 w-14" />
      </span>
      <SkeletonBar className="h-3.5 w-40" />
      <SkeletonBar className="h-3 w-full" />
      <SkeletonBar className="h-3 w-24" />
      <span className="flex gap-1.25">
        <SkeletonBar className="h-6 w-20" />
        <SkeletonBar className="h-6 w-20" />
      </span>
    </div>
  );
}

/** "Owner: Riya (you)" · "Owner: Kiran P." · "Owner: Anyone". */
function useOwnerName(): (row: TaskRow) => string {
  const { t } = useTranslation(TODAY_NS);
  const { t: tTasks } = useTranslation(TASK_RULES_NS);
  return (row) => {
    const { owner } = row;
    if (!owner) return tTasks(TASK_QUEUE_KEYS.anyone);
    if (row.ownedByViewer) return t(TODAY_KEYS.queue.you, { name: owner.firstName });
    return shortPersonName(personFullName(owner));
  };
}

/**
 * One work-queue card (`today.md:66`; H:620–650): the rule's pill in its tone
 * and the due label (blush when overdue) · the task · why · "Owner: <name>" ·
 * the rule's outcomes — or, once closed, "✓ <result>" with the card at 70%.
 */
function QueueCard({
  entry,
  now,
  onOutcome,
}: {
  entry: WorkQueueEntry;
  now: Date;
  onOutcome: WorkQueueProps['onOutcome'];
}) {
  const { t } = useTranslation(TODAY_NS);
  const { t: tTasks } = useTranslation(TASK_RULES_NS);
  // The Today room already is today: today's due times read bare.
  const dueLabel = useTaskDueLabel({ sameDay: true });
  const ownerName = useOwnerName();
  const { row, result, busy } = entry;
  const rule = TASK_RULES[row.rule];
  const copy = TASK_RULE_KEYS.rules[row.rule];
  const outcomeKeys = copy.outcomes as Readonly<Record<string, { label: string }>>;
  const closed = result !== null;
  const overdue = !closed && isTaskOverdue(row, now);
  return (
    <article
      data-testid={TODAY_TEST_IDS.queueCard}
      data-task-id={row.id}
      data-closed={closed || undefined}
      aria-busy={busy || undefined}
      className={cn(
        'bg-background flex flex-col gap-1.5 rounded-lg border p-2.5',
        closed && 'opacity-70',
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span
          data-slot="pill"
          className={cn(
            'text-micro rounded-full px-2 py-px leading-[normal]',
            TONE_CLASSES[rule.tone].surface,
          )}
        >
          {tTasks(copy.label)}
        </span>
        <span
          className={cn(
            'text-caption leading-[normal] tabular-nums',
            overdue ? TONE_CLASSES.blush.ink : 'text-muted-foreground-strong',
          )}
        >
          {dueLabel(row, now)}
        </span>
      </div>
      <p className="text-body leading-[normal] font-medium">{row.title}</p>
      {row.why ? (
        <p className="text-foreground-soft text-xs leading-[1.4]">{row.why}</p>
      ) : null}
      <p className="text-caption text-muted-foreground-strong leading-[normal]">
        {t(TODAY_KEYS.queue.owner, { name: ownerName(row) })}
      </p>
      {closed ? (
        <p className="text-success-strong text-xs leading-[normal]">
          {t(TODAY_KEYS.queue.closed, { result })}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.25">
          {rule.outcomes.map((outcome) => {
            const keys = outcomeKeys[outcome.id];
            return (
              <button
                key={outcome.id}
                type="button"
                disabled={busy}
                data-testid={TODAY_TEST_IDS.queueOutcome}
                data-outcome={outcome.id}
                onClick={() => onOutcome(row, outcome.id)}
                className="hover:bg-accent hover:border-border-strong rounded-lg border px-2.25 py-1 text-xs leading-[normal] disabled:opacity-50"
              >
                {keys ? tTasks(keys.label) : outcome.id}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}

/**
 * The work queue (KICKOFF §6.2 Work queue aside; `today.md:21, 61–72`;
 * H:618–652): "Work queue" and "<n> open · each has an owner and a due time"
 * over the joined "Mine · Everyone" control, then the task cards by due time —
 * a 312px column with its own scroll from `md`, full width under the lanes on
 * a phone, flowing with the page. With nothing to show it reads the Tasks
 * room's To do line (its design has none; AMBER).
 */
export function WorkQueue({
  entries,
  openCount,
  loading = false,
  scope,
  onScopeChange,
  now,
  onOutcome,
  className,
}: WorkQueueProps) {
  const { t } = useTranslation(TODAY_NS);
  const { t: tTasks } = useTranslation(TASK_RULES_NS);
  const { formatNumber } = useLocaleFormat();
  const headingId = useId();
  return (
    <aside
      aria-labelledby={headingId}
      data-testid={TODAY_TEST_IDS.queue}
      // The first load: bars over every leaf in place (the rooms' one skeleton, index.css).
      data-refreshing={loading || undefined}
      className={cn(
        'bg-canvas flex flex-col border-t md:min-h-0 md:border-s md:border-t-0',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2.5">
        <div className="min-w-0">
          <h2
            id={headingId}
            className="font-heading text-base leading-[normal] font-semibold tracking-[-0.02em]"
          >
            {t(TODAY_KEYS.queue.title)}
          </h2>
          <p className="text-muted-foreground-strong text-xs leading-[normal]">
            {t(TODAY_KEYS.queue.sub, { open: formatNumber(openCount) })}
          </p>
        </div>
        <div
          role="group"
          aria-label={t(TODAY_KEYS.queue.scope)}
          className="flex flex-none overflow-hidden rounded-md border"
        >
          {(['mine', 'everyone'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              data-testid={TODAY_TEST_IDS.queueScope(value)}
              onClick={() => onScopeChange(value)}
              className={cn(
                'px-2.5 py-1 text-xs leading-[normal] whitespace-nowrap',
                scope === value && 'bg-muted',
              )}
            >
              {tTasks(TASK_QUEUE_KEYS.scope[value])}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 px-3 pb-3 md:min-h-0 md:flex-1 md:overflow-y-auto">
        {loading
          ? SKELETON_CARDS.map((key) => <QueueCardSkeleton key={key} />)
          : entries.map((entry) => (
              <QueueCard
                key={entry.row.id}
                entry={entry}
                now={now}
                onOutcome={onOutcome}
              />
            ))}
        {!loading && entries.length === 0 ? (
          <p
            data-testid={TODAY_TEST_IDS.queueEmpty}
            className="text-detail text-muted-foreground-strong px-1"
          >
            {tTasks(TASK_QUEUE_KEYS.empty)}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
