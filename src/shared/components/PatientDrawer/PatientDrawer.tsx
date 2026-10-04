import { useNavigate, useParams } from '@tanstack/react-router';
import type { TFunction } from 'i18next';
import { useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  patientName,
  type PatientRecord,
} from '@/shared/api/clinic/patients-contracts.ts';
import { defaultBranchId } from '@/shared/clinic/clinic-branch.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import { toClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { PatientDeleteConfirm } from '@/shared/components/PatientDeleteConfirm/index.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { usePatientByPhone } from '@/shared/hooks/usePatients/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  PATIENT_DRAWER_KEYS,
  PATIENT_DRAWER_NS,
  PATIENT_DRAWER_TEST_ID,
  PATIENT_QUICK_ADD_TEST_ID,
} from './patient-drawer.constants.ts';
import { usePatientDrawerView } from './patient-drawer-view.ts';
import {
  emptyPatientForm,
  PATIENT_QUICK_FILLS,
  type PatientDrawerPrefill,
  patientFormName,
  patientFormOf,
  type PatientFormValues,
  patientInputOf,
} from './patient-form.ts';
import { PatientClinicFields, PatientContactFields } from './PatientDrawerFields.tsx';
import { PatientDuplicateNotice, type PickedPhoto } from './PatientDrawerParts.tsx';
import { type PatientSaveOutcome, usePatientSave } from './use-patient-save.ts';

/** What every use of the drawer passes. */
interface PatientDrawerBaseProps {
  open: boolean;
  /** Every exit, once the dirty guard has let it through. */
  onClose: () => void;
}

/** New patient over the Patients list (`patients/create/`, D24). */
export interface PatientCreateDrawerProps extends PatientDrawerBaseProps {
  mode: 'create';
  prefill?: PatientDrawerPrefill;
  /** Saved: the room closes the drawer and the list stays (D28, Q-P6). */
  onCreated: (patient: PatientRecord) => void;
}

/** Quick-add: the same form stacked on a picker's drawer (Q-P2) — component state, no URL. */
export interface PatientQuickAddProps extends PatientDrawerBaseProps {
  mode: 'quick';
  /** What was typed in the picker: the first word fills First name, the rest Last name. */
  query?: string;
  /**
   * More to start with — the appointment form's "Create patient record"
   * prefills the mobile, the types and the notes, and links the lead (H:6039).
   */
  prefill?: PatientDrawerPrefill;
  /**
   * The toast a create raises instead of "Patient #<id> registered…" — the
   * appointment form's "<name> is now a patient · you can mark Completed".
   */
  createdMessage?: (patient: PatientRecord) => string;
  /**
   * The parent field takes this patient — the one just created, or the one
   * already on the same mobile ("Use existing", Q-P7).
   */
  onPick: (patient: PatientRecord) => void;
}

/** Edit patient (the file's `edit/`, `S:34`). */
export interface PatientEditDrawerProps extends PatientDrawerBaseProps {
  mode: 'edit';
  patient: PatientRecord;
  /** Saved: the caller closes the drawer. */
  onSaved: (patient: PatientRecord) => void;
  /** Deleted from the drawer (its Delete, with Undo in the toast). */
  onDeleted?: () => void;
}

/** Props of {@link PatientDrawer}. */
export type PatientDrawerProps =
  PatientCreateDrawerProps | PatientQuickAddProps | PatientEditDrawerProps;

type SessionProps = PatientDrawerProps & {
  /** "Create & add another" restarted the drawer: no prefill this time. */
  fresh: boolean;
  onAnother: () => void;
};

/** The section tone of the Patients room (`patients.md:11`). */
const PATIENT_TONE = 'sage';

const K = PATIENT_DRAWER_KEYS;

/** Seventeen fields, chip groups and an upload among them: the everyday 680px. */
const CONTENT_PROFILE = { fieldCount: 17, hasHeavyField: true } as const;

/** What an opening starts from: the URL's or the picker's prefill, never after "add another". */
function sessionPrefill(props: SessionProps): PatientDrawerPrefill | undefined {
  if (props.fresh) return undefined;
  if (props.mode === 'create') return props.prefill;
  if (props.mode === 'quick') return { name: props.query, ...props.prefill };
  return undefined;
}

/** The form's values as they stand, every key present (the form starts with all of them). */
function useFormValues(form: UseFormReturn<PatientFormValues>): PatientFormValues {
  const watched = useWatch({ control: form.control });
  return { ...form.getValues(), ...watched } as PatientFormValues;
}

/**
 * The duplicate-mobile check (Q-P7): a mobile that loses focus as a valid
 * ten digits is looked up; the notice shows while the field still holds it.
 */
