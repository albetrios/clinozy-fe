import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateJoin, isolateText, isolateValues } from '@/lib/bidi-isolate.ts';
import { dateFormatOptions } from '@/lib/i18n/intl-config.ts';
import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import {
  PersonAvatar,
  personInitials,
} from '@/shared/components/Cells/PersonAvatar/index.ts';
import { type PillTone, TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import {
  PERSON_CARD_KEYS,
  PERSON_CARD_NS,
} from '@/shared/components/PersonCard/person-card.constants.ts';
import { CardGroup } from '@/shared/components/PersonCard/person-card-parts.tsx';
import { PersonCard } from '@/shared/components/PersonCard/PersonCard.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { Clock, House, Mail, Phone } from '@/shared/icons/index.ts';

/** Why the member is on the record — the pill at the header's end (H:6141). */
export type TeamCardKind = 'assigned' | 'sentThis' | 'treating' | 'involved';

/** "Assigned" dark, "Sent this" sage, the rest `bg-muted` (`_patterns.md:226`). */
const KIND_PILL: Readonly<Record<TeamCardKind, PillTone>> = {
  assigned: 'inverse',
  sentThis: 'sage',
  treating: 'neutral',
  involved: 'neutral',
};

/** Everything the team card shows (presence S:1571; hours and branches from the staff profile, Appendix F). */
export interface TeamCardData {
  name: string;
  /** Defaults to the name's initials (`User.initials` when there is one). */
  initials?: string;
  /** The member's own tone (`User.tone`). */
  tone: Tone;
  /** Their role(s), as shown ("Doctor", "Front desk · Admin"). */
  role: string;
  online: boolean;
  /** E.164. */
  phone?: string | null;
  email?: string | null;
  /** Branch names ("Adajan", "Vesu"). */
  branches?: readonly string[];
  /** Working hours, clinic-local `HH:mm`. */
  hours?: { from: string; to: string } | null;
  /** When this copy was fetched; absent while a fresher copy is still loading. */
  updatedAt?: string | null;
}

/**
 * One Reach row: its 13px icon and its text, when there is any. The phone and
 * the e-mail always read left to right (`ltr`); the composed rows keep the
 * page's direction with each name or time isolated.
 */
interface ReachLine<Text = string | null | undefined> {
  key: string;
  icon: ReactNode;
  text: Text;
  ltr?: boolean;
}

/** How to reach the member: phone, e-mail, branches, hours — each only when known. */
function teamReach(data: TeamCardData, t: TFunction): ReachLine<string>[] {
  const rows: ReachLine[] = [
    {
      key: 'phone',
      icon: <Phone />,
      text: data.phone ? formatClinicPhone(data.phone) : null,
      ltr: true,
    },
    { key: 'email', icon: <Mail />, text: data.email, ltr: true },
    {
      key: 'branches',
      icon: <House />,
      text: data.branches ? isolateJoin(data.branches) : null,
    },
    {
      key: 'hours',
      icon: <Clock />,
      text: data.hours ? t(PERSON_CARD_KEYS.works, isolateValues(data.hours)) : null,
    },
  ];
  return rows.filter((row): row is ReachLine<string> => Boolean(row.text));
}

/** The header: 48px avatar with the presence dot, name, role, presence line, kind pill. */
function TeamHeader({ data, kind }: { data: TeamCardData; kind?: TeamCardKind }) {
  const { t } = useTranslation(PERSON_CARD_NS);
  const keys = PERSON_CARD_KEYS;
  return (
    <div className="flex flex-none items-center gap-3 border-b p-3.5">
      <PersonAvatar
        size="card"
        initials={data.initials ?? personInitials(data.name)}
        tone={data.tone}
        presence={data.online ? 'online' : 'offline'}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[1.3]">
        <span
          dir="auto"
          className="text-title truncate [text-align:match-parent] leading-[1.3] font-semibold"
        >
          {data.name}
        </span>
        <span className="text-muted-foreground-strong text-xs leading-[1.3]">
          {data.role}
        </span>
        <span className="text-caption text-muted-foreground flex items-center gap-1.5 leading-[1.3]">
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 rounded-full',
              data.online ? 'bg-presence-online' : 'bg-border-strong',
            )}
          />
          {t(data.online ? keys.online : keys.offline)}
        </span>
      </div>
      {kind ? (
        <TonePill tone={KIND_PILL[kind]} size="sm" className="self-start">
          {t(keys.memberKind[kind])}
        </TonePill>
      ) : null}
    </div>
  );
}

