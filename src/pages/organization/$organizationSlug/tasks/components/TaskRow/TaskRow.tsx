import type { KeyboardEvent, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { isTaskOverdue } from '@/shared/api/clinic/task-views.ts';
import {
  TASK_RULES,
  type TaskRow as TaskRowRecord,
  type TaskSourceRef,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { TASK_RULE_ICONS } from '@/shared/clinic/task-rule-icons.ts';
import {
  PersonAvatar,
  personInitials,
  shortPersonName,
} from '@/shared/components/Cells/index.ts';
import {
  ContactCard,
  type ContactCardActions,
  type ContactCardData,
  TeamCard,
  type TeamCardData,
} from '@/shared/components/PersonCard/index.ts';

import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';
import { staffName } from '../../tasks.display.ts';

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

/** The source chip's ink by kind: lead lav · patient sage · treatment mint · appointment sky (H:4275). */
const SOURCE_TONES: Readonly<Record<TaskSourceRef['kind'], Tone>> = {
  lead: 'lav',
  appointment: 'sky',
  treatment: 'mint',
  patient: 'sage',
  contact: 'sage',
  // The prototype's other sources fall back to sky (H:4275).
  invoice: 'sky',
};

/** A source's display id ("#2363"), or nothing where the contract has no `seq`. */
function sourceId(source: TaskSourceRef): string {
  if (source.seq === null) return '';
  return source.kind === 'invoice'
    ? displayId.invoiceNumber(source.seq)
    : displayId.lead(source.seq);
}

/** The row's person as their contact card reads them (D32 — a patient, a lead or a contact). */
function contactCardOf(row: TaskRowRecord): ContactCardData {
  const { person } = row;
  let id: string | null = null;
  if (person.seq !== null) {
    id =
      person.kind === 'patient'
        ? displayId.patient(person.seq)
        : displayId.lead(person.seq);
  }
  return {
    kind: person.kind,
    name: person.name,
    displayId: id,
    reach: person.phone ? [{ channel: 'whatsapp', phone: person.phone }] : [],
  };
}

/** Props for {@link TaskRow}. */
export interface TaskRowProps {
  row: TaskRowRecord;
  /** The due label, worded by the room (`useTaskDueLabel`). */
  due: string;
  /** The clock the row reads "overdue" against. */
  now: Date;
  /** The rule is handed to the product: the "Clinozy can do this" pill (not on Done). */
  handled: boolean;
  /** Open the task (Enter, Space or a click on the row). */
  onOpen: (row: TaskRowRecord) => void;
  /** The contact card's actions for this row's person. */
  contactActions?: ContactCardActions;
}

/** The owner pill under its team card, or the butter "Anyone" pill. */
function OwnerCell({ row }: { row: TaskRowRecord }) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const { owner } = row;
  if (!owner) {
    return (
      <span
        data-slot="pill"
        className={cn(
          'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
          TONE_CLASSES.butter.surface,
        )}
      >
        {t(TASKS_KEYS.row.anyone)}
      </span>
    );
  }
  const name = shortPersonName(staffName(owner));
  const previous = row.previousOwners.at(-1);
  const card: TeamCardData = {
    name: staffName(owner),
    initials: owner.initials,
    tone: owner.tone,
    role: owner.roles.map((role) => tClinic(CLINIC_KEYS.roles[role])).join(' · '),
    online: owner.presence === 'online',
    phone: owner.phone,
    email: owner.email,
    updatedAt: new Date().toISOString(),
  };
  return (
    <TeamCard
      kind="assigned"
      load={() => Promise.resolve(card)}
      triggerVariant="bare"
      triggerClassName="max-w-full"
    >
      <span
        data-slot="pill"
        className="border-border bg-card inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full border ps-0.75 pe-2.5 whitespace-nowrap"
      >
        <PersonAvatar size="chip" initials={owner.initials} tone={owner.tone} />
        <span className="text-detail min-w-0 truncate font-medium">
          {previous ? t(TASKS_KEYS.row.was, { name, first: previous.firstName }) : name}
        </span>
      </span>
    </TeamCard>
  );
}

/**
 * One task row (KICKOFF §6.10 Rows): the rule's 32px tile · the title (with
 * "Clinozy can do this" when the rule is handed over), the why line and, on
 * Done, "✓ <result>" · the person under their contact card, with the source
 * chip in its kind's ink · the owner under their team card ("Assigned"), or
 * "Anyone" · the due label (red and bold when overdue). The edge takes the
 * rule's tone — red when overdue, the hairline on Done. A row is focusable and
 * opens with Enter or Space.
 */
export function TaskRow({
  row,
  due,
  now,
  handled,
  onOpen,
  contactActions,
}: TaskRowProps) {
  const { t } = useTranslation(TASKS_NS);
  const rule = TASK_RULES[row.rule];
  const Icon = TASK_RULE_ICONS[row.rule];
  const done = row.status === 'done';
  const overdue = isTaskOverdue(row, now);
  let edge: string = TONE_CLASSES[rule.tone].edge;
  if (overdue) edge = 'border-s-now-indicator';
  if (done) edge = 'border-s-border';
  let dueInk = 'text-foreground-soft font-medium';
  if (overdue) dueInk = 'text-destructive font-semibold';
  else if (row.status !== 'open') dueInk = 'text-muted-foreground font-medium';
  const { person, source } = row;
  const sourceLabel = t(TASKS_KEYS.sources[source.kind], { id: sourceId(source) }).trim();

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
    <div
      role="row"
      tabIndex={0}
      // The focus personality's ring reaches a slotted element; the preset fills it.
      data-slot="task-row"
      data-testid={TASKS_TEST_IDS.row}
      data-task-id={row.id}
      data-overdue={overdue || undefined}
      onClick={openOnClick}
      onKeyDown={openOnKey}
      className={cn(ROW, edge)}
    >
      <span
        role="cell"
        className={cn(
          'flex size-8 items-center justify-center rounded-lg',
          TONE_CLASSES[rule.tone].surface,
          PHONE_CELL.tile,
        )}
      >
        <Icon aria-hidden="true" className="size-3.75" />
      </span>
      <span
        role="cell"
        className={cn('flex min-w-0 flex-col gap-0.5 leading-[1.3]', PHONE_CELL.main)}
      >
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
        {done && row.result ? (
          <span className="text-success-strong truncate text-xs leading-[1.3]">
            {t(TASKS_KEYS.row.result, { result: row.result })}
          </span>
        ) : null}
      </span>
      <span role="cell" className={cn('flex min-w-0 items-center', PHONE_CELL.contact)}>
        <ContactCard
          data={contactCardOf(row)}
          {...contactActions}
          triggerClassName="max-w-full w-max gap-2"
        >
          <PersonAvatar
            size="list"
            initials={personInitials(person.name)}
            tone={person.isPatient ? 'sage' : 'lav'}
            patient={person.isPatient}
          />
          <span className="flex min-w-0 flex-col leading-[1.3]">
            <span className="text-body truncate leading-[1.3] font-medium">
              {person.name}
            </span>
            <span
              className={cn(
                'text-caption whitespace-nowrap',
                TONE_CLASSES[SOURCE_TONES[source.kind]].ink,
              )}
            >
              {sourceLabel}
            </span>
          </span>
        </ContactCard>
      </span>
      <span role="cell" className={cn('flex min-w-0', PHONE_CELL.owner)}>
        <OwnerCell row={row} />
      </span>
      <span
        role="cell"
        className={cn(
          'text-detail text-end leading-[1.2] whitespace-nowrap tabular-nums',
          dueInk,
          PHONE_CELL.due,
        )}
      >
        {due}
      </span>
    </div>
  );
}