function useDuplicateMobile(phone: string, exceptId: string | null) {
  const [checked, setChecked] = useState<string | null>(null);
  const lookup = usePatientByPhone(checked, exceptId);
  const patient =
    checked !== null && toClinicPhone(phone) === checked ? (lookup.data ?? null) : null;
  return { patient, check: (digits: string) => setChecked(toClinicPhone(digits)) };
}

/** The Quick fill chips: each presets fields and keeps the rest; none saves. */
function quickFillItems(
  form: UseFormReturn<PatientFormValues>,
  t: TFunction,
): QuickFillItem[] {
  return PATIENT_QUICK_FILLS.map((fill) => ({
    id: fill.id,
    label: t(K.quickFill[fill.id]),
    tone: fill.tone,
    onSelect: () =>
      form.reset(
        { ...form.getValues(), ...fill.values },
        { keepDefaultValues: true, keepErrors: true },
      ),
  }));
}

/** The drawer's words, ids and mode-only parts for each use (`patients.md:91–117`). */
function drawerChrome(props: SessionProps, t: TFunction) {
  const quick = props.mode === 'quick';
  const create = props.mode === 'create';
  return {
    title: props.mode === 'edit' ? t(K.title.edit) : t(K.title.create),
    tag: props.mode === 'edit' ? displayId.patient(props.patient.seq) : undefined,
    sub: quick ? t(K.sub.quick) : t(K.sub.full),
    saveLabel: props.mode === 'edit' ? t(K.save.edit) : t(K.save.create),
    testId: quick ? PATIENT_QUICK_ADD_TEST_ID : PATIENT_DRAWER_TEST_ID,
    /** Quick-add stacks on its parent: "Back", and no footer summary. */
    stacked: quick,
    /** Quick fill and "Create & add another" belong to New patient only. */
    create,
  };
}

/** View-only without the mode's write; Delete with the delete ability on an edit. */
function useDrawerAccess(editing: boolean) {
  const access = useClinicAccess();
  const readOnly =
    access.isResolved && !access.can('patients', editing ? 'edit' : 'create');
  return {
    readOnly,
    canDelete: editing && !readOnly && access.can('patients', 'delete'),
  };
}

/**
 * Edit patient's Delete (`patients.md:151–165`): the reason confirm titled
 * "Delete this record?", the drawer's summary in its pill.
 */
function DrawerDeleteConfirm({
  props,
  open,
  name,
  record,
  onClose,
}: {
  props: SessionProps;
  open: boolean;
  name: string;
  record: string;
  onClose: () => void;
}) {
  if (props.mode !== 'edit') return null;
  return (
    <PatientDeleteConfirm
      patient={open ? { id: props.patient.id, name, record } : null}
      fromFile
      onClose={onClose}
      onDeleted={props.onDeleted}
    />
  );
}

/** What follows a save: its toast, then the caller's hand-off (KICKOFF §6.5). */
function useSaveOutcome(props: SessionProps) {
  const { t } = useTranslation(PATIENT_DRAWER_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });

  const openFile = (patientId: string) => {
    void navigate(
      clinicCommandNavigation('patient', { organizationSlug, recordId: patientId }),
    );
  };

  const finish = (outcome: PatientSaveOutcome, another: boolean) => {
    const name = patientName(outcome.patient);
    if (outcome.kind === 'saved') {
      notify.success(t(K.saved, { name }));
      if (props.mode === 'edit') props.onSaved(outcome.patient);
      return;
    }
    const id = displayId.patient(outcome.patient.seq);
    if (props.mode === 'quick') {
      let message = t(K.registered, { name, id });
      if (props.createdMessage) message = props.createdMessage(outcome.patient);
      else if (outcome.filed > 0) {
        message = t(K.registeredPhotos, { name, id, count: outcome.filed });
      }
      notify.success(message);
      props.onPick(outcome.patient);
      return;
    }
    notify.success(t(K.created, { id }), {
      action: { label: t(K.openFile), onClick: () => openFile(outcome.patient.id) },
    });
    if (another) props.onAnother();
    else if (props.mode === 'create') props.onCreated(outcome.patient);
  };

  /** The notice's action: quick-add hands the existing patient to its parent field. */
  const existingAction =
    props.mode === 'quick'
      ? {
          label: t(K.useExisting),
          run: (patient: PatientRecord) => props.onPick(patient),
        }
      : { label: t(K.openFile), run: (patient: PatientRecord) => openFile(patient.id) };

  return { finish, existingAction };
}

