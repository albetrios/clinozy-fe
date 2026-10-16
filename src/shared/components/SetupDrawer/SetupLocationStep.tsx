import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, type SubmitEvent, useEffect, useState } from 'react';
import { Controller, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { branchQueryKeys } from '@/shared/api/app/branches-api.ts';
import { BRANCH_LIMITS } from '@/shared/api/app/branches-contracts.ts';
import { fetchBranches, saveBranch } from '@/shared/api/app/branches-manage-api.ts';
import {
  fetchOnboardingSetup,
  onboardingSetupQueryKeys,
} from '@/shared/api/app/onboarding-setup-api.ts';
import { PIN_CODE_PATTERN } from '@/shared/app/pin-directory/index.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  DrawerPhoneInput,
} from '@/shared/components/DrawerField/index.ts';
import { PinAreaChips } from '@/shared/components/PinAreaChips/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { resetFormInPlace } from '@/shared/hooks/useEditingRecord/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { usePinPlace } from '@/shared/hooks/usePinPlace/index.ts';
import { MapPin } from '@/shared/icons/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { setupEvents } from './setup-analytics.ts';
import { SETUP_KEYS, SETUP_NS } from './setup-drawer.constants.ts';
import {
  LOCATION_QUESTION_FIELDS,
  locationBranchInput,
  locationBranchUpdate,
  type LocationField,
  type LocationFormValues,
  type LocationProblem,
  locationQuestionProblems,
} from './setup-location-form.ts';
import { LOCATION_QUESTIONS, type LocationQuestion } from './setup-place.ts';
import type { SetupStepProps } from './setup-step-props.ts';

const K = SETUP_KEYS.steps.location;

/** The problems of the open question, by field. */
type Problems = Partial<Record<LocationField, LocationProblem>>;

/** The error line for a problem, naming the field when it is required. */
function useProblemText() {
  const { t } = useTranslation(SETUP_NS);
  return (problem: LocationProblem | undefined, label: string): string | undefined => {
    switch (problem) {
      case 'required':
        return t(K.requiredField, { field: label });
      case 'pin':
        return t(K.pinInvalid);
      case 'email':
        return t(K.emailInvalid);
      case 'phone':
        return t(K.phoneInvalid);
      default:
        return undefined;
    }
  };
}

/** Props of {@link SetupLocationStep}: a step's, plus the question it shows and its answers. */
export interface SetupLocationStepProps extends SetupStepProps {
  /** Step 2's answers, held by the drawer so Back never loses one. */
  form: UseFormReturn<LocationFormValues>;
  /** The open question: the PIN, the street address or the phone. */
  question: LocationQuestion;
  onQuestionChange: (question: LocationQuestion) => void;
}

/** "What's your clinic's PIN code?" — digits only; the sixth looks the place up and moves on (D7). */
function PinQuestion({
  form,
  titleId,
  error,
  onPin,
}: {
  form: UseFormReturn<LocationFormValues>;
  titleId: string;
  error: string | undefined;
  onPin: (pin: string) => void;
}) {
  return (
    <DrawerField htmlFor="setup-pin" error={error}>
      <Controller
        control={form.control}
        name="pin"
        render={({ field }) => (
          <DrawerInput
            id="setup-pin"
            ref={field.ref}
            name={field.name}
            value={field.value}
            onBlur={field.onBlur}
            inputMode="numeric"
            autoComplete="postal-code"
            capitalize={false}
            maxLength={BRANCH_LIMITS.pin}
            aria-labelledby={titleId}
            aria-invalid={error !== undefined}
            className="text-base tracking-[0.2em] tabular-nums"
            data-setup-autofocus
            data-testid="setup-question-pin-input"
            onChange={(event) => {
              const pin = event.currentTarget.value.replaceAll(/\D/g, '').slice(0, 6);
              field.onChange(pin);
              onPin(pin);
            }}
          />
        )}
      />
    </DrawerField>
  );
}

/**
 * "What's the street address?" — the line, and under it the place the PIN filled ("Adajan · Surat ·
 * Gujarat · Edit"); area, city and state as fields when the PIN is unknown, when one is missing, or
 * on Edit. A PIN with several areas offers them as chips.
 */
