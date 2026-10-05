import type { TFunction } from 'i18next';

import { isolateJoin, isolateText } from '@/lib/bidi-isolate.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { PatientPickRow } from '@/shared/api/clinic/patient-search-api.ts';
import type { PatientRow } from '@/shared/api/clinic/patients-contracts.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { personInitials } from '@/shared/components/Cells/index.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';

import { PATIENT_PICKER_KEYS } from './patient-picker.constants.ts';

/** A patient the field can take, as its options carry it. */
export type PatientPick = Extract<PatientPickRow, { kind: 'patient' }>;

/**
 * One row of the patient field (`payments.md:101`): a patient with its dues,
 * display id and mobile — "₹8,550 due · #3441 · +91 98791 22840", or "Nothing
 * due · …" — on a 26px avatar with the "P" badge; a lead greyed out, "Lead
 * #2363 · not a patient yet", which the field never takes.
 */
export function patientPickOption(
  row: PatientPickRow,
  t: TFunction,
  formatPaise: (paise: number) => string,
): PickerOption<PatientPickRow> {
  if (row.kind === 'lead') {
    return {
      key: row.id,
      label: row.name,
      sub: t(PATIENT_PICKER_KEYS.lead, { id: isolateText(displayId.lead(row.seq)) }),
      leading: { kind: 'avatar', initials: personInitials(row.name) },
      disabled: true,
      data: row,
    };
  }
  const due =
    row.due > 0
      ? t(PATIENT_PICKER_KEYS.due, { amount: formatPaise(row.due) })
      : t(PATIENT_PICKER_KEYS.nothingDue);
  return {
    key: row.id,
    label: row.name,
    // Each part isolated: the phone stays whole on a right-to-left page.
    sub: isolateJoin([
      due,
      displayId.patient(row.seq),
      row.phone ? formatClinicPhone(row.phone) : '',
    ]),
    leading: { kind: 'avatar', initials: personInitials(row.name), patient: true },
    data: row,
  };
}

/** A patient read on its own (the field's current value) as the field's row. */
export function patientPickOf(patient: PatientRow): PatientPick {
  return {
    kind: 'patient',
    id: patient.id,
    seq: patient.seq,
    name: patientName(patient),
    phone: patient.phone,
    due: patient.dueTotal,
  };
}
