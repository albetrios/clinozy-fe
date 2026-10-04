import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { CheckIn } from '@/shared/api/clinic/clinic-schema.ts';
import type { CheckInSaved } from '@/shared/api/clinic/feedback-contracts.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useCheckInContext } from '@/shared/hooks/useFeedback/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { useOfferings } from '@/shared/hooks/useOfferings/index.ts';
import { notify } from '@/shared/notify/index.ts';

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
  checkIn: CheckIn | null;
  /** The visit and the treatment it follows (`?appointment=&treatment=`, or the record's own). */
  appointmentId: string | null;
  treatmentId: string | null;
  /** Today's civil date — a new check-in's day. */
  today: string;
  onClose: () => void;
}

/** "Check-in saved for Dharti Galani · 2 added to suggestions · doctor call-back task created". */
function savedMessage(t: TFunction, patientName: string, saved: CheckInSaved): string {
  return [
    t(K.saved, { name: patientName }),
    saved.suggestionsAdded > 0 ? t(K.added, { count: saved.suggestionsAdded }) : '',
    saved.callBackCreated ? t(K.callBack) : '',
  ].join('');
}

/**
 * Visit / Aftercare check-in — `check-ins/create/`, `check-ins/$checkInId/edit/`
 * (KICKOFF §6.6 Drawers; H:4396; `patient-file.md:171–187, 383–390`): 680px,
 * "Aftercare check-in" when it follows a treatment, "Visit check-in"
 * otherwise; steps "How is it now" → "What they followed" → "Next plan of
 * action", each head naming its values. No feel → "Pick how it is now"; else
 * "Check-in saved for Dharti Galani" with " · 2 added to suggestions" and
 * " · doctor call-back task created" when the server set them off, or
 * "Check-in updated".
 */
export function CheckInDrawer({
  patientId,
  patientName,
  checkIn,
  appointmentId,
  treatmentId,
  today,
  onClose,
}: CheckInDrawerProps) {
  const { t } = useTranslation(CHECK_IN_NS);
  const context = useCheckInContext(patientId, {
    appointmentId,
    treatmentId,
    editingId: checkIn?.id ?? null,
  });
  const offerings = useOfferings({ notifyOnError: false });
  const form = useForm<CheckInFormValues>({
    defaultValues: checkIn ? checkInFormOf(checkIn) : newCheckInForm(),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [step, setStep] = useState<string>('now');
  const head = useCheckInHead({
    patientName,
    aftercare: treatmentId !== null,
    context: context.data,
  });
  const options = useCheckInOfferingOptions(offerings.data ?? [], values.nextOfferingIds);
  const views = useCheckInStepsView(
    values,
    options.filter((option) => values.nextOfferingIds.includes(option.key)),
  );
  const previous = context.data?.previous ?? null;

  const { saveState, save } = useCheckInSave({
    form,
    checkIn,
    place: () => ({
      patientId,
      appointmentId,
      treatmentId,
      context: checkIn?.context ?? head.context,
      date: checkIn?.date ?? today,
    }),
    onStep: setStep,
    onDone: (saved) => {
      notify.success(checkIn ? t(K.updated) : savedMessage(t, patientName, saved));
      onClose();
    },
  });

  const steps: DrawerStep[] = [
    {
      id: 'now',
      title: t(K.steps.now),
      ...views.now,
      content: <CheckInNowFields form={form} values={values} previous={previous} />,
    },
    {
      id: 'followed',
      title: t(K.steps.followed),
      ...views.followed,
      content: <CheckInFollowedFields form={form} values={values} previous={previous} />,
    },
    {
      id: 'next',
      title: t(K.steps.next),
      ...views.next,
      content: <CheckInNextFields form={form} values={values} options={options} />,
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
      saveLabel={t(checkIn ? K.saveEdit : K.save)}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty}
      testId={CHECK_IN_TEST_ID}
    />
  );
}
