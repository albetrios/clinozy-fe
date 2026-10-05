import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import type { PrescriptionItem } from './clinic-schema.ts';
import { patientRef } from './fixtures/patients.fixtures.ts';
import { staffRef } from './fixtures/staff.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import { medicineForm } from './medicines-contracts.ts';
import { patientQueryKeys } from './patients-api.ts';
import {
  createPrescription,
  deletePrescription,
  fetchPrescription,
  fetchRxCatalog,
  fetchRxSheetContext,
  listPatientPrescriptions,
  type PrescriptionInput,
  prescriptionQueryKeys,
  restorePrescription,
  updatePrescription,
} from './prescriptions-api.ts';

const DHARTI = patientRef('Dharti Galani');
const ARPITA = patientRef('Arpita Kachhadiya');
const DR_DRASHTI = staffRef('DD');

beforeEach(() => resetClinicFixtures());
afterEach(() => resetClinicFixtures());

function line(name: string, fields: Partial<PrescriptionItem> = {}): PrescriptionItem {
  return {
    medicineId: null,
    medicineName: name,
    doseMorning: 0,
    doseAfternoon: 0,
    doseNight: 1,
    sos: false,
    meal: 'after',
    timing: null,
    timingText: null,
    bodyPart: null,
    bodyPartText: null,
    qty: 8,
    remarks: null,
    ...fields,
  };
}

function input(fields: Partial<PrescriptionInput> = {}): PrescriptionInput {
  return {
    patientId: DHARTI,
    appointmentId: null,
    doctorId: DR_DRASHTI,
    date: '2026-10-03',
    items: [line('Glycolac Cream')],
    advice: null,
    labReport: null,
    procedureToday: null,
    followUpDate: null,
    ...fields,
  };
}

async function refusal(write: Promise<unknown>) {
  try {
    await write;
  } catch (error) {
    return error;
  }
  throw new Error('expected the write to be refused');
}

describe('prescriptions (S:1641)', () => {
  it('sits under the patients key, so a saved Rx refreshes the file', () => {
    expect(prescriptionQueryKeys.patient(DHARTI).slice(0, 2)).toEqual([
      ...patientQueryKeys.all,
    ]);
  });

  it('reads one patient’s prescriptions, newest first', async () => {
    const saved = await createPrescription(input({ date: '2099-12-31' }));
    const list = await listPatientPrescriptions(DHARTI);
    expect(list).toHaveLength(2);
    expect(list[0]?.id).toBe(saved.id);
    expect(list.map((rx) => rx.date)).toEqual(
      [...list.map((rx) => rx.date)].sort().reverse(),
    );
    expect(list.every((rx) => rx.patientId === DHARTI)).toBe(true);
  });

  it('numbers a new prescription and matches a typed name to the store’s medicine', async () => {
    const saved = await createPrescription(input());
    expect(saved.seq).toBeGreaterThan(501);
    const [item] = saved.items;
    const glycolac = clinicFixtures.medicines.snapshot(
      (medicine) => medicine.name === 'Glycolac Cream',
    )[0];
    expect(item?.medicineId).toBe(glycolac?.id);
    expect(await fetchPrescription(saved.id)).toMatchObject({ seq: saved.seq });
  });

  it('adds a name the store does not carry to Medical as a quick draft (S:378)', async () => {
    const before = clinicFixtures.medicines.snapshot().length;
    const saved = await createPrescription(input({ items: [line('  Minoxin 5% ')] }));
    const quick = clinicFixtures.medicines.snapshot((medicine) => medicine.isQuick);
    expect(clinicFixtures.medicines.snapshot()).toHaveLength(before + 1);
    expect(quick.at(-1)).toMatchObject({ name: 'Minoxin 5%', mrp: 0, batches: [] });
    expect(saved.items[0]).toMatchObject({
      medicineName: 'Minoxin 5%',
      medicineId: quick.at(-1)?.id,
    });
  });

  it('refuses a prescription without a medicine — “Add a medicine”', async () => {
    const error = await refusal(createPrescription(input({ items: [] })));
    expect(isHttpError(error) && error.status).toBe(422);
    expect(isHttpError(error) && error.message).toBe('Add a medicine');
  });

  it('refuses a dose tap above 2 and a quantity of 0', async () => {
    const error = await refusal(
      createPrescription(
        input({ items: [line('Glycolac Cream', { doseNight: 3, qty: 0 })] }),
      ),
    );
    expect(isHttpError(error) && error.status).toBe(422);
  });

  it('saves changes, and deletes and restores a prescription', async () => {
    const saved = await createPrescription(input());
    const changed = await updatePrescription(
      saved.id,
      input({ advice: 'Avoid scrubs', items: [line('Epriva Tab', { qty: 20 })] }),
    );
    expect(changed).toMatchObject({ seq: saved.seq, advice: 'Avoid scrubs' });
    expect(changed.items).toHaveLength(1);

    await deletePrescription(saved.id, 'mistake', null);
    expect((await listPatientPrescriptions(DHARTI)).map((rx) => rx.id)).not.toContain(
      saved.id,
    );
    await restorePrescription(saved.id);
    expect((await listPatientPrescriptions(DHARTI)).map((rx) => rx.id)).toContain(
      saved.id,
    );
  });
});

