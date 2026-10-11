import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { isTaskOverdue } from '@/shared/api/app/task-views.ts';
import {
  TASK_TYPES,
  type TaskDetail,
  type TaskOutcomePlan,
  type TaskRow,
  visibleTaskOutcomes,
} from '@/shared/api/app/tasks-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { TASK_RULE_ICONS } from '@/shared/app/task-rule-icons.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/app/task-rules.constants.ts';
import type { TaskTarget } from '@/shared/app/task-targets.ts';
import {
  PersonAvatar,
  personInitials,
  shortPersonName,
} from '@/shared/components/Cells/index.ts';
import { DrawerTextarea } from '@/shared/components/DrawerField/drawer-text-controls.tsx';
import { DrawerField } from '@/shared/components/DrawerField/DrawerField.tsx';
import {
  ContactCard,
  type ContactCardActions,
} from '@/shared/components/PersonCard/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useTaskDueLabel } from '@/shared/hooks/useTaskDueLabel/index.ts';

import type { TaskAssignees } from '../../hooks/useTaskAssignees/index.ts';
import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';
import { taskContactCard } from '../../tasks.display.ts';
import { taskSourceTarget } from './task-drawer-targets.ts';
import {
  type TaskStaffName,
  taskStaffName,
  useTaskContextTiles,
} from './use-task-context-tiles.ts';

const K = TASKS_KEYS.drawer;
const IDS = TASKS_TEST_IDS.drawer;

/** The outcome note's limit (the server's `note`, ≤ 280; the design's 200 — `tasks.md:78`). */
const OUTCOME_NOTE_MAX = 200;

/** Whether the member holds one clinozy-be permission code. */
export type TaskCanCode = (code: string) => boolean;

/** A section's 11px uppercase label ("1 · What"). */
function SectionLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="text-micro text-muted-foreground font-semibold tracking-[0.05em] uppercase"
    >
      {children}
    </h3>
  );
}

/** The header's leading tile: the type's icon on its tone, 36px. */
export function TaskRuleTile({ detail }: { detail: TaskDetail }) {
  const { type } = detail.task;
  const Icon = TASK_RULE_ICONS[type];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 flex-none items-center justify-center rounded-lg',
        TONE_CLASSES[TASK_TYPES[type].tone].surface,
      )}
    >
      <Icon className="size-4.5" />
    </span>
  );
}

/**
 * Who a task is with, in words: the member (short name, "(you)" for the
 * signed-in one) with their avatar, else the role queue it waits in ("Front
 * desk", research-tasks Q3), else "Anyone".
 */
function useTaskOwner(row: TaskRow, assignees: TaskAssignees) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const member = row.ownerId ? assignees.byId.get(row.ownerId) : undefined;
  if (member) {
    const short = shortPersonName(member.name);
    return {
      member,
      name:
        member.id === assignees.myMembershipId
          ? t(TASKS_KEYS.assignee.you, { name: short })
          : short,
    };
  }
  if (row.ownerRole) return { member: null, name: tApp(APP_KEYS.roles[row.ownerRole]) };
  return { member: null, name: row.ownerId ? '' : t(TASKS_KEYS.row.anyone) };
}

/**
 * The header's inline end (`tasks.md` › Task drawer › Header): the due label
 * (red when overdue) over the "Assigned to" chip — the member, the role
 * queue, or "Anyone".
 */
export function TaskDueOwner({
  detail,
  now,
  assignees,
}: {
  detail: TaskDetail;
  now: Date;
  assignees: TaskAssignees;
}) {
  const { t } = useTranslation(TASKS_NS);
  const dueLabel = useTaskDueLabel();
  const row = detail.task;
  const overdue = isTaskOverdue(row, now);
  const owner = useTaskOwner(row, assignees);
  return (
    <div className="flex flex-none flex-col items-end gap-1">
      <span
        data-testid={IDS.due}
        className={cn(
          'text-detail font-semibold whitespace-nowrap tabular-nums',
          overdue ? 'text-destructive' : 'text-foreground-soft',
        )}
      >
        {dueLabel(row, now)}
      </span>
      <span
        title={t(K.assignedTo)}
        data-testid={IDS.owner}
        data-slot="pill"
        className="bg-card text-caption text-foreground-soft inline-flex h-6 max-w-40 items-center gap-1.25 rounded-full border ps-0.5 pe-2 whitespace-nowrap"
      >
        {owner.member ? (
          <PersonAvatar
            size="chip"
            initials={owner.member.initials}
            tone={owner.member.tone}
          />
        ) : null}
        <span dir="auto" className="truncate first:ps-1.5">
          {owner.name}
        </span>
      </span>
    </div>
  );
}

