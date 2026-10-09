import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import type { PatientReportDetail } from '@/shared/api/clinic/patient-reports-api.ts';
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

import { reportFileFormat } from '../../report-file.ts';
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
          </DrawerField>
        ))}
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/** Props of {@link ReportView}. */
export interface ReportViewProps {
  detail: PatientReportDetail;
  /** The patient's full name — the sub line. */
  patientName: string;
  onClose: () => void;
}

/**
 * Report view — `reports/$reportId/` (KICKOFF §6.6 Drawers; H:4019;
 * `patient-file.md:285–299, 374–381`): 560px in sky, the report's name with
 * its type as the tag, "Dharti Galani · 20 Sep 2026"; read-only steps
 * "Report" (Type, Date) → "Details" (Added by, File) → "Notes" ("No notes on
 * this report" when empty). "Download" → "Downloading CBC + Thyroid profile"
 * and the drawer closes, as drawn — the contract serves no download yet.
 */
export function ReportView({ detail, patientName, onClose }: ReportViewProps) {
  const { t } = useTranslation(REPORT_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const { formatDate } = useLocaleFormat();
  const [step, setStep] = useState<string>('report');
  const { report, addedBy } = detail;
  const type = t(K.types[report.type]);
  const date = formatDate(
    localDateOf(report.date),
    { day: 'numeric', month: 'short', year: 'numeric' },
    { civilDay: true },
  );
  const notes = report.notes?.trim() || t(K.view.noNotes); // NOSONAR(S6606): blank notes are none — "" falls back
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);

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
      summary: drawerStepSummary([addedBy, report.name], notFilled),
      content: (
        <ViewStep
          rows={[
            {
              id: 'added-by',
              label: t(K.view.addedBy),
              value: addedBy ?? '—',
              span: 'third',
            },
            {
              id: 'file',
              label: t(K.file),
              value: t(K.view.fileLine, {
                name: report.name,
                format: reportFileFormat(report.files),
              }),
              span: 'full',
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
      // 560px as drawn (H:4019): five read-only values.
      content={{ fieldCount: 5 }}
      tone="sky"
      // Opened as a child of the file (H:4019): its close reads "Back".
      stacked
      steps={steps}
      openStep={step}
      onOpenStepChange={setStep}
      saveLabel={t(K.view.download)}
      onSave={() => {
        notify.info(t(K.view.downloading, { name: report.name }));
        onClose();
      }}
      testId={TEST_ID}
    />
  );
}