/** The team card's content (H:2871–2884; `_patterns.md:221–229`). */
export function TeamCardContent({
  data,
  close,
  kind,
  assign,
}: {
  data: TeamCardData;
  close: () => void;
  kind?: TeamCardKind;
  assign?: { label?: string; onAssign: () => void };
}) {
  const { t } = useTranslation(PERSON_CARD_NS);
  const { formatDate, prefs } = useLocaleFormat();
  const keys = PERSON_CARD_KEYS;
  const reach = teamReach(data, t);
  const updated = data.updatedAt
    ? t(keys.updated, {
        time: isolateText(
          formatDate(data.updatedAt, {
            ...dateFormatOptions('time', prefs.hourCycle),
            second: undefined,
          }),
        ),
      })
    : t(keys.fetching);

  return (
    <>
      <TeamHeader data={data} kind={kind} />
      {assign || reach.length ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-3.5 py-3">
          {assign ? (
            <Button
              type="button"
              data-testid="team-card-assign"
              className="text-body h-9 rounded-lg"
              onClick={() => {
                close();
                assign.onAssign();
              }}
            >
              {assign.label ?? t(keys.assignToYourself)}
            </Button>
          ) : null}
          {reach.length ? (
            <CardGroup label={t(keys.reach)} className="gap-1.5">
              {reach.map((row) => (
                <span
                  key={row.key}
                  className="text-detail text-foreground-soft flex min-w-0 items-center gap-2 leading-[1.2]"
                >
                  <span
                    aria-hidden="true"
                    className="text-muted-foreground flex shrink-0 [&_svg]:size-3.25"
                  >
                    {row.icon}
                  </span>
                  <span
                    dir={row.ltr ? 'ltr' : undefined}
                    className="truncate tabular-nums"
                  >
                    {row.text}
                  </span>
                </span>
              ))}
            </CardGroup>
          ) : null}
        </div>
      ) : null}

      <div className="bg-canvas flex flex-none items-center border-t py-2 ps-3.5 pe-2.5">
        <span className="text-micro text-muted-foreground min-w-0 flex-1 leading-[1.2]">
          {updated}
        </span>
      </div>
    </>
  );
}

/** Props for {@link TeamCard}: the trigger, the data or its loader, the kind pill and the assign button. */
export interface TeamCardProps {
  /** The member's avatar or name — what is hovered or tapped. */
  children: ReactNode;
  /** Ready data, or… */
  data?: TeamCardData;
  /** …fetch first, then show. A failed load never opens. */
  load?: (signal: AbortSignal) => Promise<TeamCardData>;
  /** The member's relation to the record: the pill at the header's end. */
  kind?: TeamCardKind;
  /**
   * The 36px dark button: "Assign to yourself", or the caller's label ("Claim
   * <first>", "Join · take <first>", "Take over from <first>").
   */
  assign?: { label?: string; onAssign: () => void };
  triggerVariant?: 'chip' | 'bare';
  triggerClassName?: string;
}

/**
 * The team card for a staff member (KICKOFF §6.0): opens 160ms after hover and
 * closes 200ms after leaving; a tap opens it on a touch screen. Named by the
 * member.
 */
export function TeamCard({
  children,
  data,
  load,
  kind,
  assign,
  triggerVariant = 'bare',
  triggerClassName,
}: TeamCardProps) {
  return (
    <PersonCard
      data={data}
      load={load}
      openDelay={160}
      closeDelay={200}
      label={(ready) => ready.name}
      testId="team-card"
      triggerVariant={triggerVariant}
      triggerClassName={triggerClassName}
      render={(ready, close) => (
        <TeamCardContent data={ready} close={close} kind={kind} assign={assign} />
      )}
    >
      {children}
    </PersonCard>
  );
}
