import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { clinicDateOf } from './clinic-filter-match.ts';
import { invoiceBalance } from './clinic-money.ts';
import { clinicToday } from './clinic-time.ts';
import { patientRef } from './fixtures/patients.fixtures.ts';
import { staffRef } from './fixtures/staff.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  fetchPatient,
  fixturePatientQueryKeys,
  listPatients,
} from './patients-fixture-api.ts';
import type { PatientListParams } from './patients-fixture-contracts.ts';

const RS = staffRef('RS');
/** 10:00 on 3 Oct, clinic time — the seed day is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const DHARTI = patientRef('Dharti Galani');

/** The rejection a call ends in, so its status and fields can be read. */
async function failureOf(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!isHttpError(error)) throw new Error('expected an HTTP error');
  const body = (
    error.data as { error: { code: string; detail: string; fields?: object } }
  ).error;
  return { status: error.status, ...body };
}

const seqs = async (params: PatientListParams = {}) =>
  (await listPatients(params)).items.map((patient) => patient.seq);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('fixturePatientQueryKeys', () => {
  it('nests every key under ["clinic", "fixture-patients"], apart from clinozy-be’s patients', () => {
    expect(fixturePatientQueryKeys.list({ view: 'all' })).toEqual([
      'clinic',
      'fixture-patients',
      'list',
      { view: 'all' },
    ]);
    expect(fixturePatientQueryKeys.lists()).toEqual([
      'clinic',
      'fixture-patients',
      'list',
    ]);
    expect(fixturePatientQueryKeys.detail('P1')).toEqual([
      'clinic',
      'fixture-patients',
      'detail',
      'P1',
    ]);
    expect(fixturePatientQueryKeys.all).not.toEqual(['clinic', 'patients']);
  });
});

describe('the patients list (listPatients, S:1619)', () => {
  it('reads the roster newest-saved first, each row with its dues and last editor', async () => {
    const page = await listPatients();
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(30);
    const updated = page.items.map((patient) => patient.updatedAt);
    expect(updated).toEqual([...updated].sort().reverse());

    const dharti = page.items.find((patient) => patient.id === DHARTI);
    const payments = clinicFixtures.payments.snapshot();
    const owed = clinicFixtures.invoices
      .snapshot((invoice) => invoice.patientId === DHARTI)
      .reduce((sum, invoice) => sum + invoiceBalance(invoice, payments).due, 0);
    expect(owed).toBeGreaterThan(0);
    expect(dharti?.dueTotal).toBe(owed);
    expect(dharti?.updatedBy).toMatchObject({ id: RS, name: 'Riya Shah' });
  });

  it('answers each view on the server (S:30, Q-P4)', async () => {
    const today = clinicToday();
    const checkedIn = new Set(
      clinicFixtures.appointments
        .snapshot((visit) => visit.date === today && visit.status === 'checked_in')
        .map((visit) => visit.patientId),
    );
    const inClinic = (await listPatients({ view: 'today' })).items;
    expect(inClinic.length).toBeGreaterThan(0);
    expect(inClinic.every((patient) => checkedIn.has(patient.id))).toBe(true);

    const dues = (await listPatients({ view: 'dues' })).items;
    expect(dues.length).toBeGreaterThan(0);
    expect(dues.every((patient) => patient.dueTotal > 0)).toBe(true);

    const follow = (await listPatients({ view: 'follow' })).items;
    expect(follow.length).toBeGreaterThan(0);
    expect(
      follow.every(
        (patient) => patient.followUpAt && clinicDateOf(patient.followUpAt) <= today,
      ),
    ).toBe(true);

    const recall = (await listPatients({ view: 'recall' })).items;
    expect(recall.map((patient) => patient.status)).toEqual(recall.map(() => 'inactive'));
    expect(recall.length).toBeGreaterThan(0);
  });

  it('searches the name, either mobile and the #ID, ignoring spaces and "#"', async () => {
    expect(await seqs({ q: 'dharti' })).toEqual([3508]);
    expect(await seqs({ q: '82006 03212' })).toEqual([3508]);
    expect(await seqs({ q: '#3508' })).toEqual([3508]);
    expect(await seqs({ q: '98795 21034' })).toEqual([3441]);
    expect(await seqs({ q: 'nobody-at-all' })).toEqual([]);
  });

  it('filters by type, status, gender, conversion, created and follow-up', async () => {
    const rows = (
      await listPatients({
        gender: ['female'],
        types: ['aesthetic'],
        status: ['regular'],
      })
    ).items;
    expect(rows.length).toBeGreaterThan(0);
    for (const patient of rows) {
      expect(patient.gender).toBe('female');
      expect(patient.types).toContain('aesthetic');
      expect(patient.status).toBe('regular');
    }
    const converted = (await listPatients({ conversion: ['converted'] })).items;
    expect(converted.map((patient) => patient.conversion)).toEqual(
      converted.map(() => 'converted'),
    );
    const overdue = (await listPatients({ followUp: 'overdue' })).items;
    expect(
      overdue.every(
        (patient) =>
          patient.followUpAt && clinicDateOf(patient.followUpAt) < clinicToday(),
      ),
    ).toBe(true);
    expect(await seqs({ followUp: 'not_set', q: '3412' })).toEqual([3412]);
  });

  it('sorts by a column, ascending unless asked otherwise', async () => {
    const bySeq = await seqs({ sort: 'seq' });
    expect(bySeq).toEqual([...bySeq].sort((a, b) => a - b));
    const byDue = (await listPatients({ sort: 'due', order: 'desc' })).items;
    expect(byDue[0]?.dueTotal).toBe(
      Math.max(...byDue.map((patient) => patient.dueTotal)),
    );
    const names = (await listPatients({ sort: 'name' })).items.map((patient) =>
      `${patient.firstName} ${patient.lastName ?? ''}`.trim(),
    );
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe('one patient (fetchPatient)', () => {
  it('reads one patient with their dues, a 404 for one the world does not hold', async () => {
    const dharti = await fetchPatient(DHARTI);
    expect(dharti).toMatchObject({ id: DHARTI, seq: 3508, firstName: 'Dharti' });
    expect(dharti.dueTotal).toBeGreaterThan(0);
    expect((await failureOf(fetchPatient('patient-nobody'))).status).toBe(404);
  });
});
