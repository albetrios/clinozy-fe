import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import { patientName, type PatientRow } from '@/shared/api/app/patients-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import {
  GENDER_TONES,
  PATIENT_CONVERSION_TONES,
  PATIENT_STATUS_TONES,
  PATIENT_TYPE_TONES,
  TONE_CLASSES,
} from '@/shared/app/app-tones.ts';
import type {
  DataTableFeatures,
  DataTableFoldValue,
} from '@/shared/components/DataTable/index.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import {
  PERSON_CARD_KEYS,
  PERSON_CARD_NS,
} from '@/shared/components/PersonCard/person-card.constants.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';

import {
  FOLLOW_UP_TONES,
  followUpWhen,
  patientAge,
  PatientAgeCell,
  PatientBadges,
  PatientFollowUpCell,
  PatientIdCell,
  PatientNameCell,
  PatientUpdatedCell,
} from '../../components/PatientCells/index.ts';
import {
  PATIENTS_KEYS,
  PATIENTS_NS,
  PATIENTS_TABLE_ID,
} from '../../patients.constants.ts';
import type { PatientsSort } from '../../patients.search.ts';

/** A badge cell's meta-line value: its labels, the dot in the first badge's ink (H:4115). */
function badgeFold(
  badges: readonly { label: string; tone: Tone }[],
): DataTableFoldValue | null {
  const [first] = badges;
  if (!first) return null;
  return {
    value: badges.map((badge) => badge.label).join(', '),
    dotClassName: TONE_CLASSES[first.tone].fill,
  };
}

/** The table's row as the meta line and the phone key read it. */
const rowOf = (original: unknown) => original as PatientRow;

/**
 * The Patients columns (KICKOFF §6.5 Table; `patients.md:28–31`): ID · Patient ·
 * Gender · Type · Status · Conversion · Age · Follow-up · Updated, their
 * tracks, which sort (ID and Follow-up — the two the API sorts by), which the
 * recommended set hides (Gender, Conversion, Age) and what each folds to — the
 * meta line on a tablet, the phone rows' fold line (Updated folds to nothing).
 * The column ids are the URL's sort keys. Due goes: a row carries no dues (G4).
 */
