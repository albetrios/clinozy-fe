import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { invoiceBalance } from './clinic-money.ts';
import { patientRef } from './fixtures/patients.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import { fetchPatientFile, patientFileQueryKeys } from './patient-file-api.ts';
import { patientFileSchema } from './patient-file-contracts.ts';

/** 10:00 on 3 Oct, clinic time — the seed day is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const DHARTI = patientRef('Dharti Galani');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('patientFileQueryKeys', () => {
  it('sits under the patients key, so a patient write refreshes the file', () => {
    expect(patientFileQueryKeys.detail(DHARTI)).toEqual([
      'clinic',
      'patients',
      'file',
      DHARTI,
    ]);
  });
});

describe('fetchPatientFile', () => {
  it('reads the patient with the rail facts, in the contract-plus-plan shape', async () => {
    const file = await fetchPatientFile(DHARTI);
    expect(patientFileSchema.safeParse(file).success).toBe(true);
    expect(file.patient.seq).toBe(3508);
    expect(file.language).toBe('Gujarati');
    expect(file.instagram).toBe('@dharti');
  });

  it('sums what they owe over their open invoices and dates it from the oldest', async () => {
    const payments = clinicFixtures.payments.snapshot();
    const open = clinicFixtures.invoices
      .snapshot((invoice) => invoice.patientId === DHARTI)
      .filter((invoice) => invoiceBalance(invoice, payments).due > 0);
    const file = await fetchPatientFile(DHARTI);
    expect(file.due).toBe(
      open.reduce((sum, invoice) => sum + invoiceBalance(invoice, payments).due, 0),
    );
    expect(file.dueSince).toBe(
      open.length ? open.map((invoice) => invoice.date).sort()[0] : null,
    );
  });

  it('picks the earliest visit still to come as the next one', async () => {
    const file = await fetchPatientFile(DHARTI);
    const upcoming = clinicFixtures.appointments
      .snapshot(
        (appointment) =>
          appointment.patientId === DHARTI &&
          appointment.date >= '2026-10-03' &&
          ['scheduled', 'confirmed', 'checked_in'].includes(appointment.status),
      )
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
    expect(file.nextVisit?.appointmentId ?? null).toBe(upcoming[0]?.id ?? null);
  });

  it('summarises feedback from the latest check-in and counts each kind', async () => {
    const file = await fetchPatientFile(DHARTI);
    expect(file.feedback).toMatchObject({
      feel: 'better',
      score: 7,
      checkIns: 2,
      reviews: 1,
    });
  });

  it('counts each section’s records and leaves Overview and Clinical notes at none', async () => {
    const { counts } = await fetchPatientFile(DHARTI);
    expect(counts).toMatchObject({
      timeline: 0,
      overview: 0,
      prescriptions: 1,
      treatments: 1,
      images: 3,
      reports: 2,
      packages: 2,
      notes: 2,
    });
    expect(counts.invoices).toBeGreaterThan(0);
  });

  it('holds an open credit to give back and none for a patient without one', async () => {
    const tanvi = await fetchPatientFile(patientRef('Tanvi Shah'));
    expect(tanvi.credit).toEqual({
      amount: 50_000,
      reasons: ['Charged twice for corn removal'],
    });
    expect((await fetchPatientFile(DHARTI)).credit).toBeNull();
  });

  it('answers a deleted or unknown patient with a 404', async () => {
    await clinicFixtures.patients.remove(DHARTI, 'mistake', null);
    const error = await fetchPatientFile(DHARTI).catch((caught: unknown) => caught);
    expect(isHttpError(error) && error.status).toBe(404);
  });
});
