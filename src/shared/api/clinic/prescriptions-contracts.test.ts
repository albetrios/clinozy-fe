import { describe, expect, it } from 'vitest';

import type { PrescriptionItem } from './clinic-schema.ts';
import {
  type PrescriptionRecord,
  rxCatalogOf,
  type RxStoreMedicine,
} from './prescriptions-contracts.ts';

const line = (medicineName: string, fields: Partial<PrescriptionItem> = {}) => ({
  medicineId: null,
  medicineName,
  doseMorning: 0,
  doseAfternoon: 0,
  doseNight: 1,
  sos: false,
  meal: null,
  timing: null,
  timingText: null,
  bodyPart: null,
  bodyPartText: null,
  qty: 1,
  remarks: null,
  ...fields,
});

const rx = (seq: number, items: PrescriptionItem[]): PrescriptionRecord => ({
  id: `rx_${seq}`,
  seq,
  patientId: 'pat_priya0000000000000000',
  appointmentId: null,
  doctorId: 'mem_nisha0000000000000000',
  date: '2026-10-01',
  items,
  advice: null,
  labReport: null,
  procedureToday: null,
  followUpDate: null,
  status: 'draft',
  approvedAt: null,
  approvedById: null,
  createdAt: '2026-10-01T05:00:00.000Z',
  updatedAt: '2026-10-01T05:00:00.000Z',
});

const STORE: RxStoreMedicine[] = [
  { id: 'med_tranexa', name: 'Tranexa 500', composition: 'Tranexamic acid', stock: 0 },
  { id: 'med_flubolt', name: 'Flubolt 400', composition: 'Fluconazole', stock: 8 },
];

describe('rxCatalogOf — the Rx drawer’s medicines', () => {
  it('offers the store’s medicines A to Z with their stock and the patient’s last line', () => {
    const newest = line('flubolt 400', { qty: 8, meal: 'after' });
    const older = line('Flubolt 400', { qty: 4 });
    const { medicines } = rxCatalogOf(STORE, [rx(501, [newest]), rx(500, [older])]);
    expect(medicines.map((medicine) => medicine.name)).toEqual([
      'Flubolt 400',
      'Tranexa 500',
    ]);
    expect(medicines[0]).toMatchObject({
      medicineId: 'med_flubolt',
      composition: 'Fluconazole',
      stock: 8,
      form: 'oral',
      last: newest,
    });
    expect(medicines[1]).toMatchObject({ stock: 0, last: null });
  });

  it('adds the names only the patient’s prescriptions carry, without a store medicine', () => {
    const { medicines } = rxCatalogOf(STORE, [rx(500, [line('Clonix-B Lotion')])]);
    expect(medicines.map((medicine) => medicine.name)).toEqual([
      'Clonix-B Lotion',
      'Flubolt 400',
      'Tranexa 500',
    ]);
    expect(medicines[0]).toMatchObject({
      medicineId: null,
      composition: null,
      stock: null,
      form: 'topical',
      last: expect.objectContaining({ medicineName: 'Clonix-B Lotion' }),
    });
  });

  it('is the patient’s own names alone without the store (no medicine:read)', () => {
    expect(rxCatalogOf([], []).medicines).toEqual([]);
    expect(
      rxCatalogOf([], [rx(500, [line('Flubolt 400')])]).medicines.map(
        (medicine) => medicine.name,
      ),
    ).toEqual(['Flubolt 400']);
  });
});
