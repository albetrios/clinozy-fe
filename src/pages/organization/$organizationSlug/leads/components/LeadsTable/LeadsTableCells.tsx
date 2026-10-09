import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { dateFormatOptions } from '@/lib/i18n/intl-config.ts';
import { cn } from '@/lib/utils.ts';
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  AvatarStack,
  type AvatarStackPerson,
  PersonChip,
} from '@/shared/components/Cells/index.ts';
import { ContactCard, TeamCard } from '@/shared/components/PersonCard/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { LEADS_KEYS, LEADS_NS, LEADS_TEST_IDS } from '../../leads.constants.ts';
import { leadContactCardData } from '../LeadFields/lead-contact.ts';
import { staffPerson, teamCardDataOf } from '../LeadFields/lead-people.ts';
import { useLeadsTableContext } from './leads-table-context.ts';

/** A cell control that must not also open the row. */
/** The first word of a name ("Claim Anaya"). */
const firstWord = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/**
 * The Lead cell (`leads.md:32`): the 32px avatar — lav, or sage with the "P"
 * badge once the person is a patient — the name, 600 while unread, over the
 * mobile at 11.5px; hovering it (280ms) or tapping it on a touch screen opens
 * the person's contact card.
 */
export function LeadPersonCell({ lead }: { lead: LeadRecord }) {
  const { staffById, contactActions } = useLeadsTableContext();
  const { t } = useTranslation(CLINIC_NS);
  const isPatient = lead.patientId !== null;
  const data = leadContactCardData(lead, staffById, {
    role: (role) => t(CLINIC_KEYS.roles[role]),
    source: (source) => t(CLINIC_KEYS.leads.sources[source]),
  });
  return (
    <ContactCard data={data} {...contactActions(lead)}>
      <PersonChip
        name={lead.name}
        sub={formatClinicPhone(lead.phone)}
        tone={isPatient ? 'sage' : 'lav'}
        patient={isPatient}
        emphasis={lead.unreadCount > 0}
        subSize="caption"
      />
    </ContactCard>
  );
}

/** The hold's pill once the lead is open: "Open · Claim", "Open to team · Join", "Open to team". */
function HoldPill({ lead }: { lead: LeadRecord }) {
  const { t } = useTranslation(LEADS_NS);
  const { staffById, viewerId, holdOf, canClaim, onClaim } = useLeadsTableContext();
  const hold = holdOf(lead);
  if (!hold.open) return null;
  const owner = lead.ownerId ? staffById.get(lead.ownerId) : undefined;
  if (viewerId !== null && lead.ownerId === viewerId) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-slot="pill"
            tabIndex={-1}
            className={cn(
              'text-micro flex h-5.5 flex-none items-center rounded-full px-2 font-semibold whitespace-nowrap',
              TONE_CLASSES.butter.surface,
            )}
          >
            {t(LEADS_KEYS.team.openMine)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {t(LEADS_KEYS.team.claimHint, { count: hold.idleDays })}
        </TooltipContent>
      </Tooltip>
    );
  }
  if (!canClaim) return null;
  const hint = hold.ownerGone
    ? t(LEADS_KEYS.team.joinHint, { name: owner?.firstName ?? '' })
    : t(LEADS_KEYS.team.claimHint, { count: hold.idleDays });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid={LEADS_TEST_IDS.claim}
          // The row's own click stays off: claiming never also opens the lead.
          data-row-click="ignore"
          onClick={() => onClaim(lead)}
          data-slot="pill"
          className={cn(
            'text-caption flex h-6 flex-none items-center rounded-full border px-2.25 leading-none font-semibold whitespace-nowrap transition-colors',
            TONE_CLASSES.butter.surface,
            TONE_CLASSES.butter.border,
            'hover:border-tone-butter-foreground',
          )}
        >
          {t(hold.ownerGone ? LEADS_KEYS.team.join : LEADS_KEYS.team.claim)}
        </button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

/** What a Team-column team card reads beyond its person. */
interface TeamCardSource {
  staffById: ReadonlyMap<string, StaffProfile>;
  roleLabel: (role: Role) => string;
  staffUpdatedAt: string | null;
}

/** Wraps the owner's chip in their team card, with the take-over button when one is offered. */
function ownerCardWrap(
  owner: StaffProfile,
  { roleLabel, staffUpdatedAt }: TeamCardSource,
  assign: { label: string; onAssign: () => void } | undefined,
) {
  return (_person: AvatarStackPerson, pill: ReactNode) => (
    <TeamCard
      data={teamCardDataOf(owner, roleLabel, staffUpdatedAt)}
      kind="assigned"
      triggerClassName="max-w-full"
      assign={assign}
    >
      {pill}
    </TeamCard>
  );
}

