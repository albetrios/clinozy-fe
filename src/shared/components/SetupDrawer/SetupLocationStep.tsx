import { useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useEffect, useState } from 'react';
import { Controller, useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { type Weekday, WEEKDAY_VALUES } from '@/shared/api/app/app-schema.ts';
import { branchQueryKeys } from '@/shared/api/app/branches-api.ts';
import { BRANCH_LIMITS } from '@/shared/api/app/branches-contracts.ts';
import { saveBranch } from '@/shared/api/app/branches-manage-api.ts';
import {
  fetchOnboardingSetup,
  onboardingSetupQueryKeys,
} from '@/shared/api/app/onboarding-setup-api.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  DrawerPhoneInput,
} from '@/shared/components/DrawerField/index.ts';
import { nextTimeSlot, TimePicker } from '@/shared/components/Picker/TimePicker/index.ts';
import {
  PIN_PLACE_KEYS,
  PIN_PLACE_NS,
  PinAreaChips,
} from '@/shared/components/PinAreaChips/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { useHoursFormat } from '@/shared/hooks/useHoursFormat/index.ts';
import { usePinPlace } from '@/shared/hooks/usePinPlace/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { setupEvents } from './setup-analytics.ts';
import { SETUP_KEYS, SETUP_NS } from './setup-drawer.constants.ts';
import {
  initialLocationForm,
  locationBranchInput,
  type LocationField,
  type LocationFormValues,
  type LocationProblem,
  locationProblems,
} from './setup-location-form.ts';
import type { SetupStepProps } from './setup-step-props.ts';

const K = SETUP_KEYS.steps.location;

/** The most areas offered as chips under the PIN; the field stays editable either way. */

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
      case 'hours':
        return t(K.closesAfterOpens);
      default:
        return undefined;
    }
  };
}

/**
 * The hours on one line — "Open Mon–Sat · 10:00–20:00 · Change" — and, opened, the branch's days
 * and times (KICKOFF §6.1; F18).
 */
function LocationHours({
  form,
  values,
  open,
  onOpenChange,
  closesError,
}: {
  form: UseFormReturn<LocationFormValues>;
  values: LocationFormValues;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closesError: string | undefined;
}) {
  const { t } = useTranslation(SETUP_NS);
  const hours = useHoursFormat();
  return (
    <>
      <div className="flex min-w-0 items-center gap-2" data-testid="setup-location-hours">
        <span className="text-detail text-foreground min-w-0 truncate">
          {t(K.hours, {
            days: hours.days(values.workingDays),
            opens: values.opensAt,
            closes: values.closesAt,
          })}
        </span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0"
          aria-expanded={open}
          data-testid="setup-location-hours-change"
          onClick={() => onOpenChange(!open)}
        >
          {open ? t(K.done) : t(K.change)}
        </Button>
      </div>
      {open ? (
        <DrawerFieldGrid>
          <DrawerField label={t(K.days)}>
            <DrawerChips<Weekday>
              multiple
              label={t(K.days)}
              options={WEEKDAY_VALUES.map((day) => ({
                value: day,
                label: hours.weekday(day),
              }))}
              value={values.workingDays}
              onChange={(days) =>
                form.setValue('workingDays', days, { shouldDirty: true })
              }
              testId="setup-location-days"
            />
          </DrawerField>
          <DrawerField span="half" label={t(K.opens)}>
            <TimePicker
              value={values.opensAt}
              label={t(K.opens)}
              onChange={(time) => {
                form.setValue('opensAt', time, { shouldDirty: true });
                if (form.getValues('closesAt') <= time) {
                  form.setValue('closesAt', nextTimeSlot(time), { shouldDirty: true });
                }
              }}
              testId="setup-location-opens"
            />
          </DrawerField>
          <DrawerField span="half" label={t(K.closes)} error={closesError}>
            <TimePicker
              value={values.closesAt}
              label={t(K.closes)}
              from={nextTimeSlot(values.opensAt)}
              onChange={(time) => form.setValue('closesAt', time, { shouldDirty: true })}
              invalid={closesError !== undefined}
              testId="setup-location-closes"
            />
          </DrawerField>
        </DrawerFieldGrid>
      ) : null}
    </>
  );
}

/** The PIN: digits only, six at most; the sixth looks the place up (D27). */
function PinInput({
  form,
  invalid,
  onPin,
}: {
  form: UseFormReturn<LocationFormValues>;
  invalid: boolean;
  onPin: (pin: string) => Promise<void>;
}) {
  return (
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
          aria-invalid={invalid}
          data-testid="setup-location-pin"
          onChange={(event) => {
            const pin = event.currentTarget.value.replaceAll(/\D/g, '').slice(0, 6);
            field.onChange(pin);
            void onPin(pin);
          }}
        />
      )}
    />
  );
}

/**
 * Step 2, "Where is your clinic?" (KICKOFF §6.1; BRIEF.md:59–64): the PIN fills area, city and
 * state from the bundled directory (every field stays editable; an unknown PIN fills nothing and
 * blocks nothing), then the address, phone, email and branch name — the clinic's name. The hours
 * are one line; "Change" opens the days and times. "Next" creates the branch with the owner on its
 * team — the clinic's first branch becomes its main branch (RC-4). A main branch made meanwhile
 * (another admin, the Branches room) counts: the step reads the setup again first and creates none.
 */
