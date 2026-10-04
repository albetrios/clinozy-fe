import { type ReactNode, type Ref, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { isTaskOverdue } from '@/shared/api/clinic/task-views.ts';
import { TASK_RULES, type TaskDetail } from '@/shared/api/clinic/tasks-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { TASK_RULE_ICONS } from '@/shared/clinic/task-rule-icons.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/clinic/task-rules.constants.ts';
import {
  PersonAvatar,
  personFullName,
  personInitials,
  shortPersonName,
} from '@/shared/components/Cells/index.ts';
import {
  ContactCard,
  type ContactCardActions,
} from '@/shared/components/PersonCard/index.ts';
import { SheetDescription, SheetTitle } from '@/shared/components/ui/sheet.tsx';
import { Textarea } from '@/shared/components/ui/textarea.tsx';
import { Sparkles } from '@/shared/icons/index.ts';

import { useTaskDueLabel } from '../../hooks/useTaskDueLabel/index.ts';
import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';
import { lowerFirst, taskContactCard, taskSourceId } from '../../tasks.display.ts';
import { type TaskDrawerTarget, taskSourceTarget } from './task-drawer-targets.ts';
import { useTaskContextTiles } from './use-task-context-tiles.ts';

const K = TASKS_KEYS.drawer;
const IDS = TASKS_TEST_IDS.drawer;

/** The outcome note's limit (`tasks.md:78`). */
const OUTCOME_NOTE_MAX = 200;

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

/**
 * The header (`tasks.md` › Task drawer › Header): the rule's 36px tile, the
 * title — focused on open — over "Created by Clinozy · <rule, lower-case>",
 * and at the inline end the due label (red when overdue) over the "Assigned
 * to" chip.
 */
export function TaskDrawerHeader({
  detail,
  now,
  titleRef,
  close,
}: {
  detail: TaskDetail;
  now: Date;
  titleRef: Ref<HTMLHeadingElement>;
  /** The phone's × inside the header. */
  close: ReactNode;
}) {
  const { t, i18n } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const dueLabel = useTaskDueLabel();
  const row = detail.task;
  const Icon = TASK_RULE_ICONS[row.rule];
  const overdue = isTaskOverdue(row, now);
  const rule = lowerFirst(
    tRules(TASK_RULE_KEYS.rules[row.rule].description),
    i18n.language,
  );
  return (
    <div className="relative flex h-(--drawer-header-height) flex-none items-center gap-3 overflow-hidden border-b p-(--drawer-header-pad) max-md:pe-14">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-9 flex-none items-center justify-center rounded-lg',
          TONE_CLASSES[TASK_RULES[row.rule].tone].surface,
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <SheetTitle
          ref={titleRef}
          tabIndex={-1}
          data-testid={IDS.title}
          className="truncate text-[length:calc(var(--text-base)*17/16)] leading-[1.25] font-semibold tracking-[-0.01em] outline-none"
        >
          {row.title}
        </SheetTitle>
        <SheetDescription className="text-detail text-muted-foreground truncate">
          {t(K.sub, { rule })}
        </SheetDescription>
      </div>
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
          {row.owner ? (
            <PersonAvatar
              size="chip"
              initials={row.owner.initials}
              tone={row.owner.tone}
            />
          ) : null}
          <span className="truncate">
            {row.owner
              ? shortPersonName(personFullName(row.owner))
              : t(TASKS_KEYS.row.anyone)}
          </span>
        </span>
      </div>
      {close}
    </div>
  );
}

/** "Open appointment · Appt #2848" — the record the task is about, as the button names it. */
function useSourceLabel(detail: TaskDetail): string {
  const { t } = useTranslation(TASKS_NS);
  const { source } = detail.task;
  return t(TASKS_KEYS.sources[source.kind], { id: taskSourceId(source) }).trim();
}

/**
 * 1 — who (`tasks.md` › Task drawer › 1): the person's 36px avatar and name
 * under their contact card, and the source button at the inline end.
 */
function WhoRow({
  detail,
  contactActions,
  onOpenTarget,
}: {
  detail: TaskDetail;
  contactActions?: ContactCardActions;
  onOpenTarget: (target: TaskDrawerTarget) => void;
}) {
  const { t } = useTranslation(TASKS_NS);
  const row = detail.task;
  const source = taskSourceTarget(row);
  const record = useSourceLabel(detail);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <ContactCard
        data={taskContactCard(row)}
        {...contactActions}
        triggerClassName="max-w-full min-w-0 gap-2.5"
      >
        <span data-testid={IDS.person} className="flex min-w-0 items-center gap-2.5">
          <PersonAvatar
            size="field"
            initials={personInitials(row.person.name)}
            tone="lav"
          />
          <span className="truncate text-sm font-semibold">{row.person.name}</span>
        </span>
      </ContactCard>
      <span className="flex-1" />
      {source ? (
        <button
          type="button"
          data-testid={IDS.source}
          data-slot="button"
          onClick={() => onOpenTarget(source.target)}
          className="bg-card hover:bg-muted text-detail h-8 flex-none rounded-lg border px-3 font-medium whitespace-nowrap transition-colors"
        >
          {t(K.source[source.kind], { record })}
        </button>
      ) : null}
    </div>
  );
}

