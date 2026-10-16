import { useTranslation } from 'react-i18next';

import { isolateJoin } from '@/lib/bidi-isolate.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { ContactHit } from '@/shared/api/app/contacts-contracts.ts';
import { formatAppPhone } from '@/shared/app/app-phone.ts';
import { ContactQuickPickField } from '@/shared/components/ContactQuickPick/index.ts';
import { usePatient } from '@/shared/hooks/usePatients/index.ts';

import type { PatientPick } from './patient-pick.ts';
import {
  PATIENT_PICKER_KEYS,
  PATIENT_PICKER_NS,
  PATIENT_PICKER_TEST_ID,
} from './patient-picker.constants.ts';
import { useQuickAddPatient } from './use-quick-add-patient.ts';

/** Props of {@link PatientPicker}. */
export interface PatientPickerProps {
  /** The picked patient's id. */
  value: string | null;
  /** A patient picked or added. */
  onChange: (patient: PatientPick | null) => void;
  /** The trigger's id, for the field's `<label htmlFor>`. */
  id?: string;
  'aria-describedby'?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Base test id (default `patient-picker`): `-search`, `-option-<pat_…>`, `-create`. */
  testId?: string;
}

/** A patient hit as the field takes it — a hit without a file is not offered (`scope`). */
function pickOf(hit: ContactHit): PatientPick | null {
  if (!hit.patientId) return null;
  return {
    id: hit.patientId,
    contactId: hit.id,
    name: hit.name,
    phone: hit.primaryPhone,
  };
}

/**
 * The patient field (KICKOFF §6.9 Receive payment; `payments.md:101`) on the contact picker
 * every drawer shares (change-contact-quick-pick D23, `ContactQuickPickField` with the patients
 * scope): the clinic's patients by name, mobile or contact number — the five last in touch
 * before anything is typed — each as "#3441 · +91 98791 22840" on the sage avatar with the "P";
 * ↵ takes the first. Nobody on file: the add row's quick add registers them (Name and a 10-digit
 * Mobile, `useQuickAddPatient`). Shared by Receive payment and the Invoice drawer.
 */
export function PatientPicker({
  value,
  onChange,
  id,
  invalid,
  disabled,
  testId = PATIENT_PICKER_TEST_ID,
  ...rest
}: PatientPickerProps) {
  const { t } = useTranslation(PATIENT_PICKER_NS);
  const current = usePatient(value ?? undefined);
  const addPatient = useQuickAddPatient();
  const picked = current.data
    ? {
        key: current.data.id,
        name: current.data.name,
        tone: 'sage' as const,
        patient: true,
      }
    : null;

  return (
    <ContactQuickPickField
      scope="patients"
      id={id}
      aria-describedby={rest['aria-describedby']}
      invalid={invalid}
      disabled={disabled}
      value={picked}
      title={t(PATIENT_PICKER_KEYS.label)}
      placeholder={t(PATIENT_PICKER_KEYS.placeholder)}
      searchPlaceholder={t(PATIENT_PICKER_KEYS.placeholder)}
      searchLabel={t(PATIENT_PICKER_KEYS.label)}
      requirePhone
      // A patient file keeps a name and a mobile; a typed handle is left out (D6).
      takesInstagram={false}
      describe={(hit) => ({
        // Each part isolated: the phone stays whole on a right-to-left page.
        line: isolateJoin([
          hit.patientNumber == null
            ? displayId.contact(hit.contactNumber)
            : displayId.patient(hit.patientNumber),
          hit.primaryPhone ? formatAppPhone(hit.primaryPhone) : '',
        ]),
        tone: 'sage',
      })}
      onPick={(hit) => {
        const patient = pickOf(hit);
        if (patient) onChange(patient);
      }}
      onQuickAdd={async (draft) => onChange(await addPatient(draft))}
      testId={testId}
      testIds={{
        search: `${testId}-search`,
        hit: (hit) => `${testId}-option-${hit.patientId ?? hit.id}`,
        add: `${testId}-create`,
        noMatch: `${testId}-empty`,
      }}
    />
  );
}
