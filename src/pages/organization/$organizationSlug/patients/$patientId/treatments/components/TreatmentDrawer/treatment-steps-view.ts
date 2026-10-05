import { useTranslation } from 'react-i18next';

import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import {
  type DrawerStep,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { useStaffMember } from '../../../shared/components/PatientStaffPicker/index.ts';
import { TREATMENT_KEYS, TREATMENT_NS } from '../../treatments.constants.ts';
import { AFTERCARE_CALLS, type TreatmentFormValues } from './treatment-form.ts';
import { treatmentDetailsView } from './treatment-template-peek.ts';

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
 * fields (the doctor and therapist as pills), and each head names its first
 * four values (H:3840).
 */
export function useTreatmentStepsView(values: TreatmentFormValues): TreatmentStepsView {
  const { t } = useTranslation(TREATMENT_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const { formatDate } = useLocaleFormat();
  const doctor = useStaffMember(values.doctorId);
  const therapist = useStaffMember(values.therapistId);
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const name = values.name.trim();
  const sessionNo = String(values.sessionNo);
  const remark = values.remark.trim();
  const call = t(K.aftercare.calls[values.aftercareCall]);
  const callTone = AFTERCARE_CALLS.find(
    (entry) => entry.call === values.aftercareCall,
  )?.tone;
  const details = treatmentDetailsView(values, t, (day) =>
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
      summary: drawerStepSummary(
        [name, sessionNo, doctor.shortName, therapist.shortName],
        notFilled,
      ),
      peek: [
        { kind: 'value', label: t(K.name), value: name || undefined },
        { kind: 'value', label: t(K.sessionNo), value: sessionNo },
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
      summary: drawerStepSummary(details.filled, notFilled),
      peek: details.peek,
    },
    aftercare: {
      id: 'aftercare',
      title: t(K.steps.aftercare),
      summary: drawerStepSummary([remark, call], notFilled),
      peek: [
        { kind: 'value', label: t(K.aftercare.remark), value: remark || undefined },
        { kind: 'value', label: t(K.aftercare.call), value: call, tone: callTone },
      ],
    },
  };
}
