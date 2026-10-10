import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { REPORT_TYPE_VALUES } from '@/shared/api/clinic/clinic-schema.ts';
import { REPORT_LIMITS } from '@/shared/api/clinic/patient-reports-contracts.ts';
import { UPLOAD_MAX_BYTES } from '@/shared/api/uploads-api.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerFilesField,
  DrawerInput,
  DrawerStepBody,
  DrawerTextarea,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { formatFileSize } from '@/shared/components/UploadTray/format-file-size.ts';
import { UPLOAD_TRAY_NS } from '@/shared/components/UploadTray/upload-tray.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import {
  REPORT_FILE_TYPES,
  REPORT_KEYS,
  REPORT_NS,
  REPORT_TEST_IDS,
  REPORT_TYPE_TONES,
} from '../../reports.constants.ts';
import { type ReportFormValues, takesReportFile } from './report-form.ts';

const K = REPORT_KEYS;
const TEST_ID = REPORT_TEST_IDS.drawer;

/** What a step's fields render from. */
interface ReportStepFieldsProps {
  form: UseFormReturn<ReportFormValues>;
  values: ReportFormValues;
}

/**
 * Step 1 "Report" (H:4829; `patient-file.md:147–148`): Type — Lab (mint,
 * the default) · Scan (sky) · Consent (lav) · Other (stone) — and Name, "e.g.
 * CBC report", which the save asks for.
 */
export function ReportTypeNameFields({ form, values }: ReportStepFieldsProps) {
  const { t } = useTranslation(REPORT_NS);
  const ids = useId();
  const field = useDrawerFieldIds(form, ids);
  const name = field('name');
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        <DrawerField label={t(K.type)} span="full">
          <DrawerChips
            label={t(K.type)}
            options={REPORT_TYPE_VALUES.map((type) => ({
              value: type,
              label: t(K.types[type]),
              tone: REPORT_TYPE_TONES[type],
            }))}
            value={values.type}
            onChange={(type) => {
              if (type) form.setValue('type', type, { shouldDirty: true });
            }}
            testId={`${TEST_ID}-type`}
          />
        </DrawerField>
        <DrawerField
          label={t(K.name)}
          htmlFor={name.id}
          error={name.error}
          span="half"
          stretch={false}
        >
          <DrawerInput
            {...name.control}
            {...form.register('name')}
            aria-required="true"
            maxLength={REPORT_LIMITS.name}
            placeholder={t(K.upload.namePlaceholder)}
            data-testid={`${TEST_ID}-name`}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/** Step 2 "Details" (`patient-file.md:149`): Date — today prefilled, a year back. */
export function ReportDateFields({
  form,
  values,
  today,
}: ReportStepFieldsProps & { today: string }) {
  const { t } = useTranslation(REPORT_NS);
  const ids = useId();
  const date = useDrawerFieldIds(form, ids)('date');
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        <DrawerField
          label={t(K.date)}
          htmlFor={date.id}
          error={date.error}
          span="half"
          stretch={false}
        >
          <DatePicker
            id={date.id}
            label={t(K.date)}
            value={values.date}
            onChange={(date) =>
              form.setValue('date', date ?? today, { shouldDirty: true })
            }
            today={today}
            future={0}
            past={365}
            max={today}
            size="md"
            testId={`${TEST_ID}-date`}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/**
 * Step 3 "Notes" (`patient-file.md:150–151`; `S:447`): File — "Drop the report
 * or browse", PDF, JPG or PNG up to 10 MB each (the tray skips a larger one
 * with its own toast) — and Note, "Optional", ≤1,000 characters.
 */
export function ReportNotesFields({ form, values }: ReportStepFieldsProps) {
  const { t } = useTranslation(REPORT_NS);
  const { t: tTray } = useTranslation(UPLOAD_TRAY_NS);
  const { formatNumber } = useLocaleFormat();
  const ids = useId();
  const field = useDrawerFieldIds(form, ids);
  const files = field('files');
  const note = field('note');
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        <DrawerField label={t(K.file)} htmlFor={files.id} error={files.error} span="full">
          <DrawerFilesField
            id={files.id}
            files={values.files}
            onChange={(files) =>
              form.setValue('files', files.slice(0, REPORT_LIMITS.files), {
                shouldDirty: true,
              })
            }
            accept={REPORT_FILE_TYPES.join(',')}
            takes={takesReportFile}
            title={t(K.upload.drop)}
            hint={t(K.upload.fileHint, {
              limit: formatFileSize(UPLOAD_MAX_BYTES['organization-file'], {
                t: tTray,
                formatNumber,
              }),
            })}
            removeLabel={(name) => t(K.upload.remove, { name })}
            testId={`${TEST_ID}-file`}
          />
        </DrawerField>
        <DrawerField
          label={t(K.upload.note)}
          htmlFor={note.id}
          error={note.error}
          span="full"
        >
          <DrawerTextarea
            {...note.control}
            rows={3}
            maxLength={REPORT_LIMITS.notes}
            placeholder={t(K.upload.notePlaceholder)}
            data-testid={`${TEST_ID}-note`}
            {...form.register('note')}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}
