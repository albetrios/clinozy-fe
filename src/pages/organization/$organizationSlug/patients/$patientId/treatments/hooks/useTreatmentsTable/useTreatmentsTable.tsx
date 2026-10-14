import { type ColumnDef, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import type { TreatmentRecord } from '@/shared/api/app/treatments-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { CHECKIN_FEEL_TONES, TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';

import {
  EmptyCell,
  PATIENT_SECTION_TABLE_IDS,
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
  TeamCell,
  useTableDay,
} from '../../../shared/components/PatientSectionTable/index.ts';
import {
  type StaffChip,
  useStaffLookup,
} from '../../../shared/hooks/useStaffLookup/index.ts';
import {
  teethOf,
  treatmentDetailsPeek,
  treatmentFormOf,
} from '../../components/TreatmentDrawer/index.ts';
import { TREATMENT_KEYS } from '../../treatments.constants.ts';

const keys = PATIENT_TABLE_KEYS;
const rowOf = (original: unknown) => original as TreatmentRecord;

/** How many of the template's values the Details cell joins (H:4754 `trDetail`). */
const DETAILS_SHOWN = 4;

/** Days until each aftercare call (H:4754 `cb`): the next day, in 2 days, in a week. */
const CALL_IN_DAYS = { none: 0, next_day: 1, in_two_days: 2, in_week: 7 } as const;

/** What the Feedback cell says of a treatment, and in which tone. */
interface TreatmentFeedback {
  label: string;
  tone: Tone;
  /** The pill's tooltip: "Check-in 26 Sep 2026". */
  title?: string;
}

/**
 * A treatment's feedback (H:4754 `fbOf`): a reversed one says so, its reason
 * on hover; else its latest check-in (the server's `latest_check_in`) —
 * "Better · 7/10" in the feel's tone — else the aftercare call still to make
 * in butter ("Call next day", "Call in 2 days"), else nothing ("—").
 */
function treatmentFeedback(
  treatment: TreatmentRecord,
  t: TFunction,
  formatDay: (civilDate: string) => string,
): TreatmentFeedback | null {
  if (treatment.status === 'reversed') {
    return {
      label: t(TREATMENT_KEYS.reverse.status),
      tone: 'blush',
      title: treatment.reversedReason ?? undefined,
    };
  }
  const checkIn = treatment.latestCheckIn;
  if (checkIn) {
    return {
      label: t(keys.treatments.feedbackScore, {
        feel: t(APP_KEYS.checkInFeels[checkIn.feel], { ns: APP_NS }),
        score: checkIn.score,
      }),
      tone: CHECKIN_FEEL_TONES[checkIn.feel],
      title: t(keys.treatments.checkInOn, { date: formatDay(checkIn.date) }),
    };
  }
  const days = CALL_IN_DAYS[treatment.aftercareCall];
  if (days === 0) return null;
  return {
    label:
      days === 1
        ? t(keys.treatments.callNextDay)
        : t(keys.treatments.callInDays, { count: days }),
    tone: 'butter',
  };
}

/**
 * A treatment's Area and Details (H:4754 `trArea`, `trDetail`), in the
 * drawer's own words: a dental one's teeth ("#11"), else its areas; and the
 * first filled values of its template's other fields, joined.
 */
function useTreatmentParts() {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const day = useTableDay();
  return (treatment: TreatmentRecord) => {
    const peek = treatmentDetailsPeek(treatmentFormOf(treatment), t, (date) => day(date));
    const teethLabel = t(TREATMENT_KEYS.dental.teeth);
    const areas =
      treatment.template === 'dental'
        ? teethOf(treatment.parameters.teeth).map((tooth) => `#${tooth}`)
        : peek.flatMap((tile) =>
            tile.kind === 'multi' ? tile.values.map((pill) => pill.label) : [],
          );
    const details = peek
      .flatMap((tile) =>
        tile.kind === 'value' && tile.value && tile.label !== teethLabel
          ? [tile.value]
          : [],
      )
      .slice(0, DETAILS_SHOWN)
      .join(' · ');
    return { areas, details };
  };
}

/**
 * The Treatments columns (KICKOFF §6.6 Section tables; H:4754): Treatment ·
 * Area · Team (hidden) · Session · Details (hidden) · Feedback · Date — no
 * ID column, as a treatment has no display number (N1). On a phone Treatment
 * leads, Area is the key and the session, the feedback and the date fold
 * under it.
 */
function useTreatmentsColumns(): ColumnDef<DataTableFeatures, TreatmentRecord>[] {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const day = useTableDay();
  const clock = useAppClock();
  const staff = useStaffLookup();
  const parts = useTreatmentParts();
  const team = (treatment: TreatmentRecord) =>
    [staff(treatment.doctorId), staff(treatment.therapistId)].filter(
      (person): person is StaffChip => person !== null,
    );
  const feedback = (treatment: TreatmentRecord) =>
    treatmentFeedback(treatment, t, (date) => day(date));
  const template = (treatment: TreatmentRecord) =>
    t(TREATMENT_KEYS.templates[treatment.template]);

  return [
    {
      id: 'treatment',
      accessorKey: 'name',
      header: t(keys.columns.treatment),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              'text-body truncate font-medium',
              // A reversed session stays in the file, struck through.
              row.original.status === 'reversed' && 'text-muted-foreground line-through',
            )}
          >
            {row.original.name}
          </span>
          <span className="text-caption text-muted-foreground truncate">
            {template(row.original)}
          </span>
        </span>
      ),
      meta: { track: 'minmax(180px,1.3fr)', primary: true },
    },
    {
      id: 'area',
      accessorFn: (row) => parts(row).areas.join(', '),
      header: t(keys.columns.area),
      enableSorting: false,
      cell: ({ row }) => {
        const { areas } = parts(row.original);
        if (areas.length === 0) return <EmptyCell />;
        return (
          <span className="flex min-w-0 flex-wrap gap-1">
            {areas.map((area) => (
              <TonePill key={area} tone="sky">
                {area}
              </TonePill>
            ))}
          </span>
        );
      },
      meta: {
        track: 'minmax(110px,.9fr)',
        kind: 'badges',
        foldValue: (original) => parts(rowOf(original)).areas.join(', ') || null,
      },
    },
    {
      id: 'team',
      accessorFn: (row) =>
        team(row)
          .map((person) => person.name)
          .join(', '),
      header: t(keys.columns.team),
      enableSorting: false,
      cell: ({ row }) => <TeamCell people={team(row.original)} />,
      meta: { track: '90px', defaultHidden: true, foldValue: () => null },
    },
    {
      id: 'session',
      accessorKey: 'sessionNumber',
      header: t(keys.columns.session),
      enableSorting: false,
      cell: ({ row }) => (
        <TonePill tone="butter">{`#${row.original.sessionNumber}`}</TonePill>
      ),
      meta: {
        track: '80px',
        kind: 'badges',
        foldValue: (original) => ({
          value: `#${rowOf(original).sessionNumber}`,
          dotClassName: TONE_CLASSES.butter.fill,
        }),
      },
    },
    {
      id: 'details',
      accessorFn: (row) => parts(row).details || '—',
      header: t(keys.columns.details),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-body text-muted-foreground-strong truncate">
          {parts(row.original).details || '—'}
        </span>
      ),
      meta: { track: 'minmax(200px,1.5fr)', defaultHidden: true },
    },
    {
      id: 'feedback',
      accessorFn: (row) => feedback(row)?.label ?? '—',
      header: t(keys.columns.feedback),
      enableSorting: false,
      cell: ({ row }) => {
        const said = feedback(row.original);
        if (!said) return <EmptyCell />;
        return (
          <TonePill tone={said.tone} title={said.title}>
            {said.label}
          </TonePill>
        );
      },
      meta: {
        track: '150px',
        kind: 'badges',
        foldValue: (original) => {
          const said = feedback(rowOf(original));
          return said
            ? { value: said.label, dotClassName: TONE_CLASSES[said.tone].fill }
            : null;
        },
      },
    },
    {
      id: 'date',
      accessorFn: (row) => clock.moment(row.performedAt),
      header: t(keys.columns.date),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-body text-muted-foreground-strong truncate tabular-nums">
          {clock.moment(row.original.performedAt)}
        </span>
      ),
      meta: { track: '160px' },
    },
  ];
}

/**
 * The Treatments table: the patient's sessions, newest first, each with its
 * latest check-in; the Columns choice is a device pref.
 */
export function useTreatmentsTable(rows: readonly TreatmentRecord[]) {
  const columns = useTreatmentsColumns();
  const visibility = useHiddenColumns(PATIENT_SECTION_TABLE_IDS.treatments, columns);
  return useTable({
    features: dataTableFeatures,
    data: rows as TreatmentRecord[],
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.id,
    state: { columnVisibility: visibility.columnVisibility },
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
