import { type ReactNode, useCallback, useEffect, useId, useState } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { branchListKey, fetchBranches } from '@/shared/api/app/branches-manage-api.ts';
import type { ClinicProfile } from '@/shared/api/app/clinic-api.ts';
import {
  type OnboardingSetup,
  SETUP_QUESTION_COUNT,
} from '@/shared/api/app/onboarding-setup-contracts.ts';
import type { DrawerSaveState } from '@/shared/components/DrawerFooter/DrawerFooter.tsx';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Progress } from '@/shared/components/ui/progress.tsx';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { resetFormInPlace } from '@/shared/hooks/useEditingRecord/index.ts';
import { ChevronLeft } from '@/shared/icons/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

import { SETUP_KEYS, SETUP_NS } from './setup-drawer.constants.ts';
import {
  initialLocationForm,
  locationFormFromBranch,
  type LocationFormValues,
} from './setup-location-form.ts';
import {
  LOCATION_QUESTIONS,
  type LocationQuestion,
  questionNumber,
  questionOf,
  type SetupDrawerStep,
  type SetupQuestion,
} from './setup-place.ts';
import type { SetupStepProps } from './setup-step-props.ts';
import { SetupClinicTypeStep } from './SetupClinicTypeStep.tsx';
import { SetupLocationStep } from './SetupLocationStep.tsx';
import { SetupYouStep } from './SetupYouStep.tsx';

/** Each question's title and the one line that says why it is asked. */
const QUESTION_COPY: Record<SetupQuestion, { title: string; why: string }> = {
  'clinic-type': SETUP_KEYS.steps.clinicType,
  pin: SETUP_KEYS.steps.pin,
  address: SETUP_KEYS.steps.address,
  phone: SETUP_KEYS.steps.phone,
  you: SETUP_KEYS.steps.you,
};

/** The question before each one — Back's target; none before the first. */
const QUESTION_BEFORE: Record<SetupQuestion, SetupQuestion | null> = {
  'clinic-type': null,
  pin: 'clinic-type',
  address: 'pin',
  phone: 'address',
  you: 'phone',
};

/** The header's progress bar: the questions behind this one, of five, in the progress green (D23). */
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

/**
 * Step 2's answers, held while the drawer is open so Back never loses one: they start from the
 * clinic's name and the owner's email (change-setup-one-question D2), or — once a main branch
 * exists — from that branch, so going back shows what was saved.
 */
function useLocationDraft(setup: OnboardingSetup, profile: ClinicProfile) {
  const email = useAuthStore((state) => state.user?.email ?? '');
  const form = useForm<LocationFormValues>({
    defaultValues: initialLocationForm({ clinicName: profile.name, email }),
  });
  const { isDirty } = useFormState({ control: form.control });
  // The branch as an edit sends it back — every field, read only once a main branch exists.
  const branches = useAppQuery({
    queryKey: branchListKey(),
    queryFn: fetchBranches,
    enabled: setup.liveChecks.main_branch,
    notifyOnError: false,
  });
  const main = setup.liveChecks.main_branch
    ? branches.data?.find((branch) => branch.id === setup.mainBranchId)
    : undefined;

  useEffect(() => {
    if (main && !form.formState.isDirty)
      resetFormInPlace(form, locationFormFromBranch(main));
  }, [main, form]);

  return { form, isDirty };
}

