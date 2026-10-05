import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { Treatment, TreatmentTemplate } from '@/shared/api/clinic/clinic-schema.ts';
import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-api.ts';
import type { TreatmentCheckIn } from '@/shared/api/clinic/treatments-api.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useStaffMember } from '../../../shared/components/PatientStaffPicker/index.ts';
import {
  TREATMENT_KEYS,
  TREATMENT_NS,
  TREATMENT_TEST_ID,
} from '../../treatments.constants.ts';
import { TreatmentDeleteConfirm } from './treatment-delete-confirm.tsx';
import {
  newTreatmentForm,
  nextSessionForm,
  rememberTemplate,
  templateTone,
  treatmentFormOf,
  type TreatmentFormValues,
  withTemplate,
} from './treatment-form.ts';
import {
  TreatmentAftercareFields,
  type TreatmentNameChip,
  TreatmentSessionFields,
} from './treatment-step-fields.tsx';
import { useTreatmentStepsView } from './treatment-steps-view.ts';
import { TreatmentTemplateFields } from './treatment-template-fields.tsx';
import { TreatmentTypeSwitch } from './treatment-type-switch.tsx';
import { useTreatmentSave } from './use-treatment-save.ts';

const K = TREATMENT_KEYS;

/** Props of {@link TreatmentDrawer}. */
export interface TreatmentDrawerProps {
  /** The treatment an edit opens, with its check-ins; null for a new one. */
  treatment: { treatment: Treatment; checkIns: TreatmentCheckIn[] } | null;
  patientId: string;
  /** The patient's last treatment — "Next session of …" and the template to start with. */
  last: Treatment | undefined;
  /** The patient's packages with sessions left — one Quick fill chip each. */
  packages: readonly PatientPackageRow[];
  /** The treatments the name field offers as chips. */
  names: readonly TreatmentNameChip[];
  /** Who a new treatment starts with. */
  staff: { doctorId: string | null; therapistId: string | null };
  template: TreatmentTemplate;
  /** Doctor, Therapist, Owner (`S:38–39`); anyone else reads it. */
  writable: boolean;
  canDelete: boolean;
  /**
   * An edit's ⚡ "Log check-in" (`patient-file.md:278`): opens the check-in
   * drawer for this treatment, stacked over this one — on a read-only drawer
   * too, the check-in being Patients Edit's. Absent — no chip (a new
   * treatment, or a member who may not check in).
   */
  onLogCheckIn?: () => void;
  onClose: () => void;
}

/**
 * The Quick fill chips (H:4828): "Log check-in" (edit), "Next session of …"
 * (new) and one per package.
 */
function quickFillItems({
  form,
  editing,
  last,
  packages,
  onLogCheckIn,
  t,
}: {
  form: UseFormReturn<TreatmentFormValues>;
  editing: boolean;
  last: Treatment | undefined;
  packages: readonly PatientPackageRow[];
  onLogCheckIn: (() => void) | undefined;
  t: TFunction;
}): QuickFillItem[] {
  const fill = (values: TreatmentFormValues) =>
    form.reset(values, { keepDefaultValues: true, keepErrors: true });
  const items: QuickFillItem[] = [];
  if (editing && onLogCheckIn) {
    items.push({
      id: 'check-in',
      label: t(K.quickFill.checkIn),
      tone: 'sage',
      // A check-in is its own record (Patients Edit): offered on a read-only
      // drawer too, as the row's "Check-in" is.
      keepWhenReadOnly: true,
      onSelect: onLogCheckIn,
    });
  }
  if (!editing && last) {
    items.push({
      id: 'next',
      label: t(K.quickFill.next, { name: last.name }),
      tone: 'sky',
      onSelect: () => fill(nextSessionForm(last, form.getValues())),
    });
  }
  for (const row of packages) {
    if (!row.offering || row.package.sessionsUsed >= row.package.sessionsTotal) continue;
    const { offering } = row;
    const session = row.package.sessionsUsed + 1;
    items.push({
      id: `package-${row.package.id}`,
      label: t(K.quickFill.package, { name: offering.name, session }),
      tone: offering.tone,
      onSelect: () =>
        fill({
          ...form.getValues(),
          name: offering.name,
          offeringId: offering.id,
          packageId: row.package.id,
          sessionNo: session,
        }),
    });
  }
  return items;
}