function usePatientColumns(
  contactActions: (patient: PatientRow) => ContactCardActions,
): ColumnDef<DataTableFeatures, PatientRow>[] {
  const { t } = useTranslation(PATIENTS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const { t: tCard } = useTranslation(PERSON_CARD_NS);
  const clock = useAppClock();
  const today = appToday();

  const types = (patient: PatientRow) =>
    patient.types.map((type) => ({
      id: type,
      label: tApp(APP_KEYS.patients.types[type]),
      tone: PATIENT_TYPE_TONES[type],
    }));
  const status = (patient: PatientRow) => [
    {
      id: patient.status,
      label: tApp(APP_KEYS.patients.statuses[patient.status]),
      tone: PATIENT_STATUS_TONES[patient.status],
    },
  ];
  const gender = (patient: PatientRow) =>
    patient.gender
      ? [
          {
            id: patient.gender,
            label: tCard(PERSON_CARD_KEYS.gender[patient.gender]),
            tone: GENDER_TONES[patient.gender],
          },
        ]
      : [];
  const conversion = (patient: PatientRow) =>
    patient.conversion
      ? [
          {
            id: patient.conversion,
            label: tApp(APP_KEYS.patients.conversions[patient.conversion]),
            tone: PATIENT_CONVERSION_TONES[patient.conversion],
          },
        ]
      : [];

  return [
    {
      id: 'seq',
      accessorKey: 'seq',
      header: t(PATIENTS_KEYS.columns.seq),
      enableHiding: false,
      cell: ({ row }) => <PatientIdCell seq={row.original.seq} />,
      meta: {
        track: '64px',
        kind: 'id',
        foldValue: (original) => displayId.patient(rowOf(original).seq),
      },
    },
    {
      id: 'name',
      enableSorting: false,
      accessorFn: (patient) => patientName(patient),
      header: t(PATIENTS_KEYS.columns.name),
      cell: ({ row }) => (
        <PatientNameCell
          patient={row.original}
          today={today}
          actions={contactActions(row.original)}
        />
      ),
      meta: { track: 'minmax(200px,1.4fr)', kind: 'person' },
    },
    {
      id: 'gender',
      accessorKey: 'gender',
      header: t(PATIENTS_KEYS.columns.gender),
      enableSorting: false,
      cell: ({ row }) => <PatientBadges badges={gender(row.original)} />,
      meta: {
        track: '90px',
        kind: 'badges',
        defaultHidden: true,
        foldValue: (original) => badgeFold(gender(rowOf(original))),
      },
    },
    {
      id: 'types',
      enableSorting: false,
      accessorFn: (patient) => patient.types.join(','),
      header: t(PATIENTS_KEYS.columns.types),
      cell: ({ row }) => <PatientBadges badges={types(row.original)} />,
      meta: {
        track: 'minmax(120px,1fr)',
        kind: 'badges',
        foldValue: (original) => badgeFold(types(rowOf(original))),
      },
    },
    {
      id: 'status',
      enableSorting: false,
      accessorKey: 'status',
      header: t(PATIENTS_KEYS.columns.status),
      cell: ({ row }) => <PatientBadges badges={status(row.original)} />,
      meta: {
        track: '96px',
        kind: 'badges',
        foldValue: (original) => badgeFold(status(rowOf(original))),
      },
    },
    {
      id: 'conversion',
      enableSorting: false,
      accessorKey: 'conversion',
      header: t(PATIENTS_KEYS.columns.conversion),
      cell: ({ row }) => <PatientBadges badges={conversion(row.original)} dot />,
      meta: {
        track: '140px',
        kind: 'badges',
        defaultHidden: true,
        foldValue: (original) => badgeFold(conversion(rowOf(original))),
      },
    },
    {
      id: 'age',
      enableSorting: false,
      accessorFn: (patient) => patientAge(patient.dateOfBirth, today),
      header: t(PATIENTS_KEYS.columns.age),
      cell: ({ row }) => (
        <PatientAgeCell dateOfBirth={row.original.dateOfBirth} today={today} />
      ),
      meta: {
        track: '96px',
        defaultHidden: true,
        foldValue: (original) => {
          const age = patientAge(rowOf(original).dateOfBirth, today);
          return age === null ? null : t(PATIENTS_KEYS.table.age, { count: age });
        },
      },
    },
    {
      id: 'followUp',
      accessorKey: 'followUpAt',
      header: t(PATIENTS_KEYS.columns.followUp),
      cell: ({ row }) => (
        <PatientFollowUpCell followUpAt={row.original.followUpAt} today={today} />
      ),
      meta: {
        track: '150px',
        kind: 'badges',
        foldValue: (original) => {
          const { followUpAt } = rowOf(original);
          if (!followUpAt) return null;
          const tone = FOLLOW_UP_TONES[followUpWhen(followUpAt, today)];
          return {
            value: clock.moment(followUpAt),
            dotClassName: TONE_CLASSES[tone].fill,
          };
        },
      },
    },
    {
      id: 'updated',
      enableSorting: false,
      accessorKey: 'updatedAt',
      header: t(PATIENTS_KEYS.columns.updated),
      cell: ({ row }) => <PatientUpdatedCell patient={row.original} />,
      // No people pill: the API does not say who saved the file (G4), so the
      // cell is the time alone. It folds to nothing (H:4115).
      meta: { track: 'minmax(130px,1fr)', foldValue: () => null },
    },
  ];
}

/** What {@link usePatientsTable} needs from the page. */
export interface PatientsTableInput {
  /** The rows on screen (the cursor pages so far). */
  rows: readonly PatientRow[];
  /** The URL's column sort. */
  sort: PatientsSort | undefined;
  /** Write a new sort to the URL (`undefined` clears it). */
  onSortChange: (sort: string | undefined) => void;
  /** Each row's contact-card actions (open the file, edit, new lead / appointment). */
  contactActions: (patient: PatientRow) => ContactCardActions;
}

/**
 * The Patients table instance (KICKOFF §6.5) on the shared room table: the
 * server sorts through the URL's `sort` (ID or Follow-up; newest first without one); the Columns choice is a device pref
 * (recommended set: Gender, Conversion and Age hidden); the rows are the
 * loaded cursor pages, keyed by the patient's id.
 */
export function usePatientsTable({
  rows,
  sort,
  onSortChange,
  contactActions,
}: PatientsTableInput) {
  return useRoomTable({
    tableId: PATIENTS_TABLE_ID,
    columns: usePatientColumns(contactActions),
    rows,
    sort,
    onSortChange,
  });
}
