import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { appToday, civilYearsBetween, localDateOf } from '@/shared/api/app/app-time.ts';
import type { PatientFile } from '@/shared/api/app/patient-file-contracts.ts';
import { APP_NS } from '@/shared/app/app.constants.ts';
import {
  ConsentChips,
  PERSON_CARD_KEYS,
  PERSON_CARD_NS,
} from '@/shared/components/PersonCard/index.ts';
import { CONTACT_EDITOR_KEYS } from '@/shared/forms/ContactEditor/contact-editor.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { Calendar, MapPin, MessageSquare, Shield, Users } from '@/shared/icons/index.ts';

import { PATIENT_RAIL_KEYS, PATIENT_RAIL_NS } from './patient-rail.constants.ts';
import { birthdayInDays } from './patient-rail.ts';

const K = PATIENT_RAIL_KEYS;

/** One About row: a 14px icon in a 16px track and its line (H:720). */
function AboutRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-5.5 grid-cols-[1rem_minmax(0,1fr)] items-center gap-2.5">
      <span aria-hidden="true" className="text-muted-foreground flex [&_svg]:size-3.5">
        {icon}
      </span>
      <span className="text-body text-foreground-soft flex min-w-0 flex-wrap items-center gap-1.5 tabular-nums">
        {children}
      </span>
    </div>
  );
}

/**
 * "Female · 30 yrs", "Female", "30 yrs" — or nothing (the person card's words); "· approx." after
 * an age the desk typed.
 */
function useGenderAge(file: PatientFile, today: string): string | null {
  const { t } = useTranslation(PERSON_CARD_NS);
  const { formatNumber } = useLocaleFormat();
  const { gender, dateOfBirth, dateOfBirthIsApproximate } = file.patient;
  const age = dateOfBirth ? formatNumber(civilYearsBetween(dateOfBirth, today)) : null;
  const genderLabel = gender ? t(PERSON_CARD_KEYS.gender[gender]) : null;
  if (!age) return genderLabel;
  const line = genderLabel
    ? t(PERSON_CARD_KEYS.genderAge, { gender: genderLabel, age })
    : t(PERSON_CARD_KEYS.age, { age });
  return dateOfBirthIsApproximate ? `${line} · ${t(PERSON_CARD_KEYS.approximate)}` : line;
}

/**
 * About (H:720): gender and age ("approx." after a typed age, whose estimated date and birthday
 * are not shown — feat-approximate-age FE4); the birth date with the birthday chip within
 * 45 days ("🎂 in 24 days" / "🎂 today", lav); the language the person asked
 * for (their language tag); the address or "No address"; the consent chips
 * (the person card's).
 * The date, the language and the address read in their own direction.
 */
export function RailAbout({ file }: { file: PatientFile }) {
  const { t } = useTranslation([PATIENT_RAIL_NS, APP_NS]);
  const { formatDate } = useLocaleFormat();
  const today = appToday();
  const genderAge = useGenderAge(file, today);
  const { address, consents } = file.patient;
  // A date estimated from a typed age is no birthday
  const dateOfBirth = file.patient.dateOfBirthIsApproximate
    ? null
    : file.patient.dateOfBirth;
  const birthday = birthdayInDays(dateOfBirth, today);

  return (
    <section
      aria-label={t(K.about)}
      className="flex flex-col gap-2.5 px-(--table-pad-x) pt-3.5 pb-4"
    >
      <span className="text-micro text-muted-foreground font-semibold tracking-wider uppercase">
        {t(K.about)}
      </span>
      <div className="flex flex-col gap-2.25">
        {genderAge ? <AboutRow icon={<Users />}>{genderAge}</AboutRow> : null}
        {dateOfBirth ? (
          <AboutRow icon={<Calendar />}>
            <span dir="auto" className="min-w-0 wrap-anywhere">
              {formatDate(
                localDateOf(dateOfBirth),
                { day: 'numeric', month: 'short', year: 'numeric' },
                { civilDay: true },
              )}
            </span>
            {birthday === null ? null : (
              <span
                data-slot="pill"
                className="bg-tone-lav text-tone-lav-foreground text-micro inline-flex h-5 items-center rounded-full px-1.75 font-medium whitespace-nowrap"
              >
                {birthday === 0
                  ? t(K.birthdayToday)
                  : t(K.birthdayIn, { count: birthday })}
              </span>
            )}
          </AboutRow>
        ) : null}
        {file.language ? (
          <AboutRow icon={<MessageSquare />}>
            <span dir="auto">
              {t(CONTACT_EDITOR_KEYS.preferences[file.language], { ns: APP_NS })}
            </span>
          </AboutRow>
        ) : null}
        <AboutRow icon={<MapPin />}>
          <span dir="auto" className="min-w-0 [text-align:match-parent] wrap-anywhere">
            {address ?? t(K.noAddress)}
          </span>
        </AboutRow>
        <AboutRow icon={<Shield />}>
          <ConsentChips
            consent={{
              data: consents.includes('data'),
              photos: consents.includes('photos'),
              marketing: consents.includes('marketing'),
            }}
          />
        </AboutRow>
      </div>
    </section>
  );
}