export function SetupLocationStep({
  formId,
  profile,
  onDirtyChange,
  onSaveState,
  onSaved,
}: SetupStepProps) {
  const { t } = useTranslation(SETUP_NS);
  const { t: tPin } = useTranslation(PIN_PLACE_NS);
  const problemText = useProblemText();
  const email = useAuthStore((state) => state.user?.email ?? '');
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const form = useForm<LocationFormValues>({
    defaultValues: initialLocationForm({ clinicName: profile.name, email }),
  });
  const { isDirty } = useFormState({ control: form.control });
  const [problems, setProblems] = useState<ReturnType<typeof locationProblems>>({});
  const { place, lookUp, areaFor } = usePinPlace();
  const [hoursOpen, setHoursOpen] = useState(false);
  const values = useFormValues(form);

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  /** The setup as it stands, written to the cache the drawer reads. */
  const readSetup = () =>
    queryClient.query({
      queryKey: onboardingSetupQueryKeys.detail(organizationId),
      queryFn: fetchOnboardingSetup,
      staleTime: 0,
    });

  const createBranch = useAppMutation({
    mutationFn: async (input: LocationFormValues, action) => {
      const current = await readSetup();
      if (current.liveChecks.main_branch) return;
      // No team named: clinozy-be puts the creator on it (D13) — never a membership id read from
      // a me/context cached before this workspace existed.
      await saveBranch({
        save: { input: locationBranchInput(input) },
        idempotencyKey: action.idempotencyKey,
      });
      // The drawer moves on only once the setup it reads knows the main branch — else it would
      // find step 3 still locked and put itself back here.
      await readSetup();
    },
    invalidateKeys: [branchQueryKeys.all],
  });

  const onPin = async (pin: string) => {
    const found = await lookUp(pin);
    if (!found) return;
    form.setValue('city', found.district, { shouldDirty: true });
    form.setValue('state', found.state, { shouldDirty: true });
    const area = areaFor(found, form.getValues('area'));
    if (area !== undefined) form.setValue('area', area, { shouldDirty: true });
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = locationProblems(form.getValues());
    setProblems(found);
    const first = Object.keys(found)[0];
    if (first) {
      if (first === 'closesAt') setHoursOpen(true);
      else form.setFocus(first as LocationField);
      return;
    }
    onSaveState('saving');
    try {
      await createBranch.mutateAsync(form.getValues());
      setupEvents.stepCompleted('location');
      onSaveState('idle');
      onSaved();
    } catch {
      onSaveState('failed');
    }
  };

  const text = (
    field: Exclude<LocationField, 'phone' | 'pin'> | 'state',
    label: string,
    extra: {
      type?: string;
      capitalize?: boolean;
      maxLength: number;
      autoComplete?: string;
    },
  ) => (
    <DrawerField
      label={label}
      htmlFor={`setup-${field}`}
      required={field !== 'state'}
      error={field === 'state' ? undefined : problemText(problems[field], label)}
      span={field === 'addressLine' || field === 'name' ? 'full' : 'half'}
    >
      <DrawerInput
        id={`setup-${field}`}
        type={extra.type ?? 'text'}
        capitalize={extra.capitalize ?? true}
        maxLength={extra.maxLength}
        autoComplete={extra.autoComplete}
        aria-invalid={field === 'state' ? undefined : problems[field] !== undefined}
        data-testid={`setup-location-${field}`}
        {...form.register(field)}
      />
    </DrawerField>
  );

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-3">
      <p className="text-muted-foreground text-detail">{t(K.why)}</p>
      <DrawerFieldGrid>
        <DrawerField
          label={t(K.pin)}
          hint={tPin(PIN_PLACE_KEYS.hint)}
          htmlFor="setup-pin"
          required
          error={problemText(problems.pin, t(K.pin))}
          span="half"
        >
          <PinInput form={form} invalid={problems.pin !== undefined} onPin={onPin} />
        </DrawerField>
        {text('area', t(K.area), { maxLength: BRANCH_LIMITS.place })}
        {text('city', t(K.city), { maxLength: BRANCH_LIMITS.place })}
        {text('state', t(K.state), { maxLength: BRANCH_LIMITS.state })}
      </DrawerFieldGrid>
      <PinAreaChips
        place={place}
        area={values.area}
        onAreaChange={(area) => form.setValue('area', area, { shouldDirty: true })}
        testId="setup-location"
      />
      <DrawerFieldGrid>
        {text('addressLine', t(K.address), {
          maxLength: BRANCH_LIMITS.address,
          autoComplete: 'street-address',
        })}
        <DrawerField
          label={t(K.phone)}
          htmlFor="setup-phone"
          required
          error={problemText(problems.phone, t(K.phone))}
          span="half"
        >
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
                aria-invalid={problems.phone !== undefined}
                data-testid="setup-location-phone"
              />
            )}
          />
        </DrawerField>
        {text('email', t(K.email), {
          type: 'email',
          capitalize: false,
          maxLength: BRANCH_LIMITS.email,
          autoComplete: 'email',
        })}
        {text('name', t(K.branchName), { maxLength: BRANCH_LIMITS.name })}
      </DrawerFieldGrid>

      <LocationHours
        form={form}
        values={values}
        open={hoursOpen}
        onOpenChange={setHoursOpen}
        closesError={problemText(problems.closesAt, t(K.closes))}
      />
    </form>
  );
}
