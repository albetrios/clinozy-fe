import type { PatientRecord } from '@/shared/api/clinic/patients-contracts.ts';
import type {
  PrescriptionRecord,
  RxSheetClinic,
} from '@/shared/api/clinic/prescriptions-contracts.ts';
import {
  PrescriptionPrint,
  printDocument,
} from '@/shared/components/PrintTemplate/index.ts';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import {
  useLoadRxSheetClinic,
  useRxSheetClinic,
} from '@/shared/hooks/usePrescriptions/index.ts';

import {
  type StaffChip,
  useStaffLookup,
} from '../../../shared/hooks/useStaffLookup/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';

/** What a printed sheet prints of a prescription — a read, or a drawer's form over one. */
export type RxPrintable = Pick<
  PrescriptionRecord,
  | 'seq'
  | 'date'
  | 'doctorId'
  | 'items'
  | 'labReport'
  | 'procedureToday'
  | 'advice'
  | 'followUpDate'
>;

/** What the A4 sheet prints beyond the prescription: the patient, the doctor, the clinic, its branch. */
export interface RxSheet extends RxSheetClinic {
  patient: Pick<PatientRecord, 'firstName' | 'lastName' | 'seq' | 'dateOfBirth'>;
  /** The team keeps one display name ("Dr. Nisha Shah"), printed whole. */
  doctor: { firstName: string; lastName: null } | null;
}

/** The sheet's doctor from the team. */
const sheetDoctor = (member: StaffChip | null): RxSheet['doctor'] =>
  member ? { firstName: member.name, lastName: null } : null;

/** A prescription's A4 sheet (L-22): the clinic's own identity, never the design's sample clinic. */
export function rxSheetElement(prescription: RxPrintable, sheet: RxSheet) {
  return (
    <PrescriptionPrint
      prescription={prescription}
      patient={sheet.patient}
      doctor={sheet.doctor}
      organization={sheet.organization}
      branch={sheet.branch}
    />
  );
}

/**
 * The patient file's printed-sheet parts: the patient (the file's read), the doctor (the team)
 * and the clinic with the patient's home branch (`useRxSheetClinic`).
 */
function useRxSheetParts() {
  const { file } = usePatientFileContext();
  const staff = useStaffLookup();
  const branchId = file?.patient.homeBranchId ?? null;
  return { patient: file?.patient, staff, branchId };
}

/** The A4 sheet's parts for one prescription — undefined until the file and the clinic are read. */
export function useRxSheet(prescription: RxPrintable): RxSheet | undefined {
  const { patient, staff, branchId } = useRxSheetParts();
  const clinic = useRxSheetClinic(branchId);
  if (!(patient && clinic.data)) return undefined;
  return { ...clinic.data, patient, doctor: sheetDoctor(staff(prescription.doctorId)) };
}

/**
 * Print a prescription's A4 sheet in the browser (§6 #26). The clinic is read ahead, so a print
 * is instant; one asked for before it lands waits for it — never skipped — and goes on even if
 * the drawer has closed meanwhile. A failed read has toasted itself, with Retry; a failed print
 * toasts.
 */
export function useRxPrint(): (prescription: RxPrintable) => Promise<void> {
  const { patient, staff, branchId } = useRxSheetParts();
  useRxSheetClinic(branchId);
  const loadClinic = useLoadRxSheetClinic();
  return async (prescription) => {
    if (!patient) return;
    const clinic = await loadClinic(branchId).catch(() => null);
    if (!clinic) return;
    await printDocument(
      rxSheetElement(prescription, {
        ...clinic,
        patient,
        doctor: sheetDoctor(staff(prescription.doctorId)),
      }),
    ).catch(notifyError);
  };
}