/**
 * 1 — who (`tasks.md` › Task drawer › 1): the person's 36px avatar and name
 * under their contact card, and the source button at the inline end — for a
 * member who may read that record. A task about nobody shows only the button.
 */
function WhoRow({
  row,
  canCode,
  contactActions,
  onOpenTarget,
}: {
  row: TaskRow;
  canCode: TaskCanCode;
  contactActions?: ContactCardActions;
  onOpenTarget: (target: TaskTarget) => void;
}) {
  const { t } = useTranslation(TASKS_NS);
  const found = taskSourceTarget(row);
  const source = found && canCode(found.code) ? found : null;
  const { person } = row;
  if (!(person || source)) return null;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {person ? (
        <ContactCard
          data={taskContactCard({ person }) ?? undefined}
          {...contactActions}
          triggerClassName="max-w-full min-w-0 gap-2.5"
        >
          <span data-testid={IDS.person} className="flex min-w-0 items-center gap-2.5">
            <PersonAvatar
              size="field"
              initials={personInitials(person.name)}
              tone={person.patientId ? 'sage' : 'lav'}
              patient={person.patientId !== null}
            />
            <span dir="auto" className="truncate text-sm font-semibold">
              {person.name}
            </span>
          </span>
        </ContactCard>
      ) : null}
      <span className="flex-1" />
      {source ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={IDS.source}
          onClick={() => onOpenTarget(source.target)}
          className="bg-card hover:bg-muted text-detail shadow-none"
        >
          {t(K.source[source.kind])}
        </Button>
      ) : null}
    </div>
  );
}

/** 2 — "1 · What": the why line, the quoted message and a closed task's result (none without any). */
function WhatSection({ detail }: { detail: TaskDetail }) {
  const { t } = useTranslation(TASKS_NS);
  const labelId = useId();
  const row = detail.task;
  const result = row.status === 'done' ? row.resultText : null;
  // A task made by hand without a why line says nothing here.
  if (!(row.why || detail.quote || result)) return null;
  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <SectionLabel id={labelId}>{t(K.sections.what)}</SectionLabel>
      {row.why ? (
        <p dir="auto" className="text-field leading-normal text-pretty">
          {row.why}
        </p>
      ) : null}
      {detail.quote ? (
        <blockquote
          data-testid={IDS.quote}
          dir="auto"
          className="bg-canvas text-body text-foreground-soft rounded-lg border px-3 py-2 leading-[1.45] text-pretty"
        >
          {t(K.quote, { message: detail.quote.text })}
        </blockquote>
      ) : null}
      {result ? (
        <p className="text-success-strong text-xs">
          {t(TASKS_KEYS.row.result, { result })}
        </p>
      ) : null}
    </section>
  );
}

