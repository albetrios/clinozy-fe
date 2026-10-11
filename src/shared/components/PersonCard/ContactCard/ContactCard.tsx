import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  PersonAvatar,
  personInitials,
  shortPersonName,
} from '@/shared/components/Cells/PersonAvatar/index.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import {
  type ContactCardActions,
  type ContactCardData,
  type ContactTeamMember,
  ICON_ACTION,
  KIND_TINT,
  KIND_TONE,
} from '@/shared/components/PersonCard/ContactCard/contact-card.types.ts';
import { ContactAboutGroup } from '@/shared/components/PersonCard/ContactCard/contact-card-about.tsx';
import { ContactReachGroup } from '@/shared/components/PersonCard/ContactCard/contact-card-reach.tsx';
import {
  PERSON_CARD_KEYS,
  PERSON_CARD_NS,
} from '@/shared/components/PersonCard/person-card.constants.ts';
import { CardGroup, Hint } from '@/shared/components/PersonCard/person-card-parts.tsx';
import { PersonCard } from '@/shared/components/PersonCard/PersonCard.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { PenLine, RefreshCw } from '@/shared/icons/index.ts';

export type {
  ContactAbout,
  ContactCardActions,
  ContactCardData,
  ContactKind,
  ContactReach,
  ContactReviews,
  ContactTeamMember,
} from '@/shared/components/PersonCard/ContactCard/contact-card.types.ts';

const keys = PERSON_CARD_KEYS;

/** The footer's equal grid, by how many actions it holds. */
const FOOTER_COLUMNS = ['grid-cols-1', 'grid-cols-2', 'grid-cols-3'] as const;

/** Wraps an action so it dismisses the card first. */
type RunThenClose = (action: () => void) => () => void;

/**
 * The name: a link to the patient file ("↗") for a patient, else plain text —
 * in its own direction, aligned as the header is.
 */
function ContactName({
  name,
  onOpen,
}: {
  name: string;
  onOpen: (() => void) | undefined;
}) {
  const { t } = useTranslation(PERSON_CARD_NS);
  if (!onOpen) {
    return (
      <span
        dir="auto"
        className="text-title [text-align:match-parent] leading-[1.2] font-semibold tracking-[-0.01em] wrap-anywhere"
      >
        {name}
      </span>
    );
  }
  return (
    <Hint label={t(keys.openPatientFile)}>
      <button
        type="button"
        data-testid="contact-card-open-file"
        onClick={onOpen}
        className="text-title decoration-border-strong inline-flex max-w-full items-center gap-1 self-start text-start leading-[1.2] font-semibold tracking-[-0.01em] underline underline-offset-3 hover:decoration-current"
      >
        <span dir="auto" className="[text-align:match-parent] wrap-anywhere">
          {name}
        </span>
        <span aria-hidden="true" className="text-body text-muted-foreground flex-none">
          ↗
        </span>
      </button>
    </Hint>
  );
}

/** A 28px header icon button with its tooltip. */
function HeaderAction({
  label,
  hint,
  testId,
  onClick,
  children,
}: {
  label: string;
  hint: string;
  testId: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Hint label={hint}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        data-testid={testId}
        className={ICON_ACTION}
        onClick={onClick}
      >
        {children}
      </Button>
    </Hint>
  );
}

