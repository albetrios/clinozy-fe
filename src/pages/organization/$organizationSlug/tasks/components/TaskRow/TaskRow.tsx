import type { KeyboardEvent, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import { isTaskOverdue } from '@/shared/api/app/task-views.ts';
import {
  TASK_TYPES,
  type TaskLinkKind,
  type TaskRow as TaskRowRecord,
} from '@/shared/api/app/tasks-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { TASK_RULE_ICONS } from '@/shared/app/task-rule-icons.ts';
import {
  PersonAvatar,
  personFirstName,
  personInitials,
  shortPersonName,
} from '@/shared/components/Cells/index.ts';
import {
  ContactCard,
  type ContactCardActions,
  TeamCard,
} from '@/shared/components/PersonCard/index.ts';

import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';
import { taskContactCard, taskPersonKind } from '../../tasks.display.ts';

/**
 * The row (`tasks.md:24–38`; H:2144–2149): one grid, 56px, 10px over a 3px
 * inline-start edge, a muted hairline, `canvas` on hover. From `md` the five
 * cells sit in `32px · 2fr · 1fr · ≤150px · 110px` (gap 12px, centred); on a
 * phone they re-grid into two lines — the tile spans both, title over contact
 * in the middle, due over owner at the inline end (H:130–135).
 */
const ROW =
  'grid cursor-pointer grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-2 border-s-3 border-b border-b-muted py-2.5 ps-(--table-pad-start) pe-(--table-pad-x) transition-colors duration-120 outline-none hover:bg-canvas md:grid-cols-[2rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,150px)_110px] md:items-center md:gap-3';

/** Where each cell sits on a phone (row 1: tile · title · due; row 2: · contact · owner). */
const PHONE_CELL = {
  tile: 'max-md:col-start-1 max-md:row-span-2 max-md:row-start-1',
  main: 'max-md:col-start-2 max-md:row-start-1',
  contact: 'max-md:col-start-2 max-md:row-start-2',
  owner: 'max-md:col-start-3 max-md:row-start-2 max-md:justify-self-end',
  due: 'max-md:col-start-3 max-md:row-start-1 max-md:self-center',
} as const;

/**
 * The 24px butter pill of a task no one owns — its role queue, or "Anyone" (its `rounded-full`
 * sits on the element, beside the `data-slot="pill"` the Sharp shape squares).
 */
const QUEUE_PILL = cn(
  'inline-flex h-6 max-w-full min-w-0 items-center px-2.5 text-xs font-medium whitespace-nowrap',
  TONE_CLASSES.butter.surface,
);

/** What the source chip names: the record the task points at, else its person. */
type TaskChipKind = TaskLinkKind | 'patient' | 'lead' | 'contact';

/**
 * The source chip's ink by kind: lead lav · patient sage · treatment mint ·
 * appointment sky; the prototype's other sources fall back to sky (H:4275).
 */
const SOURCE_TONES: Readonly<Record<TaskChipKind, Tone>> = {
  lead: 'lav',
  appointment: 'sky',
  treatment: 'mint',
  patient: 'sage',
  contact: 'sage',
  checkIn: 'sky',
  review: 'sky',
  invoice: 'sky',
  pendingCredit: 'sky',
  medicalRep: 'sky',
};

/** The team a row names its owner and past owner from (`useTaskAssignees`, `useTeamDirectory`). */
export interface TaskRowTeam {
  /** Every active member by membership id. */
  byId: ReadonlyMap<string, DirectoryMember>;
  /** The signed-in member's membership id — "(you)" on their pill. */
  myMembershipId: string | null | undefined;
  /** When the team was read — the team card's "Updated HH:MM". */
  updatedAt: string | null;
}

/** Props for {@link TaskRow}. */
export interface TaskRowProps {
  row: TaskRowRecord;
  /** The due label, worded by the room (`useTaskDueLabel`). */
  due: string;
  /** The clock the row reads "overdue" against. */
  now: Date;
  /** The rule is handed to Clinozy: the "Clinozy can do this" pill (not on Done). */
  handled: boolean;
  team: TaskRowTeam;
  /** Open the task (Enter, Space or a click on the row). */
  onOpen: (row: TaskRowRecord) => void;
  /** The contact card's actions for this row's person. */
  contactActions?: ContactCardActions;
}

/**
 * Who had the task before its last move ("· was <first>"): a member by first
 * name, else the role queue it came from; none before a move or when the
 * member has left the team.
 */
function usePreviousOwner(row: TaskRowRecord, team: TaskRowTeam): string | null {
  const { t: tApp } = useTranslation(APP_NS);
  const [last] = row.ownerChanges;
  if (!last) return null;
  if (last.fromId) {
    const member = team.byId.get(last.fromId);
    return member ? personFirstName(member.name) : null;
  }
  return last.fromRole ? tApp(APP_KEYS.roles[last.fromRole]) : null;
}

/** A pill's words: the name alone, or "<name> · was <first>" with both names isolated. */
function OwnerWords({ name, previous }: { name: string; previous: string | null }) {
  const { t } = useTranslation(TASKS_NS);
  // A name alone reads in its own direction; the sentence keeps the page's.
  return (
    <span dir={previous ? undefined : 'auto'} className="min-w-0 truncate">
      {previous ? t(TASKS_KEYS.row.was, isolateValues({ name, first: previous })) : name}
    </span>
  );
}

/**
 * The owner cell (`tasks.md:38`): the member's pill — avatar and short name,
 * "(you)" for the signed-in member, "· was <first>" after a move — under their
 * team card ("Assigned"); a task waiting in a role's queue reads the role
 * ("Front desk", research-tasks Q3) and one with neither "Anyone", both in the
 * butter pill. A member no longer on the team (or still loading) leaves it
 * empty.
 */
function OwnerCell({ row, team }: { row: TaskRowRecord; team: TaskRowTeam }) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const previous = usePreviousOwner(row, team);
  if (!row.ownerId) {
    const queue = row.ownerRole
      ? tApp(APP_KEYS.roles[row.ownerRole])
      : t(TASKS_KEYS.row.anyone);
    return (
      <span
        data-slot="pill"
        data-owner="queue"
        className={cn('rounded-full', QUEUE_PILL)}
      >
        <OwnerWords name={queue} previous={previous} />
      </span>
    );
  }
  const owner = team.byId.get(row.ownerId);
  if (!owner) return null;
  const short = shortPersonName(owner.name);
  const name =
    owner.id === team.myMembershipId
      ? t(TASKS_KEYS.assignee.you, { name: short })
      : short;
  return (
    <TeamCard
      kind="assigned"
      data={{
        name: owner.name,
        initials: owner.initials,
        tone: owner.tone,
        // The memberships name a member's roles by id only (research-tasks T11).
        role: '',
        updatedAt: team.updatedAt,
      }}
      triggerVariant="bare"
      triggerClassName="max-w-full"
    >
      <span
        data-slot="pill"
        data-owner="member"
        className="border-border bg-card text-detail inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full border ps-0.75 pe-2.5 font-medium whitespace-nowrap"
      >
        <PersonAvatar size="chip" initials={owner.initials} tone={owner.tone} />
        <OwnerWords name={name} previous={previous} />
      </span>
    </TeamCard>
  );
}