function AddressQuestion({
  form,
  titleId,
  problems,
}: {
  form: UseFormReturn<LocationFormValues>;
  titleId: string;
  problems: Problems;
}) {
  const { t } = useTranslation(SETUP_NS);
  const problemText = useProblemText();
  const values = useFormValues(form);
  const { place, lookUp } = usePinPlace();
  const [editing, setEditing] = useState(false);

  // The place the PIN names, looked up again for its area chips — the answers themselves are kept.
  useEffect(() => {
    const pin = form.getValues('pin');
    if (PIN_CODE_PATTERN.test(pin)) void lookUp(pin);
  }, [form, lookUp]);

  const showFields =
    editing ||
    place === null ||
    !values.city.trim() ||
    problems.area !== undefined ||
    problems.city !== undefined;
  const placeLine = [values.area, values.city, values.state]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' · ');

  const placeField = (
    field: 'area' | 'city' | 'state',
    label: string,
    maxLength: number,
  ) => (
    <DrawerField
      label={label}
      htmlFor={`setup-${field}`}
      required={field !== 'state'}
      error={field === 'state' ? undefined : problemText(problems[field], label)}
      span={field === 'state' ? 'full' : 'half'}
    >
      <DrawerInput
        id={`setup-${field}`}
        capitalize
        maxLength={maxLength}
        aria-invalid={field === 'state' ? undefined : problems[field] !== undefined}
        data-testid={`setup-location-${field}`}
        {...form.register(field)}
      />
    </DrawerField>
  );

  return (
    <div className="flex flex-col gap-3">
      <DrawerField
        htmlFor="setup-address"
        error={problemText(problems.addressLine, t(K.address))}
      >
        <DrawerInput
          id="setup-address"
          capitalize
          maxLength={BRANCH_LIMITS.address}
          autoComplete="street-address"
          aria-labelledby={titleId}
          aria-invalid={problems.addressLine !== undefined}
          className="text-base"
          data-setup-autofocus
          data-testid="setup-question-address-input"
          {...form.register('addressLine')}
        />
      </DrawerField>
      {showFields ? (
        <DrawerFieldGrid>
          {placeField('area', t(K.area), BRANCH_LIMITS.place)}
          {placeField('city', t(K.city), BRANCH_LIMITS.place)}
          {placeField('state', t(K.state), BRANCH_LIMITS.state)}
        </DrawerFieldGrid>
      ) : (
        <div
          className="flex min-w-0 items-center gap-2"
          data-testid="setup-question-address-place"
        >
          <MapPin aria-hidden className="text-muted-foreground size-4 flex-none" />
          <span className="text-detail text-foreground min-w-0 truncate">
            {placeLine}
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0"
            onClick={() => setEditing(true)}
            data-testid="setup-question-address-edit"
          >
            {t(SETUP_KEYS.steps.address.edit)}
          </Button>
        </div>
      )}
      <PinAreaChips
        place={place}
        area={values.area}
        onAreaChange={(area) => form.setValue('area', area, { shouldDirty: true })}
        testId="setup-location"
      />
    </div>
  );
}

