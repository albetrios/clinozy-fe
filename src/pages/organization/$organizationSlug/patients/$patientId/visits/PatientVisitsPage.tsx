'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve
// stale answers.

import { useTranslation } from 'react-i18next';

import { APPOINTMENT_STATUS_TONES } from '@/shared/clinic/clinic-tones.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import { useFixturePatientAppointments } from '@/shared/hooks/useFixtureAppointments/index.ts';

import { PatientSection } from '../shared/components/PatientSection/index.ts';
import {
  PATIENT_SECTION_TABLE_IDS,
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
  PatientSectionTable,
} from '../shared/components/PatientSectionTable/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import { useVisitsTable } from './hooks/useVisitsTable/index.ts';
import { manifest } from './visits.manifest.ts';

/**
 * Patient file › Visits (KICKOFF §6.6 Section tables; H:4746;
 * `patient-file.md:34–46`): the patient's bookings, newest first — ID · When
 * · Offering · Doctor · Status with the status's start bar, "3 appointments"
 * and "All appointments loaded" (`listAppointments` has no patient filter, a
 * backend request). "New appointment" opens the appointment form for this
 * patient; a row opens nothing.
 */
export function PatientVisitsPage() {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const { patientId } = usePatientFileContext();
  const visits = useFixturePatientAppointments(patientId);
  const rows = visits.data ?? [];
  const table = useVisitsTable(rows);

  return (
    <PatientSection
      section="visits"
      data-testid={manifest.testId}
      columns={
        <DataTableColumnChooser
          table={table}
          tableId={PATIENT_SECTION_TABLE_IDS.visits}
        />
      }
      className="flex flex-col"
    >
      <PatientSectionTable
        section="visits"
        table={table}
        loading={visits.isPending}
        countLabel={
          rows.length > 0
            ? t(PATIENT_TABLE_KEYS.visits.count, { count: rows.length })
            : undefined
        }
        minWidth={760}
        rowTone={(row) => APPOINTMENT_STATUS_TONES[row.status]}
      />
    </PatientSection>
  );
}
