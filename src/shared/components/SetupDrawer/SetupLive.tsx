import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationBranchEdit } from '@/lib/routes/branches-builders.ts';
import { branchListKey, fetchBranches } from '@/shared/api/app/branches-manage-api.ts';
import type { ClinicProfile } from '@/shared/api/app/clinic-api.ts';
import type { OnboardingSetup } from '@/shared/api/app/onboarding-setup-contracts.ts';
import { DrawerChips, DrawerField } from '@/shared/components/DrawerField/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useRolesInForce } from '@/shared/hooks/useAppRoles/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useHoursFormat } from '@/shared/hooks/useHoursFormat/index.ts';
import { useOfferings } from '@/shared/hooks/useOfferings/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { CheckCircle } from '@/shared/icons/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { SETUP_KEYS, SETUP_NS } from './setup-drawer.constants.ts';
import {
  captureHeardAbout,
  HEARD_ABOUT_VALUES,
  type HeardAbout,
} from './setup-heard-about.ts';
import { useConsultationName } from './use-consultation-name.ts';

const K = SETUP_KEYS.live;

/**
 * "You're live" (KICKOFF §6.1; BRIEF.md:67): what setup made — the main branch, each
 * Consultation with its price, the owner as doctor or therapist — read back from the records, so
 * a refresh shows the same; "Book your first appointment" opens the shared booking form over the
 * room, "Done" closes. An optional "How did you hear about us?" row feeds analytics only. The
 * branch's defaults setup did not ask — its hours and email — show under it, with Change to its
 * drawer (change-setup-one-question D9).
 */
export function SetupLive({
  setup,
  profile,
  onBook,
  onClose,
}: {
  setup: OnboardingSetup;
  profile: ClinicProfile;
  onBook: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(SETUP_NS);
  const hours = useHoursFormat();
  const organizationSlug = useOrganizationStore((state) => state.organizationSlug) ?? '';
  const rupees = useRupeeFormat();
  const consultationName = useConsultationName();
  const { openBranches } = useBranches();
  const { data: offerings = [] } = useOfferings({ notifyOnError: false });
  const roles = useRolesInForce();
  const [heardAbout, setHeardAbout] = useState<HeardAbout | null>(null);

  const branch = openBranches.find((candidate) => candidate.id === setup.mainBranchId);
  // Its email is not in the rooms' branch list: the full record, as the Branches room reads it.
  const { data: allBranches } = useAppQuery({
    queryKey: branchListKey(),
    queryFn: fetchBranches,
    notifyOnError: false,
  });
  const saved = allBranches?.find((candidate) => candidate.id === setup.mainBranchId);
  const branchHours = branch
    ? hours.hours(branch.workingDays, branch.opensAt, branch.closesAt)
    : '';
  const consultations = profile.specialties.flatMap((specialty) => {
    const name = consultationName(
      specialty,
      profile.specialties.length,
    ).toLocaleLowerCase();
    const found = offerings.find(
      (offering) => offering.name.toLocaleLowerCase() === name,
    );
    return found
      ? [t(K.consultation, { name: found.name, price: rupees(found.price) })]
      : [];
  });
  const presets = new Set(roles.map((role) => role.preset));
  let you: string | null = null;
  if (presets.has('doctor')) you = t(K.youAsDoctor);
  else if (presets.has('therapist')) you = t(K.youAsTherapist);
  const items = [...consultations, you].filter((item): item is string => item !== null);

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={t(K.title)}
      sub={t(K.sub, { clinic: profile.name })}
      content={{ fieldCount: 2 }}
      closeStyle="form"
      dismissLabel={t(K.done)}
      saveLabel={t(K.book)}
      onSave={onBook}
      saveTestId="setup-live-book"
      dismissTestId="setup-live-done"
      testId="setup-live"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <CheckCircle className="text-success size-6 flex-none" aria-hidden />
          <p className="text-field font-semibold">{t(K.setUp)}</p>
        </div>
        <ul className="flex flex-col gap-1.5 ps-8.5" data-testid="setup-live-summary">
          {branch ? (
            <li className="flex min-w-0 flex-col gap-0.5" data-testid="setup-live-branch">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="text-detail text-foreground min-w-0 truncate">
                  {t(K.branch, { branch: branch.name })}
                </span>
                <Link
                  {...organizationBranchEdit(organizationSlug, branch.id)}
                  className="text-foreground flex-none text-xs font-medium underline underline-offset-2"
                  data-testid="setup-live-branch-change"
                >
                  {t(K.change)}
                </Link>
              </span>
              <span className="text-muted-foreground min-w-0 truncate text-xs">
                {saved
                  ? t(K.branchDetails, { hours: branchHours, email: saved.email })
                  : t(K.branchHours, { hours: branchHours })}
              </span>
            </li>
          ) : null}
          {items.map((item) => (
            <li key={item} className="text-detail text-foreground">
              {item}
            </li>
          ))}
        </ul>
        <DrawerField label={t(K.heardAbout.label)} className="pt-2">
          <DrawerChips<HeardAbout>
            label={t(K.heardAbout.label)}
            clearable
            options={HEARD_ABOUT_VALUES.map((value) => ({
              value,
              label: t(K.heardAbout.options[value]),
            }))}
            value={heardAbout}
            onChange={(next) => {
              setHeardAbout(next);
              if (next) captureHeardAbout(next);
            }}
            testId="setup-live-heard-about"
          />
        </DrawerField>
        {heardAbout ? (
          <p className="text-muted-foreground text-xs">{t(K.heardAbout.thanks)}</p>
        ) : null}
      </div>
    </RecordDrawer>
  );
}