describe('the Rx drawer’s medicines (H:4806)', () => {
  it('splits Topical from Oral by the name', () => {
    expect(medicineForm('Clonix-B Lotion')).toBe('topical');
    expect(medicineForm('Sunscreen SPF 50')).toBe('topical');
    expect(medicineForm('Flubolt 400')).toBe('oral');
  });

  it('offers the store’s medicines A to Z with their MRP and stock', async () => {
    const { medicines } = await fetchRxCatalog(DHARTI);
    const names = medicines.map((medicine) => medicine.name.toLowerCase());
    expect(names).toEqual([...names].sort());
    const glycolac = medicines.find((medicine) => medicine.name === 'Glycolac Cream');
    expect(glycolac).toMatchObject({ form: 'topical', last: null });
    expect(glycolac?.medicineId).toBeTruthy();
    expect(glycolac?.stock).toBeGreaterThanOrEqual(0);
  });

  it('adds the names the clinic’s Rx carry that the store lacks, with a last line', async () => {
    const { medicines, often } = await fetchRxCatalog(ARPITA);
    const flubolt = medicines.find((medicine) => medicine.name === 'Flubolt 400');
    expect(flubolt).toMatchObject({ medicineId: null, stock: null, mrp: null });
    expect(flubolt?.last).toMatchObject({ doseNight: 1, meal: 'after', qty: 8 });
    // "Often prescribed" counts every patient's prescriptions (H:4806): five at most.
    expect(often).toContain('Flubolt 400');
    expect(often.length).toBeLessThanOrEqual(5);
    // Another patient is offered the name too, with the clinic's last line.
    const other = await fetchRxCatalog(DHARTI);
    expect(
      other.medicines.find((medicine) => medicine.name === 'Flubolt 400')?.last,
    ).toMatchObject({ doseNight: 1, meal: 'after' });
    expect(other.often).toEqual(often);
  });

  it('puts the most prescribed first in “Often prescribed”', async () => {
    await createPrescription(input({ items: [line('Sunscreen SPF 50')] }));
    await createPrescription(input({ items: [line('Epriva Tab')] }));
    const { often } = await fetchRxCatalog(DHARTI);
    expect(often[0]).toBe('Sunscreen SPF 50');
    expect(often).toContain('Epriva Tab');
  });
});

describe('the printed sheet’s context', () => {
  it('names the patient, the doctor, the clinic and the patient’s branch', async () => {
    const context = await fetchRxSheetContext(DHARTI, DR_DRASHTI);
    const dharti = await clinicFixtures.patients.get(DHARTI);
    const branch = clinicFixtures.branches.snapshot(
      (row) => row.id === dharti.homeBranchId,
    )[0];
    expect(context.patient).toMatchObject({ firstName: 'Dharti', seq: dharti.seq });
    expect(context.doctor?.firstName).toBe('Dr. Drashti');
    expect(context.organization.name).toBeTruthy();
    expect(context.branch.phone).toBe(branch?.phone);
  });

  it('has no doctor when none is named', async () => {
    expect((await fetchRxSheetContext(DHARTI, null)).doctor).toBeNull();
  });
});