/**
 * The contact cell (`tasks.md:38`): the person — the 28px avatar (sage with
 * the "P" badge for a patient, lav otherwise) and their name — under their
 * contact card, over the source chip in its kind's ink: the record the task
 * points at ("Lead", "Appt", "Treatment" — the API sends no record numbers,
 * research-tasks T10), else what the person is. A task about nobody shows its
 * chip alone.
 */
function ContactCell({
  row,
  contactActions,
}: {
  row: TaskRowRecord;
  contactActions?: ContactCardActions;
}) {
  const { t } = useTranslation(TASKS_NS);
  const { person, link } = row;
  const kind: TaskChipKind | null =
    link?.kind ?? (person ? taskPersonKind(person) : null);
  const chip = kind ? (
    <span
      data-source={kind}
      className={cn(
        'text-caption whitespace-nowrap',
        TONE_CLASSES[SOURCE_TONES[kind]].ink,
      )}
    >
      {t(TASKS_KEYS.sources[kind])}
    </span>
  ) : null;
  const card = taskContactCard(row);
  if (!(person && card)) return chip;
  const patient = person.patientId !== null;
  return (
    <ContactCard
      data={card}
      {...contactActions}
      triggerClassName="max-w-full w-max gap-2"
    >
      <PersonAvatar
        size="list"
        initials={personInitials(person.name)}
        tone={patient ? 'sage' : 'lav'}
        patient={patient}
      />
      <span className="flex min-w-0 flex-col leading-[1.3]">
        <span className="text-body truncate leading-[1.3] font-medium">
          {person.name}
        </span>
        {chip}
      </span>
    </ContactCard>
  );
}

/**
 * The task cell: the title (with "Clinozy can do this" while the rule is
 * handed over), the why line and, on a Done row a member closed, "✓ <result>"
 * — a task the server closed reads "Done by Clinozy" in its due cell, and its
 * result words are that same phrase, in English (TASKS-M4).
 */
