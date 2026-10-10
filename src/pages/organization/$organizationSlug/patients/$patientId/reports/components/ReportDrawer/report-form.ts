import type { ReportType } from '@/shared/api/clinic/clinic-schema.ts';
import type { PatientReportInput } from '@/shared/api/clinic/patient-reports-contracts.ts';
import type { PickedFile } from '@/shared/components/DrawerField/index.ts';

import { REPORT_FILE_TYPES } from '../../reports.constants.ts';

/** Upload report's fields (`patient-file.md:143–151`). */
export interface ReportFormValues {
  type: ReportType;
  name: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** Filed through the upload tray once the report is written. */
  files: PickedFile[];
  note: string;
}

/** A new report: Lab, dated today, nothing else (H:4829). */
export function newReportForm(today: string): ReportFormValues {
  return { type: 'lab', name: '', date: today, files: [], note: '' };
}

/** What `POST …/reports` sends for the form; a blank note is none. */
export function reportInputOf(values: ReportFormValues): PatientReportInput {
  const note = values.note.trim();
  return {
    type: values.type,
    name: values.name.trim(),
    date: values.date,
    notes: note === '' ? null : note,
  };
}

const FILE_TYPES: ReadonlySet<string> = new Set(REPORT_FILE_TYPES);

/** Whether the File field takes a picked or dropped file: PDF, JPG or PNG (`S:447`). */
export function takesReportFile(file: File): boolean {
  return FILE_TYPES.has(file.type);
}
