import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { patientRef } from './fixtures/patients.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  attachPatientReportFile,
  createPatientReport,
  fetchPatientReport,
  listPatientReports,
  patientReportQueryKeys,
} from './patient-reports-api.ts';
import { patientQueryKeys } from './patients-api.ts';

const DHARTI = patientRef('Dharti Galani');

beforeEach(() => resetClinicFixtures());
afterEach(() => resetClinicFixtures());

describe('patient reports (S:1644)', () => {
  it('sits under the patients key, so an upload refreshes the file', () => {
    expect(patientReportQueryKeys.patient(DHARTI).slice(0, 2)).toEqual([
      ...patientQueryKeys.all,
    ]);
  });

  it('reads a patient’s reports newest first, and one with who added it', async () => {
    const list = await listPatientReports(DHARTI);
    expect(list.map((report) => report.name)).toEqual([
      'Chemical peel consent',
      'CBC + Thyroid profile',
    ]);
    const { report, addedBy } = await fetchPatientReport(ref.patientReport(1));
    expect(report.type).toBe('lab');
    expect(addedBy).toMatch(/^Riya/);
  });

  it('uploads a report, then attaches each confirmed file once', async () => {
    const report = await createPatientReport({
      patientId: DHARTI,
      type: 'scan',
      name: 'Ultrasound abdomen',
      date: '2026-10-03',
      notes: 'Fasting',
    });
    expect(report).toMatchObject({ files: [], notes: 'Fasting' });
    await attachPatientReportFile(report.id, 'organization/report-a.pdf');
    const again = await attachPatientReportFile(report.id, 'organization/report-a.pdf');
    expect(again.files).toEqual(['organization/report-a.pdf']);
  });

  it('refuses a report without a name — “Name the report”', async () => {
    const error = await createPatientReport({
      patientId: DHARTI,
      type: 'lab',
      name: ' ',
      date: '2026-10-03',
      notes: null,
    }).catch((caught: unknown) => caught);
    expect(isHttpError(error) && error.message).toBe('Name the report');
  });
});
