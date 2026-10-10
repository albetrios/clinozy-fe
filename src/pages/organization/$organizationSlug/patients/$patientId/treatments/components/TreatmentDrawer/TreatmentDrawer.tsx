import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateJoin } from '@/lib/bidi-isolate.ts';
import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-contracts.ts';
import {
  fetchTreatment,
  treatmentQueryKeys,
} from '@/shared/api/clinic/treatments-api.ts';
import type {
  TreatmentCheckIn,
  TreatmentRecord,
  TreatmentTemplate,
} from '@/shared/api/clinic/treatments-contracts.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
import {
  type DrawerBadge,
  RecordDrawer,
} from '@/shared/components/RecordDrawer/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import {
  resetFormInPlace,
  useEditingRecord,
} from '@/shared/hooks/useEditingRecord/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { useTreatmentFeedback } from '@/shared/hooks/useTreatments/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useStaffMember } from '../../../shared/components/PatientStaffPicker/index.ts';
import {
  TREATMENT_KEYS,
  TREATMENT_NS,
  TREATMENT_TEST_ID,
} from '../../treatments.constants.ts';
import {
  canSpendSession,
  newTreatmentForm,
  nextSessionForm,
  onPackageForm,
  rememberTemplate,
  templateTone,
  treatmentFormOf,
  type TreatmentFormValues,
  withTemplate,
} from './treatment-form.ts';
import { TreatmentReverseConfirm } from './treatment-reverse-confirm.tsx';
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

/** A package's tone in the drawer — the Packages section's mint (the row carries none). */
const PACKAGE_TONE = 'mint';

/** Props of {@link TreatmentDrawer}. */
export interface TreatmentDrawerProps {
  /** The treatment an edit opens; null for a new one. */
  treatment: TreatmentRecord | null;
  patientId: string;
  /** The patient's last treatment — "Next session of …" and the template to start with. */
  last: TreatmentRecord | undefined;
  /** The patient's packages (`usePatientPackages`) — "From package" offers those with a session left. */
  packages: readonly PatientPackageRow[];
  /** The treatments the name field offers as chips. */
  names: readonly TreatmentNameChip[];
  /** Who a new treatment starts with. */
  staff: { doctorId: string | null; therapistId: string | null };
  template: TreatmentTemplate;
  /**
   * The member may write this one — `patient_treatment:create` for a new one,
   * `patient_treatment:update` for a session still done; anyone else reads it.
   */
  writable: boolean;
  /** `patient_treatment:update` on a session still done: "Reverse" in the footer. */
  canReverse: boolean;
  /**
   * An edit's ⚡ "Log check-in" (`patient-file.md:278`): opens the check-in
   * drawer for this treatment, stacked over this one — on a read-only drawer
   * too, the check-in being Patients Edit's. Absent — no chip (a new
   * treatment, a reversed one, or a member who may not check in).
   */
  onLogCheckIn?: () => void;
  /**
   * Opened from the visit flow with a visit open: a new treatment is the visit's session — written
   * at its booking — and `onWritten` moves the visit on once it lands (Q8). Absent outside it.
   */
  visit?: { appointmentId: string; onWritten: () => void };
  onClose: () => void;
}

/**
 * The Quick fill chips (H:4828): "Log check-in" (edit), "Next session of …"
 * (new) and one per package that can still spend a session (new).
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
  last: TreatmentRecord | undefined;
  packages: readonly PatientPackageRow[];
  onLogCheckIn: (() => void) | undefined;
  t: TFunction;
}): QuickFillItem[] {
  const fill = (values: TreatmentFormValues) =>
    resetFormInPlace(form, values, { keepDefaultValues: true, keepErrors: true });
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
  if (editing) return items;
  if (last) {
    items.push({
      id: 'next',
      label: t(K.quickFill.next, { name: last.name }),
      tone: 'sky',
      onSelect: () => fill(nextSessionForm(last, form.getValues(), packages)),
    });
  }
  for (const row of packages) {
    items.push({
      id: `package-${row.id}`,
      label: t(K.package.option, {
        name: row.name,
        used: row.sessionsUsed,
        total: row.sessionsTotal,
      }),
      tone: PACKAGE_TONE,
      onSelect: () => fill(onPackageForm(form.getValues(), row)),
    });
  }
  return items;
}

/** An edit's session read again — the stale save's "Reload". */
const readTreatment = (treatment: TreatmentRecord, organizationId: string | null) => ({
  queryKey: treatmentQueryKeys.detail(organizationId, treatment.patientId, treatment.id),
  queryFn: () => fetchTreatment(treatment.patientId, treatment.id),
});