/** 3 — the context tiles: as many 150px columns as fit (two at 1440), one on a phone. */
function ContextTiles({
  detail,
  now,
  staffName,
}: {
  detail: TaskDetail;
  now: Date;
  staffName: TaskStaffName;
}) {
  const tiles = useTaskContextTiles(detail, now, staffName);
  if (tiles.length === 0) return null;
  return (
    <dl
      data-testid={IDS.tiles}
      className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 max-md:grid-cols-1"
    >
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className="flex min-w-0 flex-col gap-0.5 rounded-lg border px-2.5 py-2"
        >
          <dt className="text-tiny text-muted-foreground font-semibold tracking-[0.05em] uppercase">
            {tile.label}
          </dt>
          <dd dir="auto" className="text-body truncate font-medium">
            {tile.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 4 — "2 · How": the type's numbered steps (none for the types the design did not draw). */
function HowSection({ detail }: { detail: TaskDetail }) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const labelId = useId();
  const steps: readonly string[] = TASK_RULE_KEYS.rules[detail.task.type].how;
  if (steps.length === 0) return null;
  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <SectionLabel id={labelId}>{t(K.sections.how)}</SectionLabel>
      <ol data-testid={IDS.how} className="flex flex-col gap-1.5">
        {steps.map((key, index) => (
          <li key={key} className="text-body flex items-center gap-2.5 leading-[1.4]">
            <span
              aria-hidden="true"
              data-slot="pill"
              className="bg-muted text-foreground-soft text-micro flex size-5.5 flex-none items-center justify-center rounded-full font-semibold tabular-nums"
            >
              {index + 1}
            </span>
            <span className="min-w-0 text-pretty">{tRules(key)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The names an effect line reads: the lead's owner, the visit's doctor, the first name. */
type OutcomeWords = {
  owner: string;
  doctor: string;
  first: string;
};

/** One outcome button: its label over its effect line, the first one dark. */
function OutcomeButton({
  row,
  plan,
  first,
  disabled,
  words,
  onOutcome,
}: {
  row: TaskRow;
  plan: TaskOutcomePlan;
  first: boolean;
  disabled: boolean;
  words: OutcomeWords;
  onOutcome: (outcomeId: string) => void;
}) {
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const copy = TASK_RULE_KEYS.rules[row.type].outcomes as Readonly<
    Record<string, { label: string; effect: string } | undefined>
  >;
  const keys = copy[plan.id];
  return (
    <button
      type="button"
      disabled={disabled}
      data-testid={IDS.outcome(plan.id)}
      data-slot="button"
      onClick={() => onOutcome(plan.id)}
      className={cn(
        'flex min-h-14 flex-col items-start gap-0.75 rounded-lg border px-3 py-2.25 text-start transition-shadow duration-150 hover:shadow-(--elevation-menu) disabled:opacity-60',
        first
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-foreground',
      )}
    >
      <span className="text-body font-semibold">
        {keys ? tRules(keys.label) : plan.id}
      </span>
      {keys ? (
        <span
          className={cn(
            'text-caption leading-[1.35] text-pretty',
            first ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}
        >
          {tRules(keys.effect, words)}
        </span>
      ) : null}
    </button>
  );
}

/**
 * 6 — "3 · Close with · then pick what’s next": the outcomes the member can
 * run, the first dark, each a label over its effect line; then the outcome
 * note. None on a closed task, or for a member who can run none.
 */
function OutcomesSection({
  row,
  canCode,
  disabled,
  note,
  onNote,
  onOutcome,
  words,
}: {
  row: TaskRow;
  canCode: TaskCanCode;
  disabled: boolean;
  note: string;
  onNote: (note: string) => void;
  onOutcome: (outcomeId: string) => void;
  words: OutcomeWords;
}) {
  const { t } = useTranslation(TASKS_NS);
  const labelId = useId();
  const outcomes = visibleTaskOutcomes(row, canCode);
  if (row.status === 'done' || outcomes.length === 0) return null;
  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <SectionLabel id={labelId}>{t(K.sections.close)}</SectionLabel>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
        {outcomes.map((plan, index) => (
          <OutcomeButton
            key={plan.id}
            row={row}
            plan={plan}
            first={index === 0}
            disabled={disabled}
            words={words}
            onOutcome={onOutcome}
          />
        ))}
      </div>
      <DrawerField>
        <DrawerTextarea
          value={note}
          onChange={(event) =>
            onNote(event.currentTarget.value.slice(0, OUTCOME_NOTE_MAX))
          }
          maxLength={OUTCOME_NOTE_MAX}
          rows={2}
          aria-label={t(K.outcomeNote.label)}
          placeholder={t(K.outcomeNote.placeholder)}
          data-testid={IDS.note}
        />
      </DrawerField>
    </section>
  );
}

/** The effect lines' names, from the record the task points at and the team directory. */
function outcomeWordsOf(detail: TaskDetail, staffName: TaskStaffName): OutcomeWords {
  const { source, task } = detail;
  const lead = source?.kind === 'lead' ? source.lead : null;
  const visit = source?.kind === 'appointment' ? source.appointment : null;
  return {
    owner: staffName(lead?.ownerId ?? null) ?? '',
    doctor: staffName(visit?.doctorId ?? null) ?? '',
    first: task.person?.firstName ?? '',
  };
}

/** Props of {@link TaskDrawerBody}. */
interface TaskDrawerBodyProps {
  detail: TaskDetail;
  now: Date;
  busy: boolean;
  canCode: TaskCanCode;
  assignees: TaskAssignees;
  note: string;
  onNote: (note: string) => void;
  onOutcome: (outcomeId: string) => void;
  onOpenTarget: (target: TaskTarget) => void;
  contactActions?: ContactCardActions;
}

/** The task column's body, sections 1–6 (`tasks.md` › Task drawer › Body). */
export function TaskDrawerBody({
  detail,
  now,
  busy,
  canCode,
  assignees,
  note,
  onNote,
  onOutcome,
  onOpenTarget,
  contactActions,
}: TaskDrawerBodyProps) {
  const staffName = taskStaffName(assignees.byId);
  const row = detail.task;
  return (
    <div className="flex flex-col gap-4 p-(--drawer-body-pad)">
      <WhoRow
        row={row}
        canCode={canCode}
        contactActions={contactActions}
        onOpenTarget={onOpenTarget}
      />
      <WhatSection detail={detail} />
      <ContextTiles detail={detail} now={now} staffName={staffName} />
      <HowSection detail={detail} />
      <OutcomesSection
        row={row}
        canCode={canCode}
        disabled={busy}
        note={note}
        onNote={onNote}
        onOutcome={onOutcome}
        words={outcomeWordsOf(detail, staffName)}
      />
    </div>
  );
}