/** The tinted header: avatar, name, id and since, pills, Edit / Change contact (H:2729–2734). */
function ContactHeader({
  data,
  actions,
  runThenClose,
}: {
  data: ContactCardData;
  actions: ContactCardActions;
  runThenClose: RunThenClose;
}) {
  const { t } = useTranslation(PERSON_CARD_NS);
  const { formatDate } = useLocaleFormat();
  const tone = KIND_TONE[data.kind];
  const isPatient = data.kind === 'patient';
  // "Since 28 Jun 2026", or "Lead since …" for a lead.
  const sinceKey = data.kind === 'lead' ? keys.leadSince : keys.since;
  const since = data.since
    ? t(sinceKey, {
        date: isolateText(
          formatDate(data.since, { day: 'numeric', month: 'short', year: 'numeric' }),
        ),
      })
    : null;
  const { onOpenPatientFile, onEditContact, onChangeContact } = actions;

  return (
    <div
      className={cn(
        'grid flex-none grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-3 border-b py-3.5 ps-3.5 pe-3',
        KIND_TINT[data.kind],
      )}
    >
      <PersonAvatar
        size="card"
        initials={data.initials ?? personInitials(data.name)}
        tone={tone}
        patient={isPatient}
      />
      <div className="flex min-w-0 flex-col gap-1 pt-0.5">
        <ContactName
          name={data.name}
          onOpen={
            isPatient && onOpenPatientFile ? runThenClose(onOpenPatientFile) : undefined
          }
        />
        {data.displayId || since ? (
          <span className="text-caption text-muted-foreground-strong flex items-baseline gap-2 leading-[1.2] tabular-nums">
            {data.displayId ? (
              <span dir="ltr" className={cn('font-semibold', TONE_CLASSES[tone].ink)}>
                {data.displayId}
              </span>
            ) : null}
            {since ? <span>{since}</span> : null}
          </span>
        ) : null}
        <span className="mt-0.5 flex flex-wrap gap-1">
          <TonePill tone={tone} size="sm">
            {t(keys.kind[data.kind])}
          </TonePill>
          {(data.tags ?? []).slice(0, 2).map((tag) => (
            <TonePill key={tag} tone="lav" size="sm">
              {tag}
            </TonePill>
          ))}
        </span>
      </div>
      <div className="flex gap-0.5">
        {onEditContact ? (
          <HeaderAction
            label={t(keys.editContact)}
            hint={t(keys.editContact)}
            testId="contact-card-edit"
            onClick={runThenClose(onEditContact)}
          >
            <PenLine className="size-3.25" />
          </HeaderAction>
        ) : null}
        {onChangeContact ? (
          <HeaderAction
            label={t(keys.changeContact)}
            hint={t(keys.changeContactHint)}
            testId="contact-card-change"
            onClick={runThenClose(onChangeContact)}
          >
            <RefreshCw className="size-3.25" />
          </HeaderAction>
        ) : null}
      </div>
    </div>
  );
}

/** The "Team" section: 28px chips, with "Open · Claim" when an open lead can be claimed. */
function ContactTeamGroup({
  team,
  onClaim,
}: {
  team: readonly ContactTeamMember[];
  onClaim: (() => void) | undefined;
}) {
  const { t } = useTranslation(PERSON_CARD_NS);
  const claim = onClaim ? (
    <Hint label={t(keys.claimHint)}>
      <button
        type="button"
        data-slot="pill"
        data-testid="contact-card-claim"
        onClick={onClaim}
        className={cn(
          'text-micro ms-auto h-5 rounded-full border px-2 font-semibold',
          TONE_CLASSES.butter.surface,
          TONE_CLASSES.butter.border,
        )}
      >
        {t(keys.claim)}
      </button>
    </Hint>
  ) : null;
  return (
    <CardGroup label={t(keys.team)} className="gap-2 px-3.5 pt-3" aside={claim}>
      <span className="flex flex-wrap gap-1.5">
        {team.map((member) => (
          <span
            key={member.id}
            data-slot="pill"
            title={`${isolateText(member.name)} · ${member.role}`}
            className="border-border bg-card inline-flex h-7 items-center gap-1.5 rounded-full border ps-0.75 pe-2.5 whitespace-nowrap"
          >
            <PersonAvatar
              size="chip"
              initials={member.initials ?? personInitials(member.name)}
              tone={member.tone}
            />
            <span className="flex flex-col leading-[1.1]">
              <span dir="auto" className="[text-align:match-parent] text-xs font-medium">
                {shortPersonName(member.name)}
              </span>
              <span className="text-tiny text-muted-foreground">{member.role}</span>
            </span>
          </span>
        ))}
      </span>
    </CardGroup>
  );
}

