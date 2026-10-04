'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve it
// stale answers (see `DataTable.tsx`).

import type { ReactTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { PatientRow, PatientView } from '@/shared/api/clinic/patients-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  GENDER_TONES,
  PATIENT_CONVERSION_TONES,
  PATIENT_STATUS_TONES,
  PATIENT_TYPE_TONES,
} from '@/shared/clinic/clinic-tones.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import {
  PERSON_CARD_KEYS,
  PERSON_CARD_NS,
} from '@/shared/components/PersonCard/person-card.constants.ts';
import {
  type RoomFilterCopy,
  RoomToolbar,
  type RoomViewTab,
  RoomViewTabs,
} from '@/shared/components/RoomToolbar/index.ts';
import {
  type AppIcon,
  Bell,
  House,
  RefreshCw,
  Users,
  Wallet,
} from '@/shared/icons/index.ts';

import {
  PATIENT_FILTER_FIELDS,
  PATIENTS_KEYS,
  PATIENTS_NS,
  PATIENTS_TABLE_ID,
} from '../../patients.constants.ts';
import { PATIENT_FILTER_VALUES, PATIENT_VIEWS } from '../../patients.search.ts';

/** Each view tab's 14px icon (`patients.md:203–207`). */
const VIEW_ICONS: Readonly<Record<PatientView, AppIcon>> = {
  all: Users,
  today: House,
  dues: Wallet,
  follow: Bell,
  recall: RefreshCw,
};

/** Props of {@link PatientsToolbar}. */
export interface PatientsToolbarProps {
  /** The room's table — the Columns chooser drives its column visibility. */
  table: ReactTable<DataTableFeatures, PatientRow>;
  /** The view on screen (the URL's, All by default). */
  view: PatientView;
  onViewChange: (view: PatientView) => void;
  /** "New patient" — absent without Create (the button and the phone pill hide). */
  onNewPatient?: () => void;
}

/** The Filters popover's sections (`patients.md:133`): Gender · Type · Status · Conversion, each value in its badge's tone. */
function useFilterCopy(): Readonly<Record<string, RoomFilterCopy>> {
  const { t } = useTranslation(PATIENTS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const { t: tCard } = useTranslation(PERSON_CARD_NS);
  const labelled = <T extends string>(
    values: readonly T[],
    labelOf: (value: T) => string,
    tones: Readonly<Record<T, Tone>>,
  ) =>
    Object.fromEntries(
      values.map((value) => [value, { label: labelOf(value), tone: tones[value] }]),
    );
  return {
    gender: {
      label: t(PATIENTS_KEYS.columns.gender),
      options: labelled(
        PATIENT_FILTER_VALUES.gender,
        (gender) => tCard(PERSON_CARD_KEYS.gender[gender]),
        GENDER_TONES,
      ),
    },
    types: {
      label: t(PATIENTS_KEYS.columns.types),
      options: labelled(
        PATIENT_FILTER_VALUES.types,
        (type) => tClinic(CLINIC_KEYS.patients.types[type]),
        PATIENT_TYPE_TONES,
      ),
    },
    status: {
      label: t(PATIENTS_KEYS.columns.status),
      options: labelled(
        PATIENT_FILTER_VALUES.status,
        (status) => tClinic(CLINIC_KEYS.patients.statuses[status]),
        PATIENT_STATUS_TONES,
      ),
    },
    conversion: {
      label: t(PATIENTS_KEYS.columns.conversion),
      options: labelled(
        PATIENT_FILTER_VALUES.conversion,
        (conversion) => tClinic(CLINIC_KEYS.patients.conversions[conversion]),
        PATIENT_CONVERSION_TONES,
      ),
    },
  };
}

/**
 * The Patients toolbar (KICKOFF §6.5 Toolbar; `patients.md:17`) on the shared
 * room toolbar: h1 "Patients" · the five view tabs · search "Name, mobile or
 * #ID" · saved views · Filters (Gender · Type · Status · Conversion · Created ·
 * Follow-up date) · Columns · "New patient" — a floating pill on a phone.
 */
export function PatientsToolbar({
  table,
  view,
  onViewChange,
  onNewPatient,
}: PatientsToolbarProps) {
  const { t } = useTranslation(PATIENTS_NS);
  const copy = useFilterCopy();
  const tabs: RoomViewTab[] = PATIENT_VIEWS.map((id) => ({
    id,
    label: t(PATIENTS_KEYS.views[id]),
    icon: VIEW_ICONS[id],
  }));

  return (
    <RoomToolbar
      title={t(PATIENTS_KEYS.manifest.title)}
      tableId={PATIENTS_TABLE_ID}
      tabs={
        <RoomViewTabs
          label={t(PATIENTS_KEYS.views.label)}
          tabs={tabs}
          value={view}
          onValueChange={(id) => onViewChange(id as PatientView)}
          testIdPrefix={PATIENTS_TABLE_ID}
        />
      }
      search={{
        placeholder: t(PATIENTS_KEYS.search.placeholder),
        label: t(PATIENTS_KEYS.search.label),
      }}
      filters={{ fields: PATIENT_FILTER_FIELDS, copy }}
      columns={<DataTableColumnChooser table={table} tableId={PATIENTS_TABLE_ID} />}
      primary={
        onNewPatient
          ? {
              action: {
                id: 'new',
                label: t(PATIENTS_KEYS.primary.newPatient),
                onSelect: onNewPatient,
              },
            }
          : undefined
      }
    />
  );
}
