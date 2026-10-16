import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ClinicProfile } from '@/shared/api/app/clinic-api.ts';
import {
  ONBOARDING_SETUP_STEP_COUNT,
  type OnboardingSetup,
} from '@/shared/api/app/onboarding-setup-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import type { DrawerSaveState } from '@/shared/components/DrawerFooter/DrawerFooter.tsx';
import type { DrawerStep } from '@/shared/components/DrawerSteps/DrawerSteps.tsx';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { Progress } from '@/shared/components/ui/progress.tsx';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useHoursFormat } from '@/shared/hooks/useHoursFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { SETUP_KEYS, SETUP_NS } from './setup-drawer.constants.ts';
import {
  drawerStepsDone,
  isStepUnlocked,
  SETUP_DRAWER_STEPS,
  type SetupDrawerStep,
} from './setup-place.ts';
import type { SetupStepProps } from './setup-step-props.ts';
import { SetupClinicTypeStep } from './SetupClinicTypeStep.tsx';
import { SetupLocationStep } from './SetupLocationStep.tsx';
import { SetupYouStep } from './SetupYouStep.tsx';

const TITLE_KEY: Record<SetupDrawerStep, string> = {
  'clinic-type': SETUP_KEYS.steps.clinicType.title,
  location: SETUP_KEYS.steps.location.title,
  you: SETUP_KEYS.steps.you.title,
};

const STEP_BODY: Record<SetupDrawerStep, (props: SetupStepProps) => ReactNode> = {
  'clinic-type': (props) => <SetupClinicTypeStep {...props} />,
  location: (props) => <SetupLocationStep {...props} />,
  you: (props) => <SetupYouStep {...props} />,
};

