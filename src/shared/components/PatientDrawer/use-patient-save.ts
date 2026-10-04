import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { attachPatientPhoto } from '@/shared/api/clinic/patients-api.ts';
import type {
  PatientCreateInput,
  PatientRecord,
} from '@/shared/api/clinic/patients-contracts.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useCreatePatient, useUpdatePatient } from '@/shared/hooks/usePatients/index.ts';
import { useUploadQueue } from '@/shared/hooks/useUploadQueue/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PATIENT_DRAWER_KEYS, PATIENT_DRAWER_NS } from './patient-drawer.constants.ts';
import { invalidPatientPhones, type PatientFormValues } from './patient-form.ts';

/** The drawer's two steps. */
export type PatientDrawerStepId = 'contact' | 'clinic';

/** Which step holds each field — a server error opens the step of the first one it names. */
const FIELD_STEPS: Readonly<Record<keyof PatientFormValues, PatientDrawerStepId>> = {
  firstName: 'contact',
  lastName: 'contact',
  phone: 'contact',
  phone2: 'contact',
  address: 'contact',
  homeBranchId: 'contact',
  gender: 'contact',
  dateOfBirth: 'contact',
  types: 'clinic',
  status: 'clinic',
  conversion: 'clinic',
  referredByName: 'clinic',
  referralSource: 'clinic',
  followUpDate: 'clinic',
  followUpTime: 'clinic',
  notes: 'clinic',
  consents: 'clinic',
};

/** The form fields in the drawer's order, for "the first field the server named". */
const FIELD_ORDER = Object.keys(FIELD_STEPS) as (keyof PatientFormValues)[];

/** The contract's names that the form spells differently. */
const SERVER_FIELDS: Readonly<Record<string, keyof PatientFormValues>> = {
  followUpAt: 'followUpDate',
};

/** What a save ended with: a new patient (and the photos it filed), or the saved one. */
export type PatientSaveOutcome =
  | { kind: 'created'; patient: PatientRecord; filed: number }
  | { kind: 'saved'; patient: PatientRecord };

/** Options of {@link usePatientSave}. */
export interface UsePatientSaveOptions {
  form: UseFormReturn<PatientFormValues>;
  /** The patient an edit saves; a create has none. */
  patientId: string | null;
  /** The contract's fields for the form as it stands. */
  input: () => PatientCreateInput;
  /** Photos to file on the new patient once it exists. */
  photos: readonly File[];
  /** Open a step — the one holding the field a check or the server named. */
  onStep: (stepId: PatientDrawerStepId) => void;
  /** The server refused the mobile as already taken (`conflict`, `S:1623`): show the notice. */
  onConflict: () => void;
  /** The save went through; `another` when it was "Create & add another". */
  onDone: (outcome: PatientSaveOutcome, another: boolean) => void;
}

/**
 * The patient drawer's write and its outcomes (KICKOFF §6.0 States, §6.5) on
 * the shared drawer save (`useDrawerSave`). A filled mobile that is not ten
 * digits stops the save on step 1 with "Enter a 10-digit mobile"; a
 * `conflict` (the mobile is taken) shows the duplicate notice and keeps the
 * draft. A create files its photos through the upload tray, which outlives
 * the drawer.
 */
export function usePatientSave({
  form,
  patientId,
  input,
  photos,
  onStep,
  onConflict,
  onDone,
}: UsePatientSaveOptions) {
  const { t } = useTranslation(PATIENT_DRAWER_NS);
  const create = useCreatePatient({ notifyOnError: false });
  const update = useUpdatePatient({ notifyOnError: false });
  const { enqueue } = useUploadQueue();

  return useDrawerSave<PatientFormValues, PatientSaveOutcome>({
    form,
    fieldOrder: FIELD_ORDER,
    serverFields: SERVER_FIELDS,
    toastId: 'patient-save-failed',
    check: (values) => {
      const invalid = invalidPatientPhones(values);
      return invalid.length > 0
        ? { fields: invalid, message: t(PATIENT_DRAWER_KEYS.mobileInvalid) }
        : null;
    },
    onConflict: (error) => {
      onStep('contact');
      onConflict();
      notify.error(mapApiError(error));
    },
    onField: (field: FieldPath<PatientFormValues>) =>
      onStep(FIELD_STEPS[field as keyof PatientFormValues] ?? 'contact'),
    write: async () => {
      if (patientId) {
        const patient = await update.mutateAsync({ id: patientId, patch: input() });
        return { kind: 'saved', patient };
      }
      const { patient } = await create.mutateAsync(input());
      const filed =
        photos.length > 0
          ? enqueue(photos, {
              onUploaded: async (key, file) => {
                await attachPatientPhoto({
                  patientId: patient.id,
                  key,
                  fileName: file.name,
                });
              },
            }).accepted
          : 0;
      return { kind: 'created', patient, filed };
    },
    onDone,
  });
}