/** "Reversed 10 Oct · Recorded by mistake" — under the header of a reversed session. */
function ReversedBand({ treatment }: { treatment: TreatmentRecord }) {
  const { t } = useTranslation(TREATMENT_NS);
  const clock = useClinicClock();
  const date = treatment.reversedAt ? clock.date(clock.dayOf(treatment.reversedAt)) : '';
  return (
    <p
      data-testid={`${TREATMENT_TEST_ID}-reversed`}
      className="bg-tone-blush text-tone-blush-foreground text-body px-(--drawer-pad-x) py-2"
    >
      {t(K.reverse.note, { date, reason: treatment.reversedReason ?? '' })}
    </p>
  );
}

/** The header's badges: the template, the session number when it is known, and Reversed. */
function drawerBadges({
  values,
  session,
  reversed,
  t,
}: {
  values: TreatmentFormValues;
  session: string | null;
  reversed: boolean;
  t: TFunction;
}): DrawerBadge[] {
  const badges: DrawerBadge[] = [
    {
      id: 'template',
      label: t(K.templates[values.template]),
      tone: templateTone(values.template),
    },
  ];
  if (session) badges.push({ id: 'session', label: session, tone: 'butter' });
  if (reversed)
    badges.push({ id: 'reversed', label: t(K.reverse.status), tone: 'blush' });
  return badges;
}

/**
 * An edit's "Feedback on this treatment": the session's check-ins, else — while they load —
 * its latest; a new treatment has none.
 */
function feedbackOf(
  treatment: TreatmentRecord | null,
  checkIns: readonly TreatmentCheckIn[] | undefined,
): readonly TreatmentCheckIn[] | undefined {
  if (!treatment) return undefined;
  if (checkIns) return checkIns;
  return treatment.latestCheckIn ? [treatment.latestCheckIn] : [];
}

