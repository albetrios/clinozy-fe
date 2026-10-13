import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import { isTaskOverdue } from '@/shared/api/app/task-views.ts';
import {
  TASK_TYPES,
  type TaskOutcomePlan,
  type TaskRow,
} from '@/shared/api/app/tasks-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  TASK_QUEUE_KEYS,
  TASK_RULE_KEYS,
  TASK_RULES_NS,
} from '@/shared/app/task-rules.constants.ts';
import { personFirstName, shortPersonName } from '@/shared/components/Cells/index.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useTaskDueLabel } from '@/shared/hooks/useTaskDueLabel/index.ts';

import type { WorkQueueEntry, WorkQueueScope } from '../../hooks/useWorkQueue/index.ts';
import { TODAY_KEYS, TODAY_NS, TODAY_TEST_IDS } from '../../today.constants.ts';

/** Who the cards name: the team by membership id, and the signed-in member's own. */
export interface WorkQueueTeam {
  byId: ReadonlyMap<string, DirectoryMember>;
  /** The signed-in member's membership id — "(you)"; undefined while it loads. */
  myMembershipId: string | null | undefined;
}

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
  team: WorkQueueTeam;
  /**
   * The outcomes the member can run on a task (`visibleTaskOutcomes` — none without
   * `task:update` or in a View-as preview: the card reads only).
   */
  outcomesOf: (row: TaskRow) => readonly TaskOutcomePlan[];
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

/**
 * A card's text colours, open and closed. The design closes a card at 70%
 * opacity (H:620–650), which took its 11–12px lines to 3.7–4.4:1 — below WCAG
 * AA (axe, the Today a11y spec). A closed card recedes one text step per line
 * instead, every pair one the preset's contrast test holds at ≥ 4.5:1 in both
 * modes; its tone pill and "✓ <result>" keep their colours.
 */
const QUEUE_CARD_INK = {
  open: {
    title: '',
    why: 'text-foreground-soft',
    meta: 'text-muted-foreground-strong',
  },
  closed: {
    title: 'text-muted-foreground-strong',
    why: 'text-muted-foreground',
    meta: 'text-muted-foreground',
  },
} as const;

/**
 * "Owner: Riya (you)" · "Owner: Kiran P." — a task in a role's queue reads the role ("Owner: Front
 * desk", research-tasks Q3), one with neither "Owner: Anyone"; a member no longer on the team (or
 * still loading) leaves the name empty.
 */
function useOwnerName(team: WorkQueueTeam): (row: TaskRow) => string {
  const { t } = useTranslation(TODAY_NS);
  const { t: tTasks } = useTranslation(TASK_RULES_NS);
  const { t: tApp } = useTranslation(APP_NS);
  return (row) => {
    if (!row.ownerId) {
      return row.ownerRole
        ? tApp(APP_KEYS.roles[row.ownerRole])
        : tTasks(TASK_QUEUE_KEYS.anyone);
    }
    const owner = team.byId.get(row.ownerId);
    if (!owner) return '';
    if (owner.id === team.myMembershipId) {
      return t(TODAY_KEYS.queue.you, { name: personFirstName(owner.name) });
    }
    return shortPersonName(owner.name);
  };
}

/** The card's outcome buttons, worded by the type's copy (the first one is the type's own first). */
function QueueOutcomes({
  row,
  outcomes,
  busy,
  onOutcome,
}: {
  row: TaskRow;
  outcomes: readonly TaskOutcomePlan[];
  busy: boolean;
  onOutcome: WorkQueueProps['onOutcome'];
}) {
  const { t: tTasks } = useTranslation(TASK_RULES_NS);
  const copy = TASK_RULE_KEYS.rules[row.type].outcomes as Readonly<
    Record<string, { label: string } | undefined>
  >;
  if (outcomes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.25">
      {outcomes.map((outcome) => {
        const label = copy[outcome.id]?.label;
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
            {label ? tTasks(label) : outcome.id}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One work-queue card (`today.md:66`; H:620–650): the type's pill in its tone
 * and the due label (blush when overdue) · the task · why · "Owner: <name>" ·
 * the outcomes the member can run — or, once closed, "✓ <result>" with the
 * card receded ({@link QUEUE_CARD_INK}: the design's 70%, kept at AA contrast;
 * a close the server made reads "Done by Clinozy" as its due label alone).
 */
function QueueCard({
  entry,
  now,
  team,
  outcomesOf,
  onOutcome,
}: {
  entry: WorkQueueEntry;
  now: Date;
  team: WorkQueueTeam;
  outcomesOf: WorkQueueProps['outcomesOf'];
  onOutcome: WorkQueueProps['onOutcome'];
}) {
  const { t } = useTranslation(TODAY_NS);
  const { t: tTasks } = useTranslation(TASK_RULES_NS);
  // The Today room already is today: today's due times read bare.
  const dueLabel = useTaskDueLabel({ sameDay: true });
  const ownerName = useOwnerName(team);
  const { row, result, busy } = entry;
  const owner = ownerName(row);
  const closed = result !== null;
  const overdue = !closed && isTaskOverdue(row, now);
  const ink = QUEUE_CARD_INK[closed ? 'closed' : 'open'];
  return (
    <article
      data-testid={TODAY_TEST_IDS.queueCard}
      data-task-id={row.id}
      data-closed={closed || undefined}
      aria-busy={busy || undefined}
      className="bg-background flex flex-col gap-1.5 rounded-lg border p-2.5"
    >
      <div className="flex items-center justify-between gap-1.5">
        <span
          data-slot="pill"
          className={cn(
            'text-micro rounded-full px-2 py-px leading-[normal]',
            TONE_CLASSES[TASK_TYPES[row.type].tone].surface,
          )}
        >
          {tTasks(TASK_RULE_KEYS.rules[row.type].label)}
        </span>
        <span
          className={cn(
            'text-caption leading-[normal] tabular-nums',
            overdue ? TONE_CLASSES.blush.ink : ink.meta,
          )}
        >
          {dueLabel(row, now)}
        </span>
      </div>
      <p className={cn('text-body leading-[normal] font-medium', ink.title)}>
        {row.title}
      </p>
      {row.why ? <p className={cn('text-xs leading-[1.4]', ink.why)}>{row.why}</p> : null}
      {owner ? (
        <p className={cn('text-caption leading-[normal]', ink.meta)}>
          {t(TODAY_KEYS.queue.owner, { name: owner })}
        </p>
      ) : null}
      {closed && result ? (
        <p className="text-success-strong text-xs leading-[normal]">
          {t(TODAY_KEYS.queue.closed, { result })}
        </p>
      ) : null}
      {closed ? null : (
        <QueueOutcomes
          row={row}
          outcomes={outcomesOf(row)}
          busy={busy}
          onOutcome={onOutcome}
        />
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
  team,
  outcomesOf,
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
        <fieldset
          aria-label={t(TODAY_KEYS.queue.scope)}
          className="m-0 flex min-w-0 flex-none overflow-hidden rounded-md border p-0"
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
        </fieldset>
      </div>
      <div className="flex flex-col gap-2 px-3 pb-3 md:min-h-0 md:flex-1 md:overflow-y-auto">
        {loading
          ? SKELETON_CARDS.map((key) => <QueueCardSkeleton key={key} />)
          : entries.map((entry) => (
              <QueueCard
                key={entry.row.id}
                entry={entry}
                now={now}
                team={team}
                outcomesOf={outcomesOf}
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
