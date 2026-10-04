import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  civilYearsBetween,
  clinicToday,
  localDateOf,
} from '@/shared/api/clinic/clinic-time.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import {
  ConsentChips,
  PERSON_CARD_KEYS,
  PERSON_CARD_NS,
} from '@/shared/components/PersonCard/index.ts';
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

/** "Female · 30 yrs", "Female", "30 yrs" — or nothing (the person card's words). */
function useGenderAge(file: PatientFile, today: string): string | null {
  const { t } = useTranslation(PERSON_CARD_NS);
  const { formatNumber } = useLocaleFormat();
  const { gender, dateOfBirth } = file.patient;
  const age = dateOfBirth ? formatNumber(civilYearsBetween(dateOfBirth, today)) : null;
  const genderLabel = gender ? t(PERSON_CARD_KEYS.gender[gender]) : null;
  if (genderLabel && age)
    return t(PERSON_CARD_KEYS.genderAge, { gender: genderLabel, age });
  if (genderLabel) return genderLabel;
  return age ? t(PERSON_CARD_KEYS.age, { age }) : null;
}

/**
 * About (H:720): gender and age; the birth date with the birthday chip within
 * 45 days ("🎂 in 24 days" / "🎂 today", lav); the language (a backend
 * request); the address or "No address"; the consent chips (the person card's).
 */
export function RailAbout({ file }: { file: PatientFile }) {
  const { t } = useTranslation(PATIENT_RAIL_NS);
  const { formatDate } = useLocaleFormat();
  const today = clinicToday();
  const genderAge = useGenderAge(file, today);
  const { dateOfBirth, address, consents } = file.patient;
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
            <span className="min-w-0 wrap-anywhere">
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
          <AboutRow icon={<MessageSquare />}>{file.language}</AboutRow>
        ) : null}
        <AboutRow icon={<MapPin />}>
          <span className="min-w-0 wrap-anywhere">{address ?? t(K.noAddress)}</span>
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
