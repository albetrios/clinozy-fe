import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { LeadStatus, Tone } from '@/shared/api/app/app-schema.ts';
import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { LEAD_STATUS_TONES, TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu.tsx';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { ChevronDown } from '@/shared/icons/index.ts';

import { LEADS_KEYS, LEADS_NS, LEADS_TEST_IDS } from '../../leads.constants.ts';
import type { LeadBookedVisit } from '../LeadFormFields/index.ts';
import { nextTryAt, winBackUntil } from './lead-follow-up.ts';
import { LeadFollowUpPicker } from './LeadFollowUpPicker.tsx';

const K = LEADS_KEYS.drawer.nextStep;
const IDS = LEADS_TEST_IDS;

/** A move from the card or the track: the status, and the follow-up time it carries. */
export interface LeadMove {
  status: LeadStatus;
  followUpAt?: string | null;
}

/** What the composer is asked to open — the person's WhatsApp, or a call to log. */
export type LeadComposeMode = 'whatsapp' | 'call';

/** Props of {@link LeadNextStep}. */
export interface LeadNextStepProps {
  lead: LeadRecord;
  /** The booking still to happen: null for none, undefined while it loads (clinozy-be L11). */
  visit?: LeadBookedVisit | null;
  /** May move the lead (`lead:update`) — without it the card only reads. */
  canEdit: boolean;
  /** Book appointment — the booking form on the lead's person; absent for a member who does not book. */
  onBook?: () => void;
  onMove: (move: LeadMove) => void;
  /** The status a time is being asked for (the When chip, the track's Follow-up, Reopen), or null. */
  asking: LeadStatus | null;
  onAsk: (status: LeadStatus | null) => void;
  /** Opens the chat's composer — absent for a member who may not write to the person. */
  onCompose?: (mode: LeadComposeMode) => void;
  /** Opens the patient file a check-in made — absent without one. */
  onOpenPatient?: () => void;
}

/** The card's tint in each lead status's tone, as literals (`bg-tone-${tone}` is never generated). */
const SURFACES: Readonly<Partial<Record<Tone, string>>> = {
  sky: 'bg-tone-sky/40',
  lav: 'bg-tone-lav/40',
  butter: 'bg-tone-butter/40',
  peach: 'bg-tone-peach/40',
  sage: 'bg-tone-sage/40',
  stone: 'bg-tone-stone/70',
  blush: 'bg-tone-blush/40',
};

/** The four parts' contents for one status. */
interface NextStepParts {
  since: string | null;
  next: ReactNode;
  when: ReactNode;
  outcome: ReactNode;
}

/** A plain line in a part — a time, or a note on what happens next. */
function Quiet({ children }: { children: ReactNode }) {
  return <span className="text-caption text-muted-foreground">{children}</span>;
}

/** No answer · Not interested · More (Invalid, Lost) — each moves the lead at once. */
function LeadOutcomes({
  lead,
  noAnswer,
  note,
  canEdit,
  onMove,
}: {
  lead: LeadRecord;
  /** "No answer" or "No answer again" — none before the person was contacted, or once booked. */
  noAnswer: 'first' | 'again' | null;
  note?: string;
  canEdit: boolean;
  onMove: (move: LeadMove) => void;
}) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const status = (value: LeadStatus) => tApp(APP_KEYS.leads.statuses[value]);
  if (!canEdit) return note ? <Quiet>{note}</Quiet> : <Quiet>—</Quiet>;
  return (
    <>
      {noAnswer ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          data-testid={`${IDS.drawerOutcome}-no_response`}
          onClick={() =>
            onMove({ status: 'no_response', followUpAt: nextTryAt(lead.followUpAt) })
          }
        >
          {t(noAnswer === 'first' ? K.actions.noAnswer : K.actions.noAnswerAgain)}
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        data-testid={`${IDS.drawerOutcome}-not_interested`}
        onClick={() => onMove({ status: 'not_interested' })}
      >
        {status('not_interested')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-testid={`${IDS.drawerNextStep}-more`}
          >
            {t(K.actions.more)}
            <ChevronDown aria-hidden="true" className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(['invalid', 'lost'] as const).map((value) => (
            <DropdownMenuItem
              key={value}
              data-testid={`${IDS.drawerOutcome}-${value}`}
              onSelect={() => onMove({ status: value })}
            >
              {status(value)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {note ? <Quiet>{note}</Quiet> : null}
    </>
  );
}

/** The follow-up time as a chip that opens the picker — or the line it reads without Edit. */
function FollowUpWhen({
  lead,
  label,
  canEdit,
  asking,
  onAsk,
  onMove,
}: Pick<LeadNextStepProps, 'lead' | 'canEdit' | 'asking' | 'onAsk' | 'onMove'> & {
  label: string;
}) {
  if (!canEdit) return <Quiet>{label}</Quiet>;
  return (
    <LeadFollowUpPicker
      open={asking !== null}
      onOpenChange={(open) => onAsk(open ? lead.status : null)}
      value={lead.followUpAt}
      onSet={(followUpAt) => onMove({ status: asking ?? lead.status, followUpAt })}
    >
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="bg-tone-butter text-tone-butter-foreground hover:bg-tone-butter/80"
        data-testid={`${IDS.drawerNextStep}-when`}
      >
        {label}
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </Button>
    </LeadFollowUpPicker>
  );
}

/** New: say hello — the chat's WhatsApp or a call to log; no "No answer" before a first try. */
function newParts(props: LeadNextStepProps, words: Words): NextStepParts {
  const { lead, onCompose } = props;
  return {
    since: words.t(K.since.created, { when: words.moment(lead.createdAt) }),
    next: onCompose ? (
      <>
        <Button
          type="button"
          size="sm"
          data-testid={`${IDS.drawerNextStep}-whatsapp`}
          onClick={() => onCompose('whatsapp')}
        >
          {words.t(K.actions.whatsapp)}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          data-testid={`${IDS.drawerNextStep}-call`}
          onClick={() => onCompose('call')}
        >
          {words.t(K.actions.call)}
        </Button>
      </>
    ) : null,
    when: (
      // The track's Contacted or Follow-up asks for a time: the picker sits on this line.
      <LeadFollowUpPicker
        asAnchor
        open={props.canEdit && props.asking !== null}
        onOpenChange={(open) => props.onAsk(open ? props.asking : null)}
        value={null}
        onSet={(followUpAt) =>
          props.onMove({ status: props.asking ?? 'contacted', followUpAt })
        }
      >
        <span className="text-caption text-muted-foreground">
          {lead.isAwaitingReply && lead.lastActivityAt
            ? words.t(K.when.replyNow, { when: words.moment(lead.lastActivityAt) })
            : words.t(K.when.notContacted)}
        </span>
      </LeadFollowUpPicker>
    ),
    outcome: (
      <LeadOutcomes
        lead={lead}
        noAnswer={null}
        note={words.t(K.notes.contactFirst)}
        canEdit={props.canEdit}
        onMove={props.onMove}
      />
    ),
  };
}

/** Book appointment — the booking form, locked to the lead's person. */
function BookButton({ onBook, words }: { onBook?: () => void; words: Words }) {
  if (!onBook) return null;
  return (
    <Button
      type="button"
      size="sm"
      data-testid={`${IDS.drawerNextStep}-book`}
      onClick={onBook}
    >
      {words.t(K.actions.book)}
    </Button>
  );
}

/** The When chip's words: the follow-up time ("Next try …" after No answer), or "Set a time". */
function followUpLabel(lead: LeadRecord, words: Words): string {
  if (!lead.followUpAt) return words.t(K.when.setTime);
  const at = words.moment(lead.followUpAt);
  return lead.status === 'no_response' ? words.t(K.when.nextTry, { when: at }) : at;
}

/** Since when: No response's "No answer …", Contacted's "Since …"; Follow-up shows its time instead. */
function followSince(lead: LeadRecord, words: Words): string | null {
  const when = words.moment(lead.updatedAt);
  if (lead.status === 'no_response') return words.t(K.since.noAnswer, { when });
  if (lead.status === 'contacted') return words.t(K.since.since, { when });
  return null;
}

/** Contacted, Follow-up and No response: book, set when to try next, or say how it went. */
function followParts(props: LeadNextStepProps, words: Words): NextStepParts {
  const { lead } = props;
  const noResponse = lead.status === 'no_response';
  const label = followUpLabel(lead, words);
  return {
    since: followSince(lead, words),
    next: (
      <>
        <BookButton onBook={props.onBook} words={words} />
        {noResponse && props.onCompose ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            data-testid={`${IDS.drawerNextStep}-whatsapp`}
            onClick={() => props.onCompose?.('whatsapp')}
          >
            {words.t(K.actions.whatsapp)}
          </Button>
        ) : null}
      </>
    ),
    when: <FollowUpWhen {...props} label={label} />,
    outcome: (
      <LeadOutcomes
        lead={lead}
        noAnswer={noResponse ? 'again' : 'first'}
        canEdit={props.canEdit}
        onMove={props.onMove}
      />
    ),
  };
}

/** Appointment scheduled: the booking still to happen, moved or cancelled from here. */
function bookedParts(props: LeadNextStepProps, words: Words): NextStepParts {
  const { visit } = props;
  return {
    since: null,
    next: visit ? (
      <>
        {visit.onReschedule ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            data-testid={`${IDS.drawerBooking}-reschedule`}
            onClick={visit.onReschedule}
          >
            {words.t(LEADS_KEYS.drawer.booking.reschedule)}
          </Button>
        ) : null}
        {visit.onCancel ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-testid={`${IDS.drawerBooking}-cancel`}
            onClick={visit.onCancel}
          >
            {words.t(LEADS_KEYS.drawer.booking.cancel)}
          </Button>
        ) : null}
      </>
    ) : null,
    when: (
      <span data-testid={IDS.drawerBooking} className="text-body font-medium">
        {visit
          ? words.t(K.when.booking, { when: visit.when, what: visit.what })
          : words.t(K.when.bookingPending)}
      </span>
    ),
    outcome: (
      <LeadOutcomes
        lead={props.lead}
        noAnswer={null}
        note={words.t(K.notes.checkIn)}
        canEdit={props.canEdit}
        onMove={props.onMove}
      />
    ),
  };
}

/** Clinic visited: final — the patient file the check-in opened. */
function visitedParts(props: LeadNextStepProps, words: Words): NextStepParts {
  const { lead, onOpenPatient } = props;
  return {
    since: null,
    next: onOpenPatient ? (
      <Button
        type="button"
        size="sm"
        data-testid={`${IDS.drawerNextStep}-open-file`}
        onClick={onOpenPatient}
      >
        {words.t(K.actions.openFile)}
      </Button>
    ) : null,
    when: lead.closedAt ? (
      <Quiet>{words.t(K.when.visited, { when: words.moment(lead.closedAt) })}</Quiet>
    ) : null,
    outcome: <Quiet>{words.t(K.notes.final)}</Quiet>,
  };
}

/** Not interested, Invalid, Lost: when it closed, Reopen, and whether a check-in brings it back. */
function closedParts(props: LeadNextStepProps, words: Words): NextStepParts {
  const { lead, canEdit, asking, onAsk, onMove } = props;
  const note =
    lead.status === 'invalid' || !lead.closedAt
      ? words.t(K.notes.never)
      : words.t(K.notes.winBack, { date: words.date(winBackUntil(lead.closedAt)) });
  return {
    since: null,
    next: canEdit ? (
      <LeadFollowUpPicker
        open={asking !== null}
        onOpenChange={(open) => onAsk(open ? (asking ?? 'follow_up') : null)}
        value={null}
        onSet={(followUpAt) => onMove({ status: asking ?? 'follow_up', followUpAt })}
      >
        <Button
          type="button"
          size="sm"
          variant="secondary"
          data-testid={`${IDS.drawerNextStep}-reopen`}
        >
          {words.t(K.actions.reopen)}
        </Button>
      </LeadFollowUpPicker>
    ) : null,
    when: lead.closedAt ? (
      <Quiet>{words.t(K.when.closed, { when: words.moment(lead.closedAt) })}</Quiet>
    ) : null,
    outcome: <Quiet>{note}</Quiet>,
  };
}

/** The words and clock the parts are written with. */
interface Words {
  t: (key: string, values?: Record<string, string>) => string;
  moment: (instant: string) => string;
  date: (date: string) => string;
}

/** Each status's parts. */
function partsOf(props: LeadNextStepProps, words: Words): NextStepParts {
  switch (props.lead.status) {
    case 'new':
      return newParts(props, words);
    case 'contacted':
    case 'follow_up':
    case 'no_response':
      return followParts(props, words);
    case 'appointment_scheduled':
      return bookedParts(props, words);
    case 'clinic_visited':
      return visitedParts(props, words);
    default:
      return closedParts(props, words);
  }
}

/** One labelled part: Next, When or Outcome. */
function Part({
  label,
  ink,
  children,
}: {
  label: string;
  ink: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className={cn('text-tiny font-semibold tracking-[0.06em] uppercase', ink)}>
        {label}
      </dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
        {children ?? <Quiet>—</Quiet>}
      </dd>
    </>
  );
}

/**
 * The Next step card (D25; the approved design): under the Progress track, in the lead status's
 * tone and without borders — the status by its own name with a headline, then the same three
 * parts for every status: Next (the one main action), When (the time that matters — the follow-up
 * time opens the picker) and Outcome (what happened, named as the status it moves the lead to,
 * saved at once). No answer appears once the person was contacted.
 */
export function LeadNextStep(props: LeadNextStepProps) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const clock = useAppClock();
  const { lead } = props;
  const tone = LEAD_STATUS_TONES[lead.status];
  const words: Words = {
    t: (key, values) => t(key, values),
    moment: (instant) => clock.moment(instant),
    date: (date) => clock.date(date),
  };
  const parts = partsOf(props, words);
  const ink = TONE_CLASSES[tone].ink;
  return (
    <section
      aria-label={t(K.aria)}
      data-testid={IDS.drawerNextStep}
      className={cn('flex flex-col gap-3 rounded-xl px-3.5 py-3', SURFACES[tone])}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <TonePill tone={tone} size="sm">
          {tApp(APP_KEYS.leads.statuses[lead.status])}
        </TonePill>
        <h4 className="text-body min-w-0 flex-1 font-semibold">
          {t(K.headline[lead.status], { name: lead.person?.firstName ?? lead.name })}
        </h4>
        {parts.since ? (
          <span className="text-caption text-muted-foreground">{parts.since}</span>
        ) : null}
      </div>
      <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5">
        <Part label={t(K.labels.next)} ink={ink}>
          {parts.next}
        </Part>
        <Part label={t(K.labels.when)} ink={ink}>
          {parts.when}
        </Part>
        <Part label={t(K.labels.outcome)} ink={ink}>
          {parts.outcome}
        </Part>
      </dl>
    </section>
  );
}
