import { useTranslation } from 'react-i18next';

import { localDateOf } from '@/shared/api/app/app-time.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { useStaffMember } from '../../../shared/components/PatientStaffPicker/index.ts';
import { TREATMENT_KEYS, TREATMENT_NS } from '../../treatments.constants.ts';
import { AFTERCARE_CALLS, type TreatmentFormValues } from './treatment-form.ts';
import { treatmentDetailsPeek } from './treatment-template-peek.ts';

const K = TREATMENT_KEYS;

/** A step's head and peek — the drawer adds its fields. */
type TreatmentStepHead = Omit<DrawerStep, 'content'>;

/** The three steps' heads and peeks, by step. */
export interface TreatmentStepsView {
  session: TreatmentStepHead;
  details: TreatmentStepHead;
  aftercare: TreatmentStepHead;
}

/**
 * The drawer's three steps without their fields (H:4811–4827): 1 "Session",
 * 2 "<template> details", 3 "Aftercare" — each collapsed card peeks its
 * fields (the doctor and therapist as pills). `session` is the session number
 * as the drawer shows it — the package's words while the server numbers it.
 */
export function useTreatmentStepsView(
  values: TreatmentFormValues,
  session: string,
): TreatmentStepsView {
  const { t } = useTranslation(TREATMENT_NS);
  const { formatDate } = useLocaleFormat();
  const doctor = useStaffMember(values.doctorId);
  const therapist = useStaffMember(values.therapistId);
  const name = values.name.trim();
  const remark = values.remark.trim();
  const call = t(K.aftercare.calls[values.aftercareCall]);
  const callTone = AFTERCARE_CALLS.find(
    (entry) => entry.call === values.aftercareCall,
  )?.tone;
  const details = treatmentDetailsPeek(values, t, (day) =>
    formatDate(
      localDateOf(day),
      { day: 'numeric', month: 'short', year: 'numeric' },
      { civilDay: true },
    ),
  );

  return {
    session: {
      id: 'session',
      title: t(K.steps.session),
      peek: [
        { kind: 'value', label: t(K.name), value: name || undefined },
        { kind: 'value', label: t(K.sessionNo), value: session },
        {
          kind: 'value',
          label: t(K.doctor),
          value: doctor.shortName || undefined,
          tone: doctor.person?.tone,
        },
        {
          kind: 'value',
          label: t(K.therapist),
          value: therapist.shortName || undefined,
          tone: therapist.person?.tone,
        },
      ],
    },
    details: {
      id: 'details',
      title: t(K.steps.details, { template: t(K.templates[values.template]) }),
      peek: details,
    },
    aftercare: {
      id: 'aftercare',
      title: t(K.steps.aftercare),
      peek: [
        { kind: 'value', label: t(K.aftercare.remark), value: remark || undefined },
        { kind: 'value', label: t(K.aftercare.call), value: call, tone: callTone },
      ],
    },
  };
}
