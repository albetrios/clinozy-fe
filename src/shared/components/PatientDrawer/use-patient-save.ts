import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { attachPatientImage } from '@/shared/api/app/patient-images-api.ts';
import type {
  PatientFields,
  PatientPersonInput,
  PatientRecord,
} from '@/shared/api/app/patients-contracts.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useCreatePatient, useUpdatePatient } from '@/shared/hooks/usePatients/index.ts';
import { useUploadQueue } from '@/shared/hooks/useUploadQueue/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PATIENT_DRAWER_KEYS, PATIENT_DRAWER_NS } from './patient-drawer.constants.ts';
import { invalidPatientPhones, type PatientFormValues } from './patient-form.ts';

/** The drawer's two steps. */
type PatientDrawerStepId = 'contact' | 'clinic';

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

/**
 * The API's names the form spells differently: the file's follow-up, and the person's fields —
 * under `contact` on a create, at the root of the contact change on an edit.
 */
const SERVER_FIELDS: Readonly<Record<string, keyof PatientFormValues>> = {
  followUpAt: 'followUpDate',
  'contact.firstName': 'firstName',
  'contact.lastName': 'lastName',
  'contact.phones': 'phone',
  'contact.phones.0.phone': 'phone',
  'contact.phones.1.phone': 'phone2',
  'contact.gender': 'gender',
  'contact.dateOfBirth': 'dateOfBirth',
  'contact.address': 'address',
  'contact.referralSource': 'referralSource',
  'contact.referredByName': 'referredByName',
  phones: 'phone',
  'phones.0.phone': 'phone',
  'phones.1.phone': 'phone2',
};

/** What a save ended with: a new patient (and the photos it filed), or the saved one. */
export type PatientSaveOutcome =
  | { kind: 'created'; patient: PatientRecord; filed: number }
  | { kind: 'saved'; patient: PatientRecord };

/** Options of {@link usePatientSave}. */
export interface UsePatientSaveOptions {
  form: UseFormReturn<PatientFormValues>;
  /** The patient an edit saves, as read; a create has none. */
  patient: PatientRecord | null;
  /** The fields the form saves, as it stands. */
  input: () => PatientFields;
  /** Who a create is for: a person the clinic knows, or a new one. */
  person: () => PatientPersonInput;
  /** Photos to file on the new patient once it exists. */
  photos: readonly File[];
  /** Open a step — the one holding the field a check or the server named. */
  onStep: (stepId: PatientDrawerStepId) => void;
  /**
   * The server refused the mobile as someone else's (`409 contact_phone_exists`) or the person
   * as already a patient (`409 contact_is_patient`): show the notice.
   */
  onConflict: () => void;
  /** The patient changed since the drawer read them (`409 record_changed`): read them again. */
  onStale?: () => void;
  /** The save went through; `another` when it was "Create & add another". */
  onDone: (outcome: PatientSaveOutcome, another: boolean) => void;
}

/**
 * The patient drawer's write and its outcomes (KICKOFF §6.0 States, §6.5) on
 * the shared drawer save (`useDrawerSave`). A filled mobile that is not ten
 * digits stops the save on step 1 with "Enter a 10-digit mobile"; a `409`
 * (the mobile is someone else's, or the person already has a file) shows the
 * notice and keeps the draft; a stale edit offers Reload. A create files its
 * photos in General through the upload tray, which outlives the drawer.
 */
export function usePatientSave({
  form,
  patient,
  input,
  person,
  photos,
  onStep,
  onConflict,
  onStale,
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
    onStale,
    onField: (field: FieldPath<PatientFormValues>) =>
      onStep(FIELD_STEPS[field as keyof PatientFormValues] ?? 'contact'),
    write: async () => {
      if (patient) {
        const saved = await update.mutateAsync({ record: patient, fields: input() });
        return { kind: 'saved', patient: saved };
      }
      const created = await create.mutateAsync({ fields: input(), person: person() });
      const filed =
        photos.length > 0
          ? enqueue(photos, {
              onUploaded: async (key, file) => {
                await attachPatientImage({
                  patientId: created.id,
                  fileKey: key,
                  fileName: file.name,
                });
              },
            }).accepted
          : 0;
      return { kind: 'created', patient: created, filed };
    },
    onDone,
  });
}