/** The drawer's three steps with their fields (H:4811–4827). */
function useTreatmentSteps({
  form,
  values,
  names,
  packages,
  linkedPackage,
  treatment,
  checkIns,
  sessionLabel,
  readOnly,
}: {
  form: UseFormReturn<TreatmentFormValues>;
  values: TreatmentFormValues;
  names: readonly TreatmentNameChip[];
  /** The packages a new session may spend. */
  packages: readonly PatientPackageRow[];
  linkedPackage: PatientPackageRow | null;
  treatment: TreatmentRecord | null;
  checkIns: readonly TreatmentCheckIn[] | undefined;
  /** The session number as the drawer shows it. */
  sessionLabel: string;
  readOnly: boolean;
}): DrawerStep[] {
  const view = useTreatmentStepsView(values, sessionLabel);
  return [
    {
      ...view.session,
      content: (
        <TreatmentSessionFields
          form={form}
          values={values}
          names={names}
          packages={packages}
          linkedPackage={linkedPackage}
          sessionFixed={Boolean(treatment?.packageId)}
          readOnly={readOnly}
        />
      ),
    },
    {
      ...view.details,
      content: (
        <TreatmentTemplateFields
          values={values}
          setParameter={(key, value) =>
            form.setValue(
              'parameters',
              { ...form.getValues('parameters'), [key]: value },
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
          checkIns={feedbackOf(treatment, checkIns)}
          readOnly={readOnly}
        />
      ),
    },
  ];
}

/** The title and the save's words of a new treatment and of an edit. */
const DRAWER_WORDS = {
  create: { title: K.title.create, save: K.save.create },
  edit: { title: K.title.edit, save: K.save.edit },
} as const;

/** The footer's summary: the name (or "Treatment"), the session when known, the doctor. */
function drawerSummary(
  values: TreatmentFormValues,
  parts: { session: string | null; doctorName: string },
  t: TFunction,
): string {
  return isolateJoin(
    [values.name.trim() || t(K.record), parts.session, parts.doctorName].filter(
      (part): part is string => Boolean(part),
    ),
  );
}

/**
 * What the drawer reads off the session it opens: the packages a new one may spend, the package
 * an edit spent, whether the server numbers the session (a new one on a package) and whether it
 * is reversed.
 */
function sessionFactsOf(
  treatment: TreatmentRecord | null,
  values: TreatmentFormValues,
  packages: readonly PatientPackageRow[],
) {
  if (!treatment) {
    return {
      spendable: packages.filter(canSpendSession),
      linkedPackage: null,
      numberedByPackage: values.packageId !== null,
      reversed: false,
    };
  }
  return {
    spendable: [],
    linkedPackage: packages.find((row) => row.id === treatment.packageId) ?? null,
    numberedByPackage: false,
    reversed: treatment.status === 'reversed',
  };
}

/**
 * The Treatment drawer — `treatments/create/` and
 * `treatments/$treatmentId/edit/` (KICKOFF §6.6 Drawers; H:4811–4828;
 * `patient-file.md:123–141, 360–372`): 680px, "New treatment" / "Edit
 * treatment" (a session has no number, so no tag), "Fields follow the clinic
 * specialty · switch if needed", the template and session badges; Quick fill
 * "Log check-in" (edit), "Next session of …" (new) and one chip per package;
 * the Type switch; three steps. Nothing is required — a blank name saves as
 * "Treatment" (A-F11). A new session on a package spends one of its sessions
 * and takes its number from it (the server's, §6 #20). "Treatment saved", and
 * the template is remembered for the next. The design's Delete is "Reverse": a
 * reversed session reads only, with its reason.
 */
export function TreatmentDrawer({
  treatment: opened,
  patientId,
  last,
  packages,
  names,
  staff,
  template,
  writable,
  canReverse,
  onLogCheckIn,
  visit,
  onClose,
}: TreatmentDrawerProps) {
  const { t } = useTranslation(TREATMENT_NS);
  const form = useForm<TreatmentFormValues>({
    defaultValues: opened
      ? treatmentFormOf(opened)
      : newTreatmentForm(template, staff, last),
  });
  const words = DRAWER_WORDS[opened ? 'edit' : 'create'];
  const { record: treatment, reload } = useEditingRecord({
    record: opened,
    form,
    formOf: treatmentFormOf,
    read: readTreatment,
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [step, setStep] = useState<string>('session');
  const [reversing, setReversing] = useState(false);
  const feedback = useTreatmentFeedback(patientId, opened?.id ?? null);

  const { spendable, linkedPackage, numberedByPackage, reversed } = sessionFactsOf(
    treatment,
    values,
    packages,
  );
  const doctorName = useStaffMember(values.doctorId).shortName;
  const session = numberedByPackage
    ? null
    : t(K.session, { session: values.sessionNumber });
  const readOnly = !writable;

  const { saveState, save } = useTreatmentSave({
    form,
    treatment,
    patientId,
    visit,
    onStep: setStep,
    onStale: () => void reload(),
    onDone: (saved) => {
      rememberTemplate(saved.template);
      notify.success(t(K.save.saved));
      onClose();
    },
  });

  const steps = useTreatmentSteps({
    form,
    values,
    names,
    packages: spendable,
    linkedPackage,
    treatment,
    checkIns: feedback.data,
    sessionLabel: session ? String(values.sessionNumber) : t(K.package.numbered),
    readOnly,
  });

  return (
    <>
      <RecordDrawer
        open
        onClose={onClose}
        title={t(words.title)}
        sub={t(K.sub)}
        badges={drawerBadges({ values, session, reversed, t })}
        band={treatment && reversed ? <ReversedBand treatment={treatment} /> : undefined}
        quickFill={quickFillItems({
          form,
          editing: Boolean(treatment),
          last,
          packages: spendable,
          onLogCheckIn,
          t,
        })}
        // The everyday 680px: a form with chip groups and textareas.
        content={{ fieldCount: 12, hasHeavyField: true }}
        tone="sage"
        steps={steps}
        openStep={step}
        onOpenStepChange={setStep}
        summary={drawerSummary(values, { session, doctorName }, t)}
        readOnly={readOnly}
        saveLabel={t(words.save)}
        onSave={() => void save()}
        saveState={saveState}
        deleteLabel={t(K.reverse.action)}
        onDelete={treatment && canReverse ? () => setReversing(true) : undefined}
        deleteTestId={`${TREATMENT_TEST_ID}-reverse`}
        dirty={isDirty}
        testId={TREATMENT_TEST_ID}
      >
        <TreatmentTypeSwitch
          value={values.template}
          onChange={(next) =>
            resetFormInPlace(form, withTemplate(form.getValues(), next), {
              keepDefaultValues: true,
              keepErrors: true,
            })
          }
          disabled={readOnly}
          testId={`${TREATMENT_TEST_ID}-template`}
        />
      </RecordDrawer>
      {treatment && canReverse ? (
        <TreatmentReverseConfirm
          treatment={treatment}
          open={reversing}
          onOpenChange={setReversing}
          onReversed={onClose}
        />
      ) : null}
    </>
  );
}