/** One opening of the drawer: the form, its checks and its save. */
function PatientDrawerSession(props: SessionProps) {
  const { t } = useTranslation(PATIENT_DRAWER_NS);
  const { openBranches } = useBranches();
  const { preferences } = usePreferences();
  const idPrefix = `patient-${useId().replace(/:/g, '')}`;
  const [today] = useState(() => clinicToday());
  const editing = props.mode === 'edit' ? props.patient : null;
  const prefill = sessionPrefill(props);
  const chrome = drawerChrome(props, t);
  const { readOnly, canDelete } = useDrawerAccess(editing !== null);

  const form = useForm<PatientFormValues>({
    defaultValues: editing ? patientFormOf(editing) : emptyPatientForm(prefill),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>('contact');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [deleting, setDeleting] = useState(false);

  const startingBranchId = defaultBranchId(openBranches, preferences.branchFilter);
  const homeBranchId = values.homeBranchId ?? startingBranchId;
  const view = usePatientDrawerView({
    values,
    today,
    branches: openBranches,
    homeBranchId,
  });
  const duplicate = useDuplicateMobile(values.phone, editing?.id ?? null);
  const { finish, existingAction } = useSaveOutcome(props);
  const { saveState, save } = usePatientSave({
    form,
    patientId: editing?.id ?? null,
    input: () =>
      patientInputOf(form.getValues(), {
        defaultBranchId: startingBranchId,
        leadId: prefill?.leadId,
      }),
    photos: photos.map((photo) => photo.file),
    onStep: setOpenStep,
    onConflict: () => duplicate.check(form.getValues('phone')),
    onDone: finish,
  });

  const existing = duplicate.patient;
  const steps: DrawerStep[] = [
    {
      id: 'contact',
      title: t(K.steps.contact),
      ...view.contact,
      content: (
        <PatientContactFields
          form={form}
          values={values}
          idPrefix={idPrefix}
          testId={chrome.testId}
          readOnly={readOnly}
          quick={chrome.stacked}
          branches={openBranches}
          homeBranchId={homeBranchId}
          today={today}
          onMobileBlur={() => duplicate.check(form.getValues('phone'))}
          duplicate={
            existing ? (
              <PatientDuplicateNotice
                patient={existing}
                actionLabel={existingAction.label}
                onAction={() => existingAction.run(existing)}
                testId={chrome.testId}
              />
            ) : null
          }
        />
      ),
    },
    {
      id: 'clinic',
      title: t(K.steps.clinic),
      ...view.clinic,
      content: (
        <PatientClinicFields
          form={form}
          values={values}
          idPrefix={idPrefix}
          testId={chrome.testId}
          readOnly={readOnly}
          today={today}
          photos={photos}
          onPhotosChange={setPhotos}
        />
      ),
    },
  ];

  return (
    <>
      <RecordDrawer
        open={props.open}
        onClose={props.onClose}
        title={chrome.title}
        tag={chrome.tag}
        sub={chrome.sub}
        badges={view.badges}
        quickFill={chrome.create ? quickFillItems(form, t) : undefined}
        content={CONTENT_PROFILE}
        tone={PATIENT_TONE}
        steps={steps}
        openStep={openStep}
        onOpenStepChange={setOpenStep}
        onMissing={() => notify.warning(t(K.missing))}
        summary={chrome.stacked ? undefined : view.summary}
        readOnly={readOnly}
        stacked={chrome.stacked}
        saveLabel={chrome.saveLabel}
        onSave={() => void save(false)}
        saveState={saveState}
        saveAndAddLabel={t(K.save.createAnother)}
        onSaveAndAdd={chrome.create ? () => void save(true) : undefined}
        onDelete={canDelete ? () => setDeleting(true) : undefined}
        dirty={isDirty || photos.length > 0}
        testId={chrome.testId}
      />
      <DrawerDeleteConfirm
        props={props}
        open={deleting}
        name={patientFormName(values)}
        record={view.summary}
        onClose={() => setDeleting(false)}
      />
    </>
  );
}

/**
 * The patient drawer (KICKOFF §6.5; `patients.md:40–103`) on the shared
 * record drawer: New patient over the list, Edit patient from the file, and
 * quick-add stacked on a picker — one form in two steps, "Contact & personal"
 * and "Clinic, referral & follow-up". New starts at Status New with the Quick
 * fill presets; a mobile that loses focus with ten digits is looked up, and a
 * patient already on it shows "Same mobile as …" (Q-P7) — a warning, never a
 * block. Save never disables: an empty First name or Mobile opens step 1 with
 * "Add name and mobile". A create adds the onboarding task, files the first
 * photos and toasts "Patient #3509 created · onboarding task added" with
 * "Open file" (D28, Q-P6); "Create & add another" restarts the drawer empty.
 * Every opening starts a fresh form.
 */
export function PatientDrawer(props: PatientDrawerProps) {
  const { session, fresh, restart } = useDrawerSession(props.open);
  return (
    <PatientDrawerSession key={session} {...props} fresh={fresh} onAnother={restart} />
  );
}