/** Wraps each involved person's chip in their team card — a person no longer on the team stays bare. */
function involvedCardWrap({ staffById, roleLabel, staffUpdatedAt }: TeamCardSource) {
  return (person: AvatarStackPerson, pill: ReactNode) => {
    const profile = staffById.get(person.id);
    return profile ? (
      <TeamCard data={teamCardDataOf(profile, roleLabel, staffUpdatedAt)} kind="involved">
        {pill}
      </TeamCard>
    ) : (
      pill
    );
  };
}

/**
 * The Team cell (`leads.md:32`; H:1739–1741): the owner's 28px chip — avatar
 * with the 7px presence dot and short name, the team card on hover (160ms) with
 * "Claim <first>", "Join · take <first>" or "Take over from <first>" — then the
 * hold's pill, the 7px butter dot when the lead releases within a day, and up
 * to three involved people, then "+N".
 */
export function LeadTeamCell({ lead }: { lead: LeadRecord }) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const { staffById, staffUpdatedAt, viewerId, holdOf, canClaim, onClaim } =
    useLeadsTableContext();
  const roleLabel = (role: Role) => tClinic(CLINIC_KEYS.roles[role]);
  const owner = lead.ownerId ? staffById.get(lead.ownerId) : undefined;
  const hold = holdOf(lead);
  const mine = viewerId !== null && lead.ownerId === viewerId;
  const involved = lead.involvedIds.flatMap((id) => staffById.get(id) ?? []);

  let takeOver: string | null = null;
  if (canClaim && owner && !mine && !hold.closed) {
    if (hold.ownerGone)
      takeOver = t(LEADS_KEYS.team.joinTake, { first: firstWord(lead.name) });
    else if (hold.open)
      takeOver = t(LEADS_KEYS.team.claimFirst, { first: firstWord(lead.name) });
    else takeOver = t(LEADS_KEYS.team.takeOver, { first: owner.firstName });
  }
  const releaseHint = t(
    hold.releasesToday ? LEADS_KEYS.team.releasesToday : LEADS_KEYS.team.releasesTomorrow,
  );
  const cards: TeamCardSource = { staffById, roleLabel, staffUpdatedAt };

  // Nothing in the cell shrinks: a narrow Team column lets the pills run on
  // over the gap, as the prototype's does at 820 — never cuts the owner's name.
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {owner ? (
        <AvatarStack
          people={[staffPerson(owner, { presence: true })]}
          max={1}
          nameFirst
          className="flex-none"
          wrapPerson={ownerCardWrap(
            owner,
            cards,
            takeOver === null
              ? undefined
              : { label: takeOver, onAssign: () => onClaim(lead) },
          )}
        />
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      )}
      <HoldPill lead={lead} />
      {hold.releasesWithinDay ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span // NOSONAR(S6819): a CSS-drawn 7px dot with a name, the tooltip's trigger — an <img> needs an image to draw
              role="img"
              data-slot="pill"
              aria-label={releaseHint}
              data-testid={LEADS_TEST_IDS.holdDot}
              className="bg-tone-butter-dot size-1.75 flex-none rounded-full"
            />
          </TooltipTrigger>
          <TooltipContent>{releaseHint}</TooltipContent>
        </Tooltip>
      ) : null}
      {involved.length > 0 ? (
        <AvatarStack
          people={involved.map((profile) => staffPerson(profile))}
          max={3}
          className="flex-none"
          wrapPerson={involvedCardWrap(cards)}
        />
      ) : null}
    </span>
  );
}

/**
 * "Updated" (`leads.md:32`): when the lead last changed by the rooms' one time
 * rule, read at the list's `now` — "10:40 am" today, then "Yesterday", "Mon",
 * "24 Sep", days alone in the 84px column — at 12px with a dotted underline,
 * its tooltip the full date and time — "Wed, 30 Sep 2026 · 11:00 am IST".
 */
export function LeadUpdatedCell({ lead, now }: { lead: LeadRecord; now: Date }) {
  const clock = useClinicClock();
  const { formatDate, prefs } = useLocaleFormat();
  const text = clock.moment(lead.updatedAt, { withTime: false, now });
  const full = `${formatDate(lead.updatedAt, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })} · ${formatDate(lead.updatedAt, {
    ...dateFormatOptions('time', prefs.hourCycle),
    second: undefined,
    timeZoneName: 'short',
  })}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={-1}
          className="text-muted-foreground decoration-border-strong text-xs whitespace-nowrap underline decoration-dotted underline-offset-3"
        >
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent>{full}</TooltipContent>
    </Tooltip>
  );
}
