import { useState } from 'react';
import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { attachPatientPhoto } from '@/shared/api/clinic/patients-api.ts';
import type {
  PatientCreateInput,
  PatientRecord,
} from '@/shared/api/clinic/patients-contracts.ts';
import type { DrawerSaveState } from '@/shared/components/DrawerFooter/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';
import { mapValidationErrors } from '@/shared/errors/map-validation-errors.ts';
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
 * The patient drawer's write and its outcomes (KICKOFF §6.0 States, §6.5).
 * A filled mobile that is not ten digits stops the save on step 1 with
 * "Enter a 10-digit mobile". A `validation` error outlines its fields, opens
 * the first one's step and toasts its message; a `conflict` shows the
 * duplicate notice and keeps the draft; a refusal toasts the server's reason.
 * A dropped connection (or a server failure) keeps the draft with "Not saved ·
 * your changes are kept", "Retry save", and a toast whose "Retry" saves again.
 * A create files its photos through the upload tray, which outlives the drawer.
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
  const { t } = useTranslation([PATIENT_DRAWER_NS, ERRORS_NS]);
  const [saveState, setSaveState] = useState<DrawerSaveState>('idle');
  const create = useCreatePatient({ notifyOnError: false });
  const update = useUpdatePatient({ notifyOnError: false });
  const { enqueue } = useUploadQueue();

  const failed = (error: unknown, retry: () => void) => {
    if (isHttpError(error) && error.status === 409) {
      setSaveState('idle');
      onStep('contact');
      onConflict();
      notify.error(mapApiError(error));
      return;
    }
    const named: (keyof PatientFormValues)[] = [];
    const applied = mapValidationErrors<PatientFormValues>(error, (name, option) => {
      const field = SERVER_FIELDS[name] ?? (name as keyof PatientFormValues);
      form.setError(field as FieldPath<PatientFormValues>, option);
      named.push(field);
    });
    if (applied) {
      setSaveState('idle');
      const first = FIELD_ORDER.find((field) => named.includes(field));
      if (first) onStep(FIELD_STEPS[first]);
      const message = first ? form.getFieldState(first).error?.message : undefined;
      notify.error(message ?? mapApiError(error));
      return;
    }
    if (isHttpError(error) && error.status < 500) {
      setSaveState('idle');
      notify.error(mapApiError(error));
      return;
    }
    setSaveState('failed');
    notify.error(t(RECORD_DRAWER_KEYS.saveFailed, { ns: RECORD_DRAWER_NS }), {
      id: 'patient-save-failed',
      action: { label: t(ERRORS_KEYS.widget.retry, { ns: ERRORS_NS }), onClick: retry },
    });
  };

  const save = async (another: boolean): Promise<void> => {
    const invalid = invalidPatientPhones(form.getValues());
    if (invalid.length > 0) {
      const message = t(PATIENT_DRAWER_KEYS.mobileInvalid);
      for (const field of invalid) form.setError(field, { type: 'client', message });
      onStep('contact');
      notify.warning(message);
      return;
    }
    form.clearErrors();
    setSaveState('saving');
    try {
      if (patientId) {
        const patient = await update.mutateAsync({ id: patientId, patch: input() });
        // The drawer closes on this outcome: "Saving…" holds every exit until it has.
        onDone({ kind: 'saved', patient }, false);
        return;
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
      onDone({ kind: 'created', patient, filed }, another);
    } catch (error) {
      failed(error, () => void save(another));
    }
  };

  return { saveState, save };
}