/** "What's the clinic's phone number?" — +91 and ten digits; a default it does not show is named here. */
function PhoneQuestion({
  form,
  titleId,
  problems,
}: {
  form: UseFormReturn<LocationFormValues>;
  titleId: string;
  problems: Problems;
}) {
  const { t } = useTranslation(SETUP_NS);
  const problemText = useProblemText();
  // The branch name and the email are not asked (D2); one the server would refuse is said here.
  const hidden =
    problemText(problems.name, t(K.branchName)) ??
    problemText(problems.email, t(K.email));
  return (
    <div className="flex flex-col gap-3">
      <DrawerField htmlFor="setup-phone" error={problemText(problems.phone, t(K.phone))}>
        <Controller
          control={form.control}
          name="phone"
          render={({ field }) => (
            <DrawerPhoneInput
              id="setup-phone"
              ref={field.ref}
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onChange={field.onChange}
              aria-labelledby={titleId}
              aria-invalid={problems.phone !== undefined}
              data-setup-autofocus
              data-testid="setup-question-phone-input"
            />
          )}
        />
      </DrawerField>
      {hidden ? (
        <p role="alert" className="text-destructive text-xs">
          {hidden}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Step 2, "Where is your clinic?", as three questions (change-setup-one-question; KICKOFF §6): the
 * PIN (its sixth digit fills area, city and state from the bundled directory and moves on — an
 * unknown PIN fills nothing and blocks nothing), the street address, the phone. The phone's Next
 * creates the branch — named after the clinic, with the owner's email and the default hours — with
 * the owner on its team; the clinic's first branch becomes its main branch (RC-4). A main branch
 * made meanwhile (another admin, the Branches room) counts: the step reads the setup again first and
 * creates none — a change typed over one already made is saved to it.
 */
export function SetupLocationStep({
  formId,
  titleId,
  form,
  question,
  onQuestionChange,
  onSaveState,
  onSaved,
}: SetupLocationStepProps) {
  const { t } = useTranslation(SETUP_NS);
  const problemText = useProblemText();
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const { isDirty } = useFormState({ control: form.control });
  const { lookUp, areaFor } = usePinPlace();
  const [problems, setProblems] = useState<Problems>({});

  /** The setup as it stands, written to the cache the drawer reads. */
  const readSetup = () =>
    queryClient.query({
      queryKey: onboardingSetupQueryKeys.detail(organizationId),
      queryFn: fetchOnboardingSetup,
      staleTime: 0,
    });

  const saveLocation = useAppMutation({
    mutationFn: async (
      input: { values: LocationFormValues; changed: boolean },
      action,
    ) => {
      const current = await readSetup();
      if (current.liveChecks.main_branch) {
        // Made already — by this setup or elsewhere: what was typed over it goes to that branch.
        if (!input.changed) return;
        const main = (await fetchBranches()).find((branch) => branch.isMain);
        if (!main) return;
        await saveBranch({
          save: { branch: main, input: locationBranchUpdate(main, input.values) },
          idempotencyKey: action.idempotencyKey,
        });
        return;
      }
      // No team named: clinozy-be puts the creator on it (D13) — never a membership id read from
      // a me/context cached before this workspace existed.
      await saveBranch({
        save: { input: locationBranchInput(input.values) },
        idempotencyKey: action.idempotencyKey,
      });
      // The drawer moves on only once the setup it reads knows the main branch — else it would
      // find step 3 still locked and put itself back here.
      await readSetup();
    },
    invalidateKeys: [branchQueryKeys.all],
  });

  /** A known PIN fills city, state and — when it has one — the area. */
  const fillFromPin = async (pin: string) => {
    const found = await lookUp(pin);
    if (!found) return;
    form.setValue('city', found.district, { shouldDirty: true });
    form.setValue('state', found.state, { shouldDirty: true });
    const area = areaFor(found, form.getValues('area'));
    if (area !== undefined) form.setValue('area', area, { shouldDirty: true });
  };

  /** The PIN as typed: its sixth digit fills the place and moves on (D7). */
  const onPin = (pin: string) => {
    setProblems({});
    if (pin.length < BRANCH_LIMITS.pin) return;
    if (!PIN_CODE_PATTERN.test(pin)) {
      setProblems({ pin: 'pin' });
      return;
    }
    void fillFromPin(pin).then(() => {
      if (form.getValues('pin') === pin) onQuestionChange('address');
    });
  };

  /** Next: this question's answer checked, then the next question — or, on the phone, the branch. */
  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = form.getValues();
    // The first question up to this one with a gap: this one, or one before it a refresh cleared.
    const asked = LOCATION_QUESTIONS.slice(0, LOCATION_QUESTIONS.indexOf(question) + 1);
    const gap = asked.find(
      (each) => Object.keys(locationQuestionProblems(values, each)).length > 0,
    );
    if (gap !== undefined && gap !== question) {
      onQuestionChange(gap);
      return;
    }
    if (gap !== undefined) {
      const found = locationQuestionProblems(values, gap);
      setProblems(found);
      const first = LOCATION_QUESTION_FIELDS[gap].find(
        (field) => found[field] !== undefined && field !== 'name' && field !== 'email',
      );
      if (first) form.setFocus(first);
      return;
    }
    setProblems({});
    if (question === 'pin') {
      await fillFromPin(values.pin);
      onQuestionChange('address');
      return;
    }
    if (question === 'address') {
      onQuestionChange('phone');
      return;
    }
    onSaveState('saving');
    try {
      await saveLocation.mutateAsync({ values, changed: isDirty });
      resetFormInPlace(form, form.getValues());
      setupEvents.stepCompleted('location');
      onSaveState('idle');
      onSaved();
    } catch {
      onSaveState('failed');
    }
  };

  let body: ReactNode;
  if (question === 'pin') {
    body = (
      <PinQuestion
        form={form}
        titleId={titleId}
        error={problemText(problems.pin, t(K.pin))}
        onPin={onPin}
      />
    );
  } else if (question === 'address') {
    body = <AddressQuestion form={form} titleId={titleId} problems={problems} />;
  } else {
    body = <PhoneQuestion form={form} titleId={titleId} problems={problems} />;
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-3">
      {body}
    </form>
  );
}
