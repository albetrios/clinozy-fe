import { useState } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { localDateOf } from '@/shared/api/app/app-time.ts';
import {
  type DrawerStep,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  REPORT_KEYS,
  REPORT_NS,
  REPORT_TEST_IDS,
  REPORT_TYPE_TONES,
} from '../../reports.constants.ts';
import { newReportForm, type ReportFormValues } from './report-form.ts';
import {
  ReportDateFields,
  ReportNotesFields,
  ReportTypeNameFields,
} from './report-steps.tsx';
import { useReportSave } from './use-report-save.ts';

const K = REPORT_KEYS;

/** Props of {@link ReportDrawer}. */
export interface ReportDrawerProps {
  patientId: string;
  /** The patient's full name — the sub line (H:4831). */
  patientName: string;
  /** Today's civil date — the Date's default and its latest pick. */
  today: string;
  onClose: () => void;
}

/**
 * Upload report — `reports/create/` (KICKOFF §6.6 Drawers; H:4829–4832;
 * `patient-file.md:143–157, 374–381`): 560px, "Upload report" over the
 * patient's name; steps "Report" (Type, Name) → "Details" (Date) → "Notes"
 * (File, Note), each head naming its values; the summary "Lab · 0 files";
 * "Upload". A blank name → "Name the report"; else "Report uploaded", the row
 * appears in Reports, and the picked files follow through the upload tray.
 */
export function ReportDrawer({
  patientId,
  patientName,
  today,
  onClose,
}: ReportDrawerProps) {
  const { t } = useTranslation(REPORT_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const { formatDate } = useLocaleFormat();
  const form = useForm<ReportFormValues>({ defaultValues: newReportForm(today) });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [step, setStep] = useState<string>('report');

  const { saveState, save } = useReportSave({
    form,
    patientId,
    onStep: setStep,
    onDone: () => {
      notify.success(t(K.upload.uploaded));
      onClose();
    },
  });

  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const type = t(K.types[values.type]);
  const name = values.name.trim();
  const note = values.note.trim();
  const files = t(K.upload.files, { count: values.files.length });
  const date = formatDate(
    localDateOf(values.date),
    { day: 'numeric', month: 'short', year: 'numeric' },
    { civilDay: true },
  );
  const steps: DrawerStep[] = [
    {
      id: 'report',
      title: t(K.steps.report),
      summary: drawerStepSummary([type, name], notFilled),
      peek: [
        {
          kind: 'value',
          label: t(K.type),
          value: type,
          tone: REPORT_TYPE_TONES[values.type],
        },
        { kind: 'value', label: t(K.name), value: name || undefined },
      ],
      content: <ReportTypeNameFields form={form} values={values} />,
    },
    {
      id: 'details',
      title: t(K.steps.details),
      summary: drawerStepSummary([date], notFilled),
      peek: [{ kind: 'value', label: t(K.date), value: date }],
      content: <ReportDateFields form={form} values={values} today={today} />,
    },
    {
      id: 'notes',
      title: t(K.steps.notes),
      summary: drawerStepSummary([values.files.length ? files : '', note], notFilled),
      // The drop zone has no peek tile (H:3840 `peekOf` skips uploads).
      peek: [{ kind: 'value', label: t(K.upload.note), value: note || undefined }],
      content: <ReportNotesFields form={form} values={values} />,
    },
  ];

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={t(K.upload.title)}
      sub={isolateText(patientName)}
      // 560px as drawn (H:4831): its zone and note are full rows that fit.
      content={{ fieldCount: 5 }}
      tone="sage"
      steps={steps}
      openStep={step}
      onOpenStepChange={setStep}
      summary={t(K.upload.summary, { type, files })}
      saveLabel={t(K.upload.save)}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty}
      testId={REPORT_TEST_IDS.drawer}
    />
  );
}
