import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import type {
  ContactAbout,
  ContactReviews,
} from '@/shared/components/PersonCard/ContactCard/contact-card.types.ts';
import {
  PERSON_CARD_KEYS,
  PERSON_CARD_NS,
} from '@/shared/components/PersonCard/person-card.constants.ts';
import { CardGroup } from '@/shared/components/PersonCard/person-card-parts.tsx';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import {
  House,
  MapPin,
  MessageSquare,
  Shield,
  Sparkles,
  Tag,
  Users,
  Wallet,
} from '@/shared/icons/index.ts';

const keys = PERSON_CARD_KEYS;

/** "Female · 29 yrs", "Female", "29 yrs" — or nothing. */
function genderAgeLine(about: ContactAbout, age: string | null, t: TFunction) {
  const gender = about.gender ? t(keys.gender[about.gender]) : null;
  if (gender && age) return t(keys.genderAge, { gender, age });
  if (gender) return gender;
  return age ? t(keys.age, { age }) : null;
}

/** "<₹> to return to them · <₹> they owe the clinic", each half only when owed. */
function creditsLine(
  about: ContactAbout,
  formatPaise: (paise: number) => string,
  t: TFunction,
) {
  const parts = [
    about.owedToThem
      ? t(keys.owedToThem, { amount: formatPaise(about.owedToThem) })
      : null,
    about.owedByThem
      ? t(keys.owedByThem, { amount: formatPaise(about.owedByThem) })
      : null,
  ].filter((part) => part !== null);
  return parts.length ? parts.join(' · ') : null;
}

/** One About row: its 14px icon and its text, when there is any. */
interface AboutLine<Text = string | null | undefined> {
  icon: ReactNode;
  text: Text;
}

/** The design's About rows with their 14px icons, in its order (H:5692). */
function useAboutRows(about: ContactAbout): AboutLine<string>[] {
  const { t } = useTranslation(PERSON_CARD_NS);
  const { formatNumber } = useLocaleFormat();
  const clock = useClinicClock();
  const formatPaise = usePaiseFormat();
  const age = typeof about.age === 'number' ? formatNumber(about.age) : null;
  const reviews: ContactReviews | null =
    about.reviews && about.reviews.count > 0 ? about.reviews : null;
  const rows: AboutLine[] = [
    { icon: <Users />, text: genderAgeLine(about, age, t) },
    { icon: <MessageSquare />, text: about.language },
    { icon: <MapPin />, text: about.area },
    { icon: <House />, text: about.household },
    {
      icon: <Tag />,
      text: about.source ? t(keys.cameVia, { source: about.source }) : null,
    },
    { icon: <Wallet />, text: creditsLine(about, formatPaise, t) },
    {
      icon: <Sparkles />,
      text: reviews
        ? t(keys.reviews, {
            count: reviews.count,
            rating: formatNumber(reviews.latestRating),
            source: reviews.latestSource,
            date: clock.moment(reviews.latestAt, { withTime: false }),
          })
        : null,
    },
  ];
  return rows.filter((row): row is AboutLine<string> => Boolean(row.text));
}

/**
 * The three consent chips: sage "✓" when given, `bg-muted` "✕" when not
 * (tooltip "Consent · Data") — the contact card's About and the patient rail's.
 */
export function ConsentChips({
  consent,
}: {
  consent: NonNullable<ContactAbout['consent']>;
}) {
  const { t } = useTranslation(PERSON_CARD_NS);
  const chips = [
    { id: 'data', label: t(keys.consent.data), given: consent.data },
    { id: 'photos', label: t(keys.consent.photos), given: consent.photos },
    { id: 'marketing', label: t(keys.consent.marketing), given: consent.marketing },
  ];
  return (
    <span className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <TonePill
          key={chip.id}
          tone={chip.given ? 'sage' : 'neutral'}
          size="sm"
          title={t(keys.consent.hint, { label: chip.label })}
        >
          <span aria-hidden="true">
            {chip.given ? '✓' : '✕'} {chip.label}
          </span>
          <span className="sr-only">
            {t(chip.given ? keys.consent.given : keys.consent.missing, {
              label: chip.label,
            })}
          </span>
        </TonePill>
      ))}
    </span>
  );
}

/** One About row: a 16px icon column and the value. */
function AboutRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-5.5 grid-cols-[1rem_minmax(0,1fr)] items-center gap-2.5">
      <span aria-hidden="true" className="text-muted-foreground flex [&_svg]:size-3.5">
        {icon}
      </span>
      {children}
    </div>
  );
}

/** The "About" section — absent when nothing about the person is known. */
export function ContactAboutGroup({ about }: { about: ContactAbout }) {
  const { t } = useTranslation(PERSON_CARD_NS);
  const rows = useAboutRows(about);
  const consent = about.consent ?? null;
  if (!(rows.length || consent)) return null;
  return (
    <CardGroup label={t(keys.about)} className="gap-2.5 px-3.5 pt-3 pb-3.5">
      <div className="flex flex-col gap-2.25">
        {rows.map((row) => (
          <AboutRow key={row.text} icon={row.icon}>
            <span className="text-body text-foreground-soft min-w-0 wrap-anywhere tabular-nums">
              {row.text}
            </span>
          </AboutRow>
        ))}
        {consent ? (
          <AboutRow icon={<Shield />}>
            <ConsentChips consent={consent} />
          </AboutRow>
        ) : null}
      </div>
    </CardGroup>
  );
}