function TaskCell({ row, handled }: { row: TaskRowRecord; handled: boolean }) {
  const { t } = useTranslation(TASKS_NS);
  const done = row.status === 'done';
  const result = done && !row.isResolvedAutomatically ? row.resultText : null;
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-field min-w-0 truncate leading-[1.3] font-semibold">
          {row.title}
        </span>
        {handled && !done ? (
          <span
            data-slot="pill"
            className="bg-primary text-primary-foreground text-tiny inline-flex h-5 flex-none items-center rounded-full px-1.75 font-medium whitespace-nowrap"
          >
            {t(TASKS_KEYS.row.automation)}
          </span>
        ) : null}
      </span>
      {row.why ? (
        <span className="text-muted-foreground-strong truncate text-xs leading-[1.3]">
          {row.why}
        </span>
      ) : null}
      {result ? (
        <span className="text-success-strong truncate text-xs leading-[1.3]">
          {t(TASKS_KEYS.row.result, { result })}
        </span>
      ) : null}
    </>
  );
}

/** The row's edge and due ink: the type's tone, red when overdue, the hairline on Done. */
function rowInks(row: TaskRowRecord, overdue: boolean): { edge: string; due: string } {
  if (row.status === 'done') {
    return { edge: 'border-s-border', due: 'text-muted-foreground font-medium' };
  }
  if (overdue) {
    return { edge: 'border-s-now-indicator', due: 'text-destructive font-semibold' };
  }
  return {
    // The type's dot colour, as the design's task rows (H:4274).
    edge: TONE_CLASSES[TASK_TYPES[row.type].tone].edgeDot,
    due:
      row.status === 'open'
        ? 'text-foreground-soft font-medium'
        : 'text-muted-foreground font-medium',
  };
}

/**
 * One task row (KICKOFF §6.10 Rows): the type's 32px tile · the task · the
 * person under their contact card with the source chip · the owner · the due
 * label (red and bold when overdue). A row is focusable and opens with Enter
 * or Space.
 */
export function TaskRow({
  row,
  due,
  now,
  handled,
  team,
  onOpen,
  contactActions,
}: TaskRowProps) {
  const Icon = TASK_RULE_ICONS[row.type];
  const overdue = isTaskOverdue(row, now);
  const inks = rowInks(row, overdue);

  const open = () => onOpen(row);
  const openOnKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    open();
  };
  const openOnClick = (event: MouseEvent<HTMLDivElement>) => {
    // A press inside a portaled card (rendered under the row in React's tree) is not the row's.
    if (event.target instanceof Node && event.currentTarget.contains(event.target))
      open();
  };

  return (
    <div // NOSONAR(S6819): grid ARIA table, see the note in TaskList
      role="row"
      tabIndex={0}
      // The focus personality's ring reaches a slotted element; the preset fills it.
      data-slot="task-row"
      data-testid={TASKS_TEST_IDS.row}
      data-task-id={row.id}
      data-type={row.type}
      data-overdue={overdue || undefined}
      onClick={openOnClick}
      onKeyDown={openOnKey}
      className={cn(ROW, inks.edge)}
    >
      <span // NOSONAR(S6819): grid ARIA table, see the note in TaskList
        role="cell"
        className={cn(
          'flex size-8 items-center justify-center rounded-lg',
          TONE_CLASSES[TASK_TYPES[row.type].tone].surface,
          PHONE_CELL.tile,
        )}
      >
        <Icon aria-hidden="true" className="size-3.75" />
      </span>
      <span // NOSONAR(S6819): grid ARIA table, see the note in TaskList
        role="cell"
        className={cn('flex min-w-0 flex-col gap-0.5 leading-[1.3]', PHONE_CELL.main)}
      >
        <TaskCell row={row} handled={handled} />
      </span>
      <span // NOSONAR(S6819): grid ARIA table, see the note in TaskList
        role="cell"
        className={cn('flex min-w-0 items-center', PHONE_CELL.contact)}
      >
        <ContactCell row={row} contactActions={contactActions} />
      </span>
      <span // NOSONAR(S6819): grid ARIA table, see the note in TaskList
        role="cell"
        className={cn('flex min-w-0', PHONE_CELL.owner)}
      >
        <OwnerCell row={row} team={team} />
      </span>
      <span // NOSONAR(S6819): grid ARIA table, see the note in TaskList
        role="cell"
        className={cn(
          'text-detail text-end leading-[1.2] whitespace-nowrap tabular-nums',
          inks.due,
          PHONE_CELL.due,
        )}
      >
        {due}
      </span>
    </div>
  );
}
