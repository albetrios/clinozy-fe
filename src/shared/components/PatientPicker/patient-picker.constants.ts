import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The patient field lives in `clinic`: Receive payment and the Invoice drawer
 * both carry it, wherever they open (KICKOFF §6.9).
 */
export const PATIENT_PICKER_NS = I18N_NAMESPACES.clinic;

/** Key paths for the patient field (`payments.md:101`; verbatim). */
export const PATIENT_PICKER_KEYS = {
  /** "Patient". */
  label: 'patientPicker.label',
  /** "Search patients". */
  placeholder: 'patientPicker.placeholder',
  /** "only patients can be picked" — the field's hint. */
  hint: 'patientPicker.hint',
  /** "₹8,550 due" — a patient's dues on its option. */
  due: 'patientPicker.due',
  /** "Nothing due". */
  nothingDue: 'patientPicker.nothingDue',
} as const;

/** The field's base test id; its parts derive theirs (`-option-<id>` …). */
export const PATIENT_PICKER_TEST_ID = 'patient-picker';