/** 2 — "1 · What": the why line and the quoted message (`tasks.md` › Task drawer › 2). */
function WhatSection({ detail }: { detail: TaskDetail }) {
  const { t } = useTranslation(TASKS_NS);
  const labelId = useId();
  const row = detail.task;
  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <SectionLabel id={labelId}>{t(K.sections.what)}</SectionLabel>
      {row.why ? (
        <p className="text-field leading-normal text-pretty">{row.why}</p>
      ) : null}
      {detail.quote ? (
        <blockquote
          data-testid={IDS.quote}
          className="bg-canvas text-body text-foreground-soft rounded-lg border px-3 py-2 leading-[1.45] text-pretty"
        >
          {t(K.quote, { message: detail.quote })}
        </blockquote>
      ) : null}
      {row.status === 'done' && row.result ? (
        <p className="text-success-strong text-xs">
          {t(TASKS_KEYS.row.result, { result: row.result })}
        </p>
      ) : null}
    </section>
  );
}

/** 3 — the context tiles: as many 150px columns as fit (two at 1440), one on a phone. */
function ContextTiles({ detail, now }: { detail: TaskDetail; now: Date }) {
  const tiles = useTaskContextTiles(detail, now);
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
          <dd className="text-body truncate font-medium">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 4 — "2 · How": the rule's three numbered steps. */
function HowSection({ detail }: { detail: TaskDetail }) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const labelId = useId();
  const steps = TASK_RULE_KEYS.rules[detail.task.rule].how;
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

/** 5 — "Clinozy can do this", for a rule with an automation. */
function AutomationCard({
  detail,
  disabled,
  onHandOver,
}: {
  detail: TaskDetail;
  disabled: boolean;
  onHandOver: () => void;
}) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const key = TASK_RULE_KEYS.rules[detail.task.rule].automation;
  if (!key || detail.task.status === 'done') return null;
  return (
    <div
      data-testid={IDS.automation}
      className="border-border-strong flex items-center gap-3 rounded-xl border border-dashed p-3"
    >
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground flex size-8 flex-none items-center justify-center rounded-lg"
      >
        <Sparkles className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[1.35]">
        <span className="text-body font-semibold">{t(K.automation.title)}</span>
        <span className="text-muted-foreground-strong text-xs text-pretty">
          {tRules(key)}
        </span>
      </span>
      <button
        type="button"
        disabled={disabled}
        data-testid={IDS.automationAction}
        data-slot="button"
        onClick={onHandOver}
        className="border-primary bg-card hover:bg-muted text-detail h-8 flex-none rounded-lg border px-3 font-medium whitespace-nowrap transition-colors disabled:opacity-50"
      >
        {t(K.automation.action)}
      </button>
    </div>
  );
}

