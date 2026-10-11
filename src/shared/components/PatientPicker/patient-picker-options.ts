import type { TFunction } from 'i18next';

import { isolateJoin } from '@/lib/bidi-isolate.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { PatientPickRow } from '@/shared/api/app/patient-search-api.ts';
import type { PatientRow } from '@/shared/api/app/patients-contracts.ts';
import { formatAppPhone } from '@/shared/app/app-phone.ts';
import { personInitials } from '@/shared/components/Cells/index.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';

import { PATIENT_PICKER_KEYS } from './patient-picker.constants.ts';

/** A patient the field can take, as its options carry it. */
export type PatientPick = PatientPickRow;

/** The dues part of an option's line: "₹8,550 due", "Nothing due", or none when not read. */
function duePart(
  due: number | null,
  t: TFunction,
  formatRupees: (rupees: number) => string,
) {
  if (due === null) return '';
  return due > 0
    ? t(PATIENT_PICKER_KEYS.due, { amount: formatRupees(due) })
    : t(PATIENT_PICKER_KEYS.nothingDue);
}

/**
 * One row of the patient field (`payments.md:101`): a patient with their display id and mobile —
 * and their dues once read (the picked one) — "₹8,550 due · #3441 · +91 98791 22840" — on a
 * 26px avatar with the "P" badge.
 */
export function patientPickOption(
  row: PatientPickRow,
  t: TFunction,
  formatRupees: (rupees: number) => string,
): PickerOption<PatientPickRow> {
  return {
    key: row.id,
    label: row.name,
    // Each part isolated: the phone stays whole on a right-to-left page.
    sub: isolateJoin([
      duePart(row.due, t, formatRupees),
      displayId.patient(row.seq),
      row.phone ? formatAppPhone(row.phone) : '',
    ]),
    leading: { kind: 'avatar', initials: personInitials(row.name), patient: true },
    data: row,
  };
}

/** A patient read on its own (the field's current value) as the field's row, with their dues. */
export function patientPickOf(
  patient: Pick<PatientRow, 'id' | 'seq' | 'contactId' | 'name' | 'phone'>,
  due: number | null,
): PatientPick {
  return {
    kind: 'patient',
    id: patient.id,
    contactId: patient.contactId,
    seq: patient.seq,
    name: patient.name,
    phone: patient.phone,
    due,
  };
}
