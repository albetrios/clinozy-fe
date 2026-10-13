import { useTranslation } from 'react-i18next';

import {
  patientPickerQueryKeys,
  type PatientPickRow,
  searchPatientPicker,
} from '@/shared/api/app/patient-search-api.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { useInvoiceTotals } from '@/shared/hooks/useInvoices/index.ts';
import { usePatient } from '@/shared/hooks/usePatients/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import {
  PATIENT_PICKER_KEYS,
  PATIENT_PICKER_NS,
  PATIENT_PICKER_TEST_ID,
} from './patient-picker.constants.ts';
import {
  type PatientPick,
  patientPickOf,
  patientPickOption,
} from './patient-picker-options.ts';

/** Props of {@link PatientPicker}. */
export interface PatientPickerProps {
  /** The picked patient's id. */
  value: string | null;
  /** A patient picked, or the field cleared. */
  onChange: (patient: PatientPick | null) => void;
  /** The trigger's id, for the field's `<label htmlFor>`. */
  id?: string;
  'aria-describedby'?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Offers "New patient · “q”" — the full form stacked on top (the Invoice drawer, Q-P2). */
  onCreateFull?: (query: string) => void;
  createFullLabel?: string;
  /** Base test id (default `patient-picker`). */
  testId?: string;
}

/**
 * The patient field (KICKOFF §6.9 Receive payment; `payments.md:101`): a
 * remote search over the clinic's patients on clinozy-be — name, mobile or
 * contact number, 450ms — and the picked patient on its avatar chip in the
 * trigger, with what they still owe (their invoices' total). A pick carries
 * the patient's contact, which a receipt or an invoice names. Shared by
 * Receive payment and the Invoice drawer.
 */
export function PatientPicker({
  value,
  onChange,
  id,
  invalid,
  disabled,
  onCreateFull,
  createFullLabel,
  testId = PATIENT_PICKER_TEST_ID,
  ...rest
}: PatientPickerProps) {
  const { t } = useTranslation(PATIENT_PICKER_NS);
  const formatRupees = useRupeeFormat();
  const current = usePatient(value ?? undefined);
  const totals = useInvoiceTotals(value === null ? null : { patientId: value });
  const selected: PickerOption<PatientPickRow>[] = current.data
    ? [
        patientPickOption(
          patientPickOf(current.data, totals.data?.due ?? null),
          t,
          formatRupees,
        ),
      ]
    : [];

  return (
    <Picker<PatientPickRow>
      id={id}
      aria-describedby={rest['aria-describedby']}
      invalid={invalid}
      disabled={disabled}
      label={t(PATIENT_PICKER_KEYS.label)}
      placeholder={t(PATIENT_PICKER_KEYS.placeholder)}
      searchPlaceholder={t(PATIENT_PICKER_KEYS.placeholder)}
      loadOptionsKey={patientPickerQueryKeys.all}
      loadOptions={async (query, cursor) => {
        const page = await searchPatientPicker(query, cursor ?? null);
        return {
          rows: page.items.map((row) => patientPickOption(row, t, formatRupees)),
          next: page.nextCursor,
          hasMore: page.nextCursor !== null,
        };
      }}
      selectedOptions={selected}
      value={value}
      onChange={(_key, option) => onChange(option?.data ?? null)}
      onCreateFull={onCreateFull}
      createFullLabel={createFullLabel}
      size="md"
      minWidth={280}
      testId={testId}
    />
  );
}