/** The footer: an equal grid of 32px outline buttons — "+ Lead", "+ Appointment", "+ Patient". */
function ContactFooter({
  isPatient,
  actions,
  runThenClose,
}: {
  isPatient: boolean;
  actions: ContactCardActions;
  runThenClose: RunThenClose;
}) {
  const { t } = useTranslation(PERSON_CARD_NS);
  const { onNewLead, onNewAppointment, onNewPatient } = actions;
  const buttons = [
    { id: 'lead', label: keys.newLead, hint: keys.newLeadHint, run: onNewLead },
    {
      id: 'appointment',
      label: keys.newAppointment,
      hint: keys.newAppointmentHint,
      run: onNewAppointment,
    },
    {
      id: 'patient',
      label: keys.newPatient,
      hint: keys.newPatientHint,
      run: isPatient ? undefined : onNewPatient,
    },
  ].flatMap((button) => (button.run ? [{ ...button, run: button.run }] : []));
  if (!buttons.length) return null;
  return (
    <div
      className={cn(
        'bg-canvas grid flex-none gap-1.5 border-t px-3.5 pt-2.5 pb-3',
        FOOTER_COLUMNS[buttons.length - 1],
      )}
    >
      {buttons.map((button) => (
        <Hint key={button.id} label={t(button.hint)}>
          <Button
            type="button"
            variant="outline"
            data-testid={`contact-card-new-${button.id}`}
            className="h-8 min-w-0 rounded-lg px-1.5 text-xs"
            onClick={runThenClose(button.run)}
          >
            <span className="truncate">{t(button.label)}</span>
          </Button>
        </Hint>
      ))}
    </div>
  );
}

/** The contact card's content (H:2728–2756; `_patterns.md:209–219`). */
export function ContactCardContent({
  data,
  close,
  ...actions
}: { data: ContactCardData; close: () => void } & ContactCardActions) {
  const runThenClose: RunThenClose = (action) => () => {
    close();
    action();
  };
  return (
    <>
      <ContactHeader data={data} actions={actions} runThenClose={runThenClose} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ContactReachGroup reach={data.reach} />
        {data.team?.length ? (
          <ContactTeamGroup
            team={data.team}
            onClaim={actions.onClaim ? runThenClose(actions.onClaim) : undefined}
          />
        ) : null}
        {data.about ? <ContactAboutGroup about={data.about} /> : null}
      </div>
      <ContactFooter
        isPatient={data.kind === 'patient'}
        actions={actions}
        runThenClose={runThenClose}
      />
    </>
  );
}

/** Props for {@link ContactCard}: the trigger, the data or its loader, and the actions. */
export interface ContactCardProps extends ContactCardActions {
  /** The person's chip, avatar or name — what is hovered or tapped. */
  children: ReactNode;
  /** Ready data, or… */
  data?: ContactCardData;
  /** …fetch first, then show (the schema's `contactCard`). A failed load never opens. */
  load?: (signal: AbortSignal) => Promise<ContactCardData>;
  triggerVariant?: 'chip' | 'bare';
  triggerClassName?: string;
}

/**
 * The contact card for a patient, lead or medical contact (KICKOFF §3.5, §6.0):
 * opens 280ms after hover and closes 220ms after leaving; a tap opens it on a
 * touch screen.
 */
export function ContactCard({
  children,
  data,
  load,
  triggerVariant,
  triggerClassName,
  ...actions
}: ContactCardProps) {
  const { t } = useTranslation(PERSON_CARD_NS);
  return (
    <PersonCard
      data={data}
      load={load}
      openDelay={280}
      closeDelay={220}
      label={() => t(keys.contactLabel)}
      testId="contact-card"
      triggerVariant={triggerVariant}
      triggerClassName={triggerClassName}
      render={(ready, close) => (
        <ContactCardContent data={ready} close={close} {...actions} />
      )}
    >
      {children}
    </PersonCard>
  );
}