/**
 * 6 — "3 · Close with · then pick what’s next": the rule's outcomes, the first
 * dark, each a label over its effect line; then the outcome note.
 */
function OutcomesSection({
  detail,
  disabled,
  note,
  onNote,
  onOutcome,
  words,
}: {
  detail: TaskDetail;
  disabled: boolean;
  note: string;
  onNote: (note: string) => void;
  onOutcome: (outcomeId: string) => void;
  /** The names an effect line reads: the lead's owner, the visit's doctor, the first name. */
  words: { owner: string; doctor: string; first: string };
}) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const labelId = useId();
  const row = detail.task;
  if (row.status === 'done') return null;
  const outcomes = TASK_RULES[row.rule].outcomes;
  const copy = TASK_RULE_KEYS.rules[row.rule].outcomes as Readonly<
    Record<string, { label: string; effect: string }>
  >;
  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <SectionLabel id={labelId}>{t(K.sections.close)}</SectionLabel>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
        {outcomes.map((outcome, index) => {
          const keys = copy[outcome.id];
          const first = index === 0;
          return (
            <button
              key={outcome.id}
              type="button"
              disabled={disabled}
              data-testid={IDS.outcome(outcome.id)}
              data-slot="button"
              onClick={() => onOutcome(outcome.id)}
              className={cn(
                'flex min-h-14 flex-col items-start gap-0.75 rounded-lg border px-3 py-2.25 text-start transition-shadow duration-150 hover:shadow-(--elevation-menu) disabled:opacity-60',
                first
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground',
              )}
            >
              <span className="text-body font-semibold">
                {keys ? tRules(keys.label) : outcome.id}
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
        })}
      </div>
      <Textarea
        value={note}
        onChange={(event) => onNote(event.currentTarget.value.slice(0, OUTCOME_NOTE_MAX))}
        maxLength={OUTCOME_NOTE_MAX}
        rows={2}
        aria-label={t(K.outcomeNote.label)}
        placeholder={t(K.outcomeNote.placeholder)}
        data-testid={IDS.note}
        className="text-body min-h-0 resize-y px-2.5 py-2 leading-[1.4]"
      />
    </section>
  );
}

/** The task column's body, sections 1–6 (`tasks.md` › Task drawer › Body). */
export function TaskDrawerBody({
  detail,
  now,
  busy,
  note,
  onNote,
  onOutcome,
  onHandOver,
  onOpenTarget,
  contactActions,
}: {
  detail: TaskDetail;
  now: Date;
  busy: boolean;
  note: string;
  onNote: (note: string) => void;
  onOutcome: (outcomeId: string) => void;
  onHandOver: () => void;
  onOpenTarget: (target: TaskDrawerTarget) => void;
  contactActions?: ContactCardActions;
}) {
  const named = (id: string | null | undefined) => {
    const staff = id ? detail.staff.find((member) => member.id === id) : undefined;
    return staff ? shortPersonName(personFullName(staff)) : '';
  };
  const lead = detail.source?.kind === 'lead' ? detail.source.lead : detail.thread;
  const visit = detail.source?.kind === 'appointment' ? detail.source.appointment : null;
  const words = {
    owner: named(lead?.ownerId),
    doctor: named(visit?.doctorId),
    first: detail.task.person.firstName,
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto p-(--drawer-body-pad)">
      <WhoRow
        detail={detail}
        contactActions={contactActions}
        onOpenTarget={onOpenTarget}
      />
      <WhatSection detail={detail} />
      <ContextTiles detail={detail} now={now} />
      <HowSection detail={detail} />
      <AutomationCard detail={detail} disabled={busy} onHandOver={onHandOver} />
      <OutcomesSection
        detail={detail}
        disabled={busy}
        note={note}
        onNote={onNote}
        onOutcome={onOutcome}
        words={words}
      />
    </div>
  );
}
