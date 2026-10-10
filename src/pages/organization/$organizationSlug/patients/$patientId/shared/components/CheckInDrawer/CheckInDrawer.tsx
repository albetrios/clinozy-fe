import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { feedbackQueryKeys, fetchCheckIn } from '@/shared/api/clinic/feedback-api.ts';
import type { PatientCheckIn } from '@/shared/api/clinic/feedback-contracts.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import {
  useCheckInContext,
  useCheckInOfferings,
} from '@/shared/hooks/useFeedback/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { CHECK_IN_KEYS, CHECK_IN_NS, CHECK_IN_TEST_ID } from './check-in.constants.ts';
import {
  checkInFormOf,
  type CheckInFormValues,
  newCheckInForm,
} from './check-in-form.ts';
import {
  CheckInFollowedFields,
  CheckInNextFields,
  CheckInNowFields,
} from './check-in-steps.tsx';
import {
  useCheckInHead,
  useCheckInOfferingOptions,
  useCheckInStepsView,
} from './check-in-view.ts';
import { useCheckInSave } from './use-check-in-save.ts';

const K = CHECK_IN_KEYS;

/** Props of {@link CheckInDrawer}. */
export interface CheckInDrawerProps {
  patientId: string;
  /** The patient's full name — the sub line and the saved toast. */
  patientName: string;
  /** The check-in a card's Edit opens; null for a new one. */
  checkIn: PatientCheckIn | null;
  /** The visit and the treatment it follows (`?appointment=&treatment=`, or the record's own). */
  appointmentId: string | null;
  treatmentId: string | null;
  /** Today's civil date — a new check-in's day. */
  today: string;
  /** Stacked over another drawer (the Treatment drawer's "Log check-in"): Back closes it. */
  stacked?: boolean;
  onClose: () => void;
}

/**
 * "Check-in saved for Dharti Galani · 2 added to suggestions · doctor call-back task created" —
 * from the server's answer: the offerings it planned (one the plan held is skipped, TR10) and
 * whether it needs action, which is when it opened the call-back (TR4).
 */
function savedMessage(t: TFunction, patientName: string, saved: PatientCheckIn): string {
  const added = saved.nextOfferingIds.length;
  return [
    t(K.saved, { name: patientName }),
    added > 0 ? t(K.added, { count: added }) : '',
    saved.needsAction ? t(K.callBack) : '',
  ].join('');
}

/**
 * An edit's record, kept in step with a reload: a save refused as stale (`409
 * record_changed`) reads the check-in again and restarts the form on what was saved.
 */
function useEditingCheckIn(
  checkIn: PatientCheckIn | null,
  reset: (record: PatientCheckIn) => void,
) {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const [record, setRecord] = useState(checkIn);
  const reload = async () => {
    if (!record) return;
    const fresh = await queryClient.query({
      queryKey: feedbackQueryKeys.checkIn(organizationId, record.id),
      queryFn: () => fetchCheckIn(record.patientId, record.id),
      staleTime: 0,
    });
    setRecord(fresh);
    reset(fresh);
  };
  return { record, reload };
}

/**
 * Visit / Aftercare check-in — `check-ins/create/`, `check-ins/$checkInId/edit/`
 * (KICKOFF §6.6 Drawers; H:4396; `patient-file.md:171–187, 383–390`): 680px,
 * "Aftercare check-in" when it follows a treatment, "Visit check-in"
 * otherwise; steps "How is it now" → "What they followed" → "Next plan of
 * action", each head naming its values. No feel → "Pick how it is now", no
 * score → "Pick the patient’s score"; else "Check-in saved for Dharti Galani"
 * with " · 2 added to suggestions" and " · doctor call-back task created" when
 * the server set them off, or "Check-in updated".
 */
export function CheckInDrawer({
  patientId,
  patientName,
  checkIn,
  appointmentId,
  treatmentId,
  today,
  stacked = false,
  onClose,
}: CheckInDrawerProps) {
  const { t } = useTranslation(CHECK_IN_NS);
  const form = useForm<CheckInFormValues>({
    defaultValues: checkIn ? checkInFormOf(checkIn) : newCheckInForm(),
  });
  const { record, reload } = useEditingCheckIn(checkIn, (fresh) =>
    form.reset(checkInFormOf(fresh)),
  );
  const context = useCheckInContext(patientId, {
    appointmentId,
    treatmentId,
    editing: record,
  });
  const offerings = useCheckInOfferings();
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [step, setStep] = useState<string>('now');
  const head = useCheckInHead({
    patientName,
    aftercare: treatmentId !== null,
    context,
  });
  const options = useCheckInOfferingOptions(offerings.data ?? [], values.nextOfferingIds);
  const views = useCheckInStepsView(
    values,
    options.filter((option) => values.nextOfferingIds.includes(option.key)),
  );

  const { saveState, save } = useCheckInSave({
    form,
    checkIn: record,
    place: { patientId, appointmentId, treatmentId, date: today },
    onStep: setStep,
    onStale: record ? () => void reload() : undefined,
    onDone: (saved) => {
      notify.success(record ? t(K.updated) : savedMessage(t, patientName, saved));
      onClose();
    },
  });

  const steps: DrawerStep[] = [
    {
      id: 'now',
      title: t(K.steps.now),
      ...views.now,
      content: (
        <CheckInNowFields form={form} values={values} previous={context.previous} />
      ),
    },
    {
      id: 'followed',
      title: t(K.steps.followed),
      ...views.followed,
      content: (
        <CheckInFollowedFields form={form} values={values} previous={context.previous} />
      ),
    },
    {
      id: 'next',
      title: t(K.steps.next),
      ...views.next,
      content: (
        <CheckInNextFields
          form={form}
          values={values}
          options={options}
          editing={record !== null}
        />
      ),
    },
  ];

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={head.title}
      sub={head.sub}
      // 680px as drawn (H:4396): three textareas and the score's ten chips.
      content={{ fieldCount: 7, hasHeavyField: true }}
      tone="sage"
      steps={steps}
      openStep={step}
      onOpenStepChange={setStep}
      saveLabel={t(record ? K.saveEdit : K.save)}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty}
      stacked={stacked}
      testId={CHECK_IN_TEST_ID}
    />
  );
}