/** The header's progress bar: steps done of three, in the theme's progress green (D23). */
function SetupProgress({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  return (
    <div className="bg-background border-b px-(--drawer-pad-x) py-2.5">
      <Progress
        value={Math.round((done / total) * 100)}
        aria-label={label}
        data-testid="setup-drawer-progress"
        className="bg-success/20 [&>[data-slot=progress-indicator]]:bg-success h-1.5"
      />
    </div>
  );
}

/** What each folded step peeks: the picks, the branch and its hours, the answer. */
function useStepPeeks(setup: OnboardingSetup, profile: ClinicProfile) {
  const { t } = useTranslation(SETUP_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const hours = useHoursFormat();
  const { openBranches } = useBranches();
  const main = openBranches.find((branch) => branch.id === setup.mainBranchId);
  return {
    'clinic-type': profile.specialties.length
      ? [
          {
            kind: 'value' as const,
            label: t(SETUP_KEYS.peek.specialties),
            value: profile.specialties
              .map((specialty) => tApp(APP_KEYS.offerings.specialties[specialty]))
              .join(' · '),
          },
        ]
      : [],
    location: main
      ? [
          { kind: 'value' as const, label: t(SETUP_KEYS.peek.branch), value: main.name },
          {
            kind: 'value' as const,
            label: t(SETUP_KEYS.peek.hours),
            value: hours.hours(main.workingDays, main.opensAt, main.closesAt),
          },
        ]
      : [],
    you: [],
  } satisfies Record<SetupDrawerStep, DrawerStep['peek']>;
}

/**
 * The setup drawer's three steps (KICKOFF §6.1; BRIEF.md:42–52): the design's right drawer at
 * 560px, a full-screen sheet on a phone, with the house step cards — one open at a time, a done
 * step folded into its peek, a later one locked until the one before is saved (D14). The footer's
 * "Next: <step>" saves the open step ("Go live" on the last); "Explore first", ×, Esc and the
 * backdrop all close it, asking first only while the open step has unsaved edits.
 */
export function SetupStepsDrawer({
  setup,
  profile,
  step,
  onStepChange,
  onClose,
}: {
  setup: OnboardingSetup;
  profile: ClinicProfile;
  step: SetupDrawerStep;
  onStepChange: (step: SetupDrawerStep) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(SETUP_NS);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<DrawerSaveState>('idle');
  const done = drawerStepsDone(setup);
  const peeks = useStepPeeks(setup, profile);
  const stepNumber = SETUP_DRAWER_STEPS.indexOf(step) + 1;
  const doneCount = SETUP_DRAWER_STEPS.filter((id) => done[id]).length;
  const formId = `setup-form-${step}`;
  const onDirtyChange = useCallback((next: boolean) => setDirty(next), []);

  // A new step starts clean (the stored-previous-value pattern, not an effect)…
  const [shownStep, setShownStep] = useState(step);
  if (shownStep !== step) {
    setShownStep(step);
    setDirty(false);
    setSaveState('idle');
  }
  // …and focus moves to its title (BRIEF.md:241).
  useEffect(() => {
    document
      .querySelector<HTMLElement>(`[data-testid="setup-drawer-step-${step}-trigger"]`)
      ?.focus();
  }, [step]);

  const stepProps: SetupStepProps = {
    formId,
    setup,
    profile,
    onDirtyChange,
    onSaveState: setSaveState,
    onSaved: () => {
      setDirty(false);
      const next = SETUP_DRAWER_STEPS[SETUP_DRAWER_STEPS.indexOf(step) + 1];
      if (next) onStepChange(next);
    },
  };

  const steps: DrawerStep[] = SETUP_DRAWER_STEPS.map((id, index) => {
    const before = SETUP_DRAWER_STEPS[index - 1];
    const unlocked = isStepUnlocked(setup, id);
    return {
      id,
      title: t(TITLE_KEY[id]),
      complete: done[id],
      peek: peeks[id],
      ...(unlocked || !before
        ? {}
        : {
            locked: {
              hint: t(SETUP_KEYS.drawer.lockedHint, { step: t(TITLE_KEY[before]) }),
              onAttempt: () =>
                notify.info(
                  t(SETUP_KEYS.drawer.lockedToast, { step: t(TITLE_KEY[before]) }),
                ),
            },
          }),
      content: id === step ? STEP_BODY[id](stepProps) : null,
    };
  });

  const nextStep = SETUP_DRAWER_STEPS[stepNumber];
  const saveLabel =
    step === 'you' || nextStep === undefined
      ? t(SETUP_KEYS.drawer.goLive)
      : t(SETUP_KEYS.drawer.next, { step: t(TITLE_KEY[nextStep]) });

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={t(SETUP_KEYS.drawer.title, { clinic: profile.name })}
      sub={t(SETUP_KEYS.drawer.sub, {
        step: stepNumber,
        total: ONBOARDING_SETUP_STEP_COUNT,
      })}
      band={
        <SetupProgress
          done={doneCount}
          total={ONBOARDING_SETUP_STEP_COUNT}
          label={t(SETUP_KEYS.drawer.progressLabel)}
        />
      }
      content={{ fieldCount: 8 }}
      closeStyle="form"
      steps={steps}
      openStep={step}
      onOpenStepChange={(id) => {
        if (id) onStepChange(id as SetupDrawerStep);
      }}
      dismissLabel={t(SETUP_KEYS.drawer.exploreFirst)}
      saveLabel={saveLabel}
      savingLabel={
        step === 'you' ? t(SETUP_KEYS.drawer.goingLive) : t(SETUP_KEYS.drawer.saving)
      }
      onSave={() =>
        document.querySelector<HTMLFormElement>(`#${formId}`)?.requestSubmit()
      }
      saveState={saveState}
      notSavedLabel={t(SETUP_KEYS.drawer.notSaved)}
      dirty={dirty}
      testId="setup-drawer"
    >
      <p aria-live="polite" className="sr-only" data-testid="setup-drawer-step-announce">
        {t(SETUP_KEYS.drawer.stepAnnounce, {
          step: stepNumber,
          total: ONBOARDING_SETUP_STEP_COUNT,
        })}
      </p>
    </RecordDrawer>
  );
}
