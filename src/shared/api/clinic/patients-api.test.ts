import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { clinicDateOf } from './clinic-filter-match.ts';
import { invoiceBalance } from './clinic-money.ts';
import { clinicToday } from './clinic-time.ts';
import { branchRef, MAIN_BRANCH } from './fixtures/organization.fixtures.ts';
import { patientRef } from './fixtures/patients.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { staffRef } from './fixtures/staff.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  attachPatientPhoto,
  createPatient,
  deletePatient,
  fetchPatient,
  findPatientByPhone,
  listPatients,
  patientQueryKeys,
  restorePatient,
  updatePatient,
} from './patients-api.ts';
import type { PatientListParams } from './patients-contracts.ts';

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

describe('patientQueryKeys', () => {
  it('nests every key under ["clinic", "patients"], so one invalidation reaches them all', () => {
    expect(patientQueryKeys.list({ view: 'all' })).toEqual([
      'clinic',
      'patients',
      'list',
      { view: 'all' },
    ]);
    expect(patientQueryKeys.detail('P1').slice(0, 2)).toEqual(patientQueryKeys.all);
    expect(patientQueryKeys.byPhone('+919825011241', null).slice(0, 2)).toEqual(
      patientQueryKeys.all,
    );
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

describe('one patient and the mobile lookup', () => {
  it('reads one patient, a 404 once removed', async () => {
    expect((await fetchPatient(DHARTI)).seq).toBe(3508);
    await deletePatient(DHARTI, 'duplicate', null);
    expect((await failureOf(fetchPatient(DHARTI))).status).toBe(404);
  });

  it('finds the patient on either of their numbers, never the one being edited (Q-P7)', async () => {
    expect((await findPatientByPhone('+918200603212'))?.id).toBe(DHARTI);
    expect((await findPatientByPhone('+919879521034'))?.seq).toBe(3441);
    expect(await findPatientByPhone('+918200603212', DHARTI)).toBeNull();
    expect(await findPatientByPhone('+919000000000')).toBeNull();
  });
});

describe('createPatient (S:1623)', () => {
  it('creates from a first name and a mobile, with the defaults and the next #ID', async () => {
    const top = Math.max(
      ...clinicFixtures.patients.snapshot().map((patient) => patient.seq),
    );
    const { patient } = await createPatient({
      firstName: 'Priya',
      phone: '+919876543210',
    });
    expect(patient).toMatchObject({
      seq: top + 1,
      firstName: 'Priya',
      lastName: null,
      status: 'new',
      conversion: 'not_converted',
      homeBranchId: branchRef(MAIN_BRANCH),
      types: [],
      consents: [],
      consentGiven: false,
      updatedById: RS,
    });
  });

  it('opens the onboarding task, due today, for the member who created the patient', async () => {
    const { patient, onboardingTaskId } = await createPatient({
      firstName: 'Priya',
      lastName: 'Shah',
      phone: '+919876543210',
      consents: ['data', 'photos'],
    });
    expect(patient.consentGiven).toBe(true);
    const task = await clinicFixtures.tasks.get(onboardingTaskId);
    expect(task).toMatchObject({
      title: 'Onboarding',
      why: 'New patient. Collect consent, DOB and a first photo.',
      patientId: patient.id,
      ownerId: RS,
      status: 'open',
    });
    expect(clinicDateOf(task.dueAt)).toBe(clinicToday());
  });

  it('keeps the lead it came from, never blocks a mobile already on file (Q-P7)', async () => {
    const lead = ref.lead(2364);
    const { patient } = await createPatient({
      firstName: 'Kiran',
      phone: '+918200603212',
      leadId: lead,
    });
    expect(patient.leadId).toBe(lead);
  });

  it('refuses what the contract refuses with a 422 naming the field', async () => {
    const blank = await failureOf(
      createPatient({ firstName: '  ', phone: '+919876543210' }),
    );
    expect(blank).toMatchObject({
      status: 422,
      fields: { firstName: ['Add a first name'] },
    });
    const short = await failureOf(createPatient({ firstName: 'Priya', phone: '98765' }));
    expect(short).toMatchObject({ fields: { phone: ['Enter a 10-digit mobile'] } });
    const future = await failureOf(
      createPatient({
        firstName: 'Priya',
        phone: '+919876543210',
        dateOfBirth: '2030-01-01',
      }),
    );
    expect(future.fields).toHaveProperty('dateOfBirth');
    const branch = await failureOf(
      createPatient({
        firstName: 'Priya',
        phone: '+919876543210',
        homeBranchId: ref.patient(1),
      }),
    );
    expect(branch).toMatchObject({
      status: 422,
      fields: { homeBranchId: expect.any(Array) },
    });
  });
});

describe('updatePatient (S:1640)', () => {
  it('merges the patch, checks the whole again and records who saved it', async () => {
    const saved = await updatePatient(DHARTI, {
      lastName: '  ',
      referredByName: 'Kiran Desai',
      consents: ['marketing'],
      conversion: null,
      diagnosis: 'Melasma',
    });
    expect(saved).toMatchObject({
      firstName: 'Dharti',
      lastName: null,
      referredByName: 'Kiran Desai',
      consents: ['marketing'],
      consentGiven: false,
      conversion: 'not_converted',
      diagnosis: 'Melasma',
      updatedById: RS,
    });
    const tooLong = await failureOf(
      updatePatient(DHARTI, { referredByName: 'x'.repeat(31) }),
    );
    expect(tooLong.fields).toHaveProperty('referredByName');
  });

  it('answers 404 for a removed patient', async () => {
    await deletePatient(DHARTI, 'mistake', null);
    expect((await failureOf(updatePatient(DHARTI, { notes: 'x' }))).status).toBe(404);
  });
});

describe('delete and restore (S:1546, D32)', () => {
  it('soft-deletes with a reason — "Other" needs a note — and Undo restores', async () => {
    const other = await failureOf(deletePatient(DHARTI, 'other', null));
    expect(other.status).toBe(422);
    const removed = await deletePatient(DHARTI, 'other', 'Moved away');
    expect(removed).toMatchObject({ deleteReason: 'other', deleteNote: 'Moved away' });
    expect(await seqs({ q: '3508' })).toEqual([]);
    await restorePatient(DHARTI);
    expect(await seqs({ q: '3508' })).toEqual([3508]);
  });
});

describe('attachPatientPhoto (S:1643)', () => {
  it('files a first photo in the General album under today’s visit, when there is one', async () => {
    const today = clinicToday();
    const visit = clinicFixtures.appointments.snapshot(
      (appointment) =>
        appointment.date === today &&
        appointment.patientId !== null &&
        appointment.status !== 'cancelled',
    )[0];
    expect(visit?.patientId).toBeTruthy();
    const photo = await attachPatientPhoto({
      patientId: visit?.patientId ?? '',
      key: 'uploads/first.jpg',
      fileName: 'first.jpg',
    });
    expect(photo).toMatchObject({
      album: 'general',
      appointmentId: visit?.id,
      fileUrl: 'uploads/first.jpg',
      takenOn: today,
    });
    const plain = await attachPatientPhoto({
      patientId: patientRef('Raam Shah'),
      key: 'uploads/raam.jpg',
      fileName: 'raam.jpg',
    });
    expect(plain.appointmentId).toBeNull();
  });

  it('files an upload from the Photos section in the album on screen, under no visit', async () => {
    const today = clinicToday();
    const visit = clinicFixtures.appointments.snapshot(
      (appointment) =>
        appointment.date === today &&
        appointment.patientId !== null &&
        appointment.status !== 'cancelled',
    )[0];
    const photo = await attachPatientPhoto({
      patientId: visit?.patientId ?? '',
      key: 'uploads/lhr.jpg',
      fileName: 'lhr.jpg',
      album: 'lhr',
      appointmentId: null,
    });
    expect(photo).toMatchObject({ album: 'lhr', appointmentId: null, takenOn: today });
  });
});
