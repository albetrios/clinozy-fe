import { type SubmitEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  OFFERING_SPECIALTY_VALUES,
  type OfferingSpecialty,
} from '@/shared/api/app/app-schema.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { DrawerChips, DrawerField } from '@/shared/components/DrawerField/index.ts';
import { useUpdateClinicProfile } from '@/shared/hooks/useClinicProfile/index.ts';
import { useChangeOnboardingSetup } from '@/shared/hooks/useOnboardingSetup/index.ts';

import { setupEvents } from './setup-analytics.ts';
import { SETUP_KEYS, SETUP_NS } from './setup-drawer.constants.ts';
import type { SetupStepProps } from './setup-step-props.ts';

const K = SETUP_KEYS.steps.clinicType;

/** Whether two specialty lists hold the same picks, in any order. */
function sameSpecialties(
  a: readonly OfferingSpecialty[],
  b: readonly OfferingSpecialty[],
) {
  return a.length === b.length && a.every((specialty) => b.includes(specialty));
}

/**
 * Step 1, "What kind of clinic is it?" (KICKOFF §6.1; BRIEF.md:58): the six specialty chips, pick
 * any, at least one; "Next" saves the clinic's specialties (only when they changed), then the
 * answered step.
 */
export function SetupClinicTypeStep({
  formId,
  profile,
  onDirtyChange,
  onSaveState,
  onSaved,
}: SetupStepProps) {
  const { t } = useTranslation(SETUP_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const [picked, setPicked] = useState<OfferingSpecialty[]>(profile.specialties);
  const [error, setError] = useState<string | null>(null);
  const updateProfile = useUpdateClinicProfile({ notifyOnError: false });
  const changeSetup = useChangeOnboardingSetup({ notifyOnError: false });
  const dirty = !sameSpecialties(picked, profile.specialties);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (picked.length === 0) {
      setError(t(K.required));
      return;
    }
    onSaveState('saving');
    try {
      if (dirty) await updateProfile.mutateAsync({ specialties: picked });
      await changeSetup.mutateAsync({ answeredStepsAdd: ['clinic_type'] });
      setupEvents.stepCompleted('clinic_type');
      onSaveState('idle');
      onSaved();
    } catch {
      onSaveState('failed');
    }
  };

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-3">
      <p className="text-muted-foreground text-detail">{t(K.why)}</p>
      <DrawerField
        label={t(K.label)}
        hint={t(K.hint)}
        required
        error={error ?? undefined}
      >
        <DrawerChips<OfferingSpecialty>
          multiple
          ordered
          variant="button"
          label={t(K.label)}
          options={OFFERING_SPECIALTY_VALUES.map((specialty) => ({
            value: specialty,
            label: tApp(APP_KEYS.offerings.specialties[specialty]),
          }))}
          value={picked}
          onChange={(next) => {
            setPicked(next);
            if (next.length > 0) setError(null);
          }}
          testId="setup-specialty"
        />
      </DrawerField>
    </form>
  );
}
