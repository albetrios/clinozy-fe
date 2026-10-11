import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import type {
  PatientReport,
  PatientReportFile,
} from '@/shared/api/clinic/patient-reports-contracts.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerInfo,
  DrawerStepBody,
} from '@/shared/components/DrawerField/index.ts';
import {
  type DrawerStep,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { reportFileFormats } from '../../report-file.ts';
import { REPORT_KEYS, REPORT_NS, REPORT_TEST_IDS } from '../../reports.constants.ts';

const K = REPORT_KEYS;
const TEST_ID = REPORT_TEST_IDS.view;

/** One step of the viewer: its read-only values, a full row or a third each. */
function ViewStep({
  rows,
}: {
  rows: readonly {
    id: string;
    label: string;
    value: string;
    span: 'third' | 'full';
    wrap?: boolean;
    /** Under the value: the File row's links. */
    after?: ReactNode;
  }[];
}) {
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        {rows.map((row) => (
          <DrawerField key={row.id} label={row.label} span={row.span}>
            <DrawerInfo wrap={row.wrap} testId={`${TEST_ID}-${row.id}`}>
              {row.value}
            </DrawerInfo>
            {row.after}
          </DrawerField>
        ))}
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/**
 * Each file under the File row: its name, opening the file in a new tab (`file_url`, clinozy-be
 * D86 — shown inline and saved under that name), or "No longer available" when its upload is gone.
 */
function ReportFileLinks({ files }: { files: readonly PatientReportFile[] }) {
  const { t } = useTranslation(REPORT_NS);
  if (files.length === 0) return null;
  return (
    <ul data-testid={`${TEST_ID}-files`} className="mt-1.5 flex min-w-0 flex-col gap-1">
      {files.map((file) => (
        <li key={file.fileKey} className="text-body min-w-0 truncate">
          {file.fileUrl ? (
            <a
              href={file.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`${TEST_ID}-file-link`}
              className="text-foreground font-medium underline underline-offset-4"
            >
              {file.fileName ?? reportFileFormats([file.fileKey])}
            </a>
          ) : (
            <span className="text-muted-foreground">{t(K.view.fileGone)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Props of {@link ReportView}. */
export interface ReportViewProps {
  report: PatientReport;
  /** The patient's full name — the sub line. */
  patientName: string;
  onClose: () => void;
}

/**
 * Report view — `reports/$reportId/` (KICKOFF §6.6 Drawers; H:4019;
 * `patient-file.md:285–299, 374–381`): 560px in sky, the report's name with
 * its type as the tag, "Dharti Galani · 20 Sep 2026"; read-only steps
 * "Report" (Type, Date) → "Details" (File: "2 files · PDF", then each file's
 * name opening it) → "Notes" ("No notes on this report" when empty). The
 * footer's "Download" (clinozy-be D86) opens a single file in a new tab with
 * "Downloading CBC + Thyroid profile", or, for several, the Details step that
 * lists them; no footer when no file can be opened. Gone: "Added by" — the
 * API does not say who added a report (G4).
 */
export function ReportView({ report, patientName, onClose }: ReportViewProps) {
  const { t } = useTranslation(REPORT_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const { formatDate } = useLocaleFormat();
  const [step, setStep] = useState<string>('report');
  const type = t(K.types[report.type]);
  const date = formatDate(
    localDateOf(report.date),
    { day: 'numeric', month: 'short', year: 'numeric' },
    { civilDay: true },
  );
  const notes = report.notes?.trim() || t(K.view.noNotes); // NOSONAR(S6606): blank notes are none — "" falls back
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const files = [
    t(K.upload.files, { count: report.fileKeys.length }),
    reportFileFormats(report.fileKeys),
  ]
    .filter(Boolean)
    .join(' · ');
  const openable = report.files.flatMap((file) => (file.fileUrl ? [file.fileUrl] : []));
  const download = () => {
    const [only] = openable;
    if (openable.length !== 1 || only === undefined) {
      setStep('details');
      return;
    }
    window.open(only, '_blank', 'noopener,noreferrer');
    notify.success(t(K.view.downloading, { name: report.name }));
  };

  const steps: DrawerStep[] = [
    {
      id: 'report',
      title: t(K.steps.report),
      summary: drawerStepSummary([type, date], notFilled),
      content: (
        <ViewStep
          rows={[
            { id: 'type', label: t(K.type), value: type, span: 'third' },
            { id: 'date', label: t(K.date), value: date, span: 'third' },
          ]}
        />
      ),
    },
    {
      id: 'details',
      title: t(K.steps.details),
      summary: drawerStepSummary([files], notFilled),
      content: (
        <ViewStep
          rows={[
            {
              id: 'file',
              label: t(K.file),
              value: files,
              span: 'full',
              after: <ReportFileLinks files={report.files} />,
            },
          ]}
        />
      ),
    },
    {
      id: 'notes',
      title: t(K.steps.notes),
      summary: notes,
      content: (
        <ViewStep
          rows={[
            {
              id: 'notes',
              label: t(K.view.notes),
              value: notes,
              span: 'full',
              wrap: true,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={report.name}
      tag={type}
      sub={t(K.view.sub, isolateValues({ name: patientName, date }))}
      // 560px as drawn (H:4019).
      content={{ fieldCount: 5 }}
      tone="sky"
      // Opened as a child of the file (H:4019): its close reads "Back".
      stacked
      steps={steps}
      openStep={step}
      onOpenStepChange={setStep}
      // "Download" when a file can be opened (D86); no edit in the design.
      hideFooter={openable.length === 0}
      summary={files}
      saveLabel={t(K.view.download)}
      onSave={download}
      saveTestId={`${TEST_ID}-download`}
      testId={TEST_ID}
    />
  );
}
