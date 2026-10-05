import { useQueryClient } from '@tanstack/react-query';
import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { PatientReport } from '@/shared/api/clinic/clinic-schema.ts';
import { attachPatientReportFile } from '@/shared/api/clinic/patient-reports-api.ts';
import { patientQueryKeys } from '@/shared/api/clinic/patients-api.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useCreatePatientReport } from '@/shared/hooks/usePatientReports/index.ts';
import { useUploadQueue } from '@/shared/hooks/useUploadQueue/index.ts';

import { REPORT_KEYS, REPORT_NS } from '../../reports.constants.ts';
import { type ReportFormValues, reportInputOf } from './report-form.ts';

/** The drawer's steps, as the save opens them. */
type ReportStepId = 'report' | 'details' | 'notes';

/** The form's fields in the drawer's order, each with its step. */
const FIELD_STEPS: readonly [FieldPath<ReportFormValues>, ReportStepId][] = [
  ['type', 'report'],
  ['name', 'report'],
  ['date', 'details'],
  ['files', 'notes'],
  ['note', 'notes'],
];

/** The contract's names the form spells differently. */
const SERVER_FIELDS = { notes: 'note' } as const;

/** Options of {@link useReportSave}. */
export interface UseReportSaveOptions {
  form: UseFormReturn<ReportFormValues>;
  patientId: string;
  onStep: (step: ReportStepId) => void;
  onDone: (report: PatientReport) => void;
}

/**
 * Upload report's write on the shared drawer save (KICKOFF §6.6): a blank
 * name → "Name the report" and the Report step opens; else `createReport`
 * (`S:1644`), then each picked file goes to the upload tray and is attached
 * to the report as the tray confirms it — the prototype saves neither the
 * files nor the note (H:4831); the build saves both (§7.3, F17). The tray
 * outlives the drawer, so the attach does not depend on it staying open.
 */
export function useReportSave({ form, patientId, onStep, onDone }: UseReportSaveOptions) {
  const { t } = useTranslation(REPORT_NS);
  const create = useCreatePatientReport({ notifyOnError: false });
  const { enqueue } = useUploadQueue();
  const queryClient = useQueryClient();

  return useDrawerSave<ReportFormValues, PatientReport>({
    form,
    fieldOrder: FIELD_STEPS.map(([field]) => field),
    serverFields: SERVER_FIELDS,
    toastId: 'report-save-failed',
    check: (values) =>
      values.name.trim() === ''
        ? { fields: ['name'], message: t(REPORT_KEYS.upload.noName) }
        : null,
    onField: (field) =>
      onStep(
        FIELD_STEPS.find(
          ([name]) => field === name || field.startsWith(`${name}.`),
        )?.[1] ?? 'report',
      ),
    write: () => create.mutateAsync(reportInputOf(form.getValues(), patientId)),
    onDone: (report) => {
      const files = form.getValues('files').map((picked) => picked.file);
      if (files.length > 0) {
        enqueue(files, {
          onUploaded: async (key) => {
            await attachPatientReportFile(report.id, key);
            void queryClient.invalidateQueries({ queryKey: patientQueryKeys.all });
          },
        });
      }
      onDone(report);
    },
  });
}