/**
 * The setup drawer's questions, one per screen (change-setup-one-question; KICKOFF §6.1): the
 * design's right drawer at 560px, a full-screen sheet on a phone. The open question's title, the one
 * line that says why it is asked, and its answer — nothing else. The footer's Back goes to the
 * question before (answers kept), "Next" saves this one ("Go live" on the last); "Explore first", ×,
 * Esc and the backdrop all close, asking first only while an answer is unsaved. Step 2 is three
 * questions — the PIN, the street address, the phone — which live here until the phone creates the
 * branch (D6).
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
  const titleId = useId();
  const [stepDirty, setStepDirty] = useState(false);
  const [saveState, setSaveState] = useState<DrawerSaveState>('idle');
  const [locationQuestion, setLocationQuestion] = useState<LocationQuestion>(
    LOCATION_QUESTIONS[0],
  );
  const location = useLocationDraft(setup, profile);
  const question = questionOf(step, locationQuestion);
  const number = questionNumber(question);
  const formId = `setup-form-${question}`;
  const onDirtyChange = useCallback((next: boolean) => setStepDirty(next), []);

  // A new question starts clean (the stored-previous-value pattern, not an effect)…
  const [shownQuestion, setShownQuestion] = useState(question);
  if (shownQuestion !== question) {
    setShownQuestion(question);
    setStepDirty(false);
    setSaveState('idle');
  }
  // …and focus moves to its answer — the field to type in, else the question itself.
  useEffect(() => {
    const target =
      document.querySelector<HTMLElement>(
        `[data-testid="setup-question-${question}"] [data-setup-autofocus]`,
      ) ?? document.getElementById(titleId);
    target?.focus();
  }, [question, titleId]);

  /** Leaving step 2 forward or back starts it at the PIN next time. */
  const goToStep = (next: SetupDrawerStep, atLocation: LocationQuestion = 'pin') => {
    setLocationQuestion(atLocation);
    onStepChange(next);
  };

  const before = QUESTION_BEFORE[question];
  // A live clinic re-opening its branch has nothing before it to go back to.
  const back =
    before === null || setup.isLive
      ? null
      : () => {
          if (before === 'clinic-type') goToStep('clinic-type');
          else if (before === 'phone') goToStep('location', 'phone');
          else if (before !== 'you') setLocationQuestion(before);
        };

  const stepProps: SetupStepProps = {
    formId,
    titleId,
    setup,
    profile,
    onDirtyChange,
    onSaveState: setSaveState,
    // The last question went live: the drawer's address turns to "You're live" by itself.
    onSaved: () => {
      setStepDirty(false);
      if (step === 'clinic-type') goToStep('location');
      else if (step === 'location') goToStep('you');
    },
  };

  let body: ReactNode;
  if (step === 'clinic-type') body = <SetupClinicTypeStep {...stepProps} />;
  else if (step === 'location')
    body = (
      <SetupLocationStep
        {...stepProps}
        form={location.form}
        question={locationQuestion}
        onQuestionChange={setLocationQuestion}
      />
    );
  else body = <SetupYouStep {...stepProps} />;

  const copy = QUESTION_COPY[question];
  const last = question === 'you';

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={t(SETUP_KEYS.drawer.title, { clinic: profile.name })}
      sub={t(SETUP_KEYS.drawer.sub, { step: number, total: SETUP_QUESTION_COUNT })}
      band={
        <SetupProgress
          done={number - 1}
          total={SETUP_QUESTION_COUNT}
          label={t(SETUP_KEYS.drawer.progressLabel)}
        />
      }
      content={{ fieldCount: 8 }}
      closeStyle="form"
      dismissLabel={t(SETUP_KEYS.drawer.exploreFirst)}
      footerStart={
        back ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ms-2"
            onClick={back}
            disabled={saveState === 'saving'}
            data-testid="setup-drawer-back"
          >
            <ChevronLeft aria-hidden className="rtl:-scale-x-100" />
            {t(SETUP_KEYS.drawer.back)}
          </Button>
        ) : undefined
      }
      saveLabel={last ? t(SETUP_KEYS.drawer.goLive) : t(SETUP_KEYS.drawer.next)}
      savingLabel={last ? t(SETUP_KEYS.drawer.goingLive) : t(SETUP_KEYS.drawer.saving)}
      onSave={() =>
        document.querySelector<HTMLFormElement>(`#${formId}`)?.requestSubmit()
      }
      saveState={saveState}
      notSavedLabel={t(SETUP_KEYS.drawer.notSaved)}
      dirty={stepDirty || location.isDirty}
      testId="setup-drawer"
    >
      <div
        key={question}
        className="animate-fade-in-up flex flex-col gap-5 motion-reduce:animate-none"
        data-testid={`setup-question-${question}`}
      >
        <div className="flex flex-col gap-1">
          <h3
            id={titleId}
            tabIndex={-1}
            className="text-foreground text-lg font-semibold text-balance outline-none"
            data-testid="setup-question-title"
          >
            {t(copy.title)}
          </h3>
          <p className="text-muted-foreground text-detail">{t(copy.why)}</p>
        </div>
        {body}
      </div>
      <p aria-live="polite" className="sr-only" data-testid="setup-drawer-step-announce">
        {t(SETUP_KEYS.drawer.stepAnnounce, { step: number, total: SETUP_QUESTION_COUNT })}
      </p>
    </RecordDrawer>
  );
}