/**
 * The Treatment drawer — `treatments/create/` and
 * `treatments/$treatmentId/edit/` (KICKOFF §6.6 Drawers; H:4811–4828;
 * `patient-file.md:123–141, 360–372`): 680px, "New treatment" / "Edit
 * treatment" (the contract numbers no treatment, so no tag), "Fields follow
 * the clinic specialty · switch if needed", the template and session badges;
 * Quick fill "Log check-in" (edit), "Next session of …" (new) and one chip per
 * package; the Type switch;
 * three steps. Nothing is required — a blank name saves as "Treatment"
 * (A-F11). "Treatment saved", and the template is remembered for the next.
 */
export function TreatmentDrawer({
  treatment,
  patientId,
  last,
  packages,
  names,
  staff,
  template,
  writable,
  canDelete,
  onLogCheckIn,
  onClose,
}: TreatmentDrawerProps) {
  const { t } = useTranslation(TREATMENT_NS);
  const form = useForm<TreatmentFormValues>({
    defaultValues: treatment
      ? treatmentFormOf(treatment.treatment)
      : newTreatmentForm(template, staff, last),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [step, setStep] = useState<string>('session');
  const [deleting, setDeleting] = useState(false);

  const doctorName = useStaffMember(values.doctorId).shortName;
  const templateLabel = t(K.templates[values.template]);
  const session = t(K.session, { session: values.sessionNo });
  const readOnly = !writable;

  const { saveState, save } = useTreatmentSave({
    form,
    treatment: treatment?.treatment ?? null,
    patientId,
    onStep: setStep,
    onDone: (saved) => {
      rememberTemplate(saved.template);
      notify.success(t(K.save.saved));
      onClose();
    },
  });

  const view = useTreatmentStepsView(values);
  const steps: DrawerStep[] = [
    {
      ...view.session,
      content: (
        <TreatmentSessionFields
          form={form}
          values={values}
          names={names}
          readOnly={readOnly}
        />
      ),
    },
    {
      ...view.details,
      content: (
        <TreatmentTemplateFields
          values={values}
          setParam={(key, value) =>
            form.setValue(
              'params',
              { ...form.getValues('params'), [key]: value },
              { shouldDirty: true },
            )
          }
          setAreas={(areas) => form.setValue('areas', areas, { shouldDirty: true })}
          readOnly={readOnly}
          testId={TREATMENT_TEST_ID}
        />
      ),
    },
    {
      ...view.aftercare,
      content: (
        <TreatmentAftercareFields
          form={form}
          values={values}
          checkIns={treatment?.checkIns}
          readOnly={readOnly}
        />
      ),
    },
  ];

  return (
    <>
      <RecordDrawer
        open
        onClose={onClose}
        title={t(treatment ? K.title.edit : K.title.create)}
        sub={t(K.sub)}
        badges={[
          { id: 'template', label: templateLabel, tone: templateTone(values.template) },
          { id: 'session', label: session, tone: 'butter' },
        ]}
        quickFill={quickFillItems({
          form,
          editing: Boolean(treatment),
          last,
          packages,
          onLogCheckIn,
          t,
        })}
        // The everyday 680px: a form with chip groups and textareas.
        content={{ fieldCount: 12, hasHeavyField: true }}
        tone="sage"
        steps={steps}
        openStep={step}
        onOpenStepChange={setStep}
        summary={[values.name.trim() || t(K.record), session, doctorName]
          .filter(Boolean)
          .join(' · ')}
        readOnly={readOnly}
        saveLabel={t(treatment ? K.save.edit : K.save.create)}
        onSave={() => void save()}
        saveState={saveState}
        onDelete={treatment && canDelete ? () => setDeleting(true) : undefined}
        dirty={isDirty}
        testId={TREATMENT_TEST_ID}
      >
        <TreatmentTypeSwitch
          value={values.template}
          onChange={(next) => {
            if (next !== values.template) {
              form.reset(withTemplate(form.getValues(), next), {
                keepDefaultValues: true,
                keepErrors: true,
              });
            }
          }}
          disabled={readOnly}
          testId={`${TREATMENT_TEST_ID}-template`}
        />
      </RecordDrawer>
      {treatment && canDelete ? (
        <TreatmentDeleteConfirm
          treatment={treatment.treatment}
          open={deleting}
          onOpenChange={setDeleting}
          onDeleted={onClose}
        />
      ) : null}
    </>
  );
}
