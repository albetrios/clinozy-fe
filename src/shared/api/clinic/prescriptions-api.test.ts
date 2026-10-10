import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';

import {
  approvePrescription,
  createPrescription,
  deletePrescription,
  fetchPrescription,
  fetchRxSheetClinic,
  listPatientPrescriptions,
  listPrescriptionKits,
  listRxMedicines,
  restorePrescription,
  updatePrescription,
} from './prescriptions-api.ts';
import type { PrescriptionFields } from './prescriptions-contracts.ts';

const PATIENT_ID = 'pat_priya0000000000000000';
const RX_ID = 'rx_rx50000000000000000000';
const NISHA = 'mem_nisha0000000000000000';
const KEY = 'key-0000000000000000';

/** A prescription as clinozy-be answers it: the lines as written (absent fields left out). */
const rxRow = (patch: Record<string, unknown> = {}) => ({
  id: RX_ID,
  prescription_number: 500,
  patient_id: PATIENT_ID,
  appointment_id: null,
  doctor_membership_id: NISHA,
  prescription_date: '2026-10-01',
  items: [
    {
      medicine_name: 'Flubolt 400',
      dose_night: 1,
      meal: 'after',
      quantity: 8,
      remarks: '10 days',
    },
    { medicine_name: 'Clonix-B Lotion', timing: 'morning_night', body_part: 'scalp' },
  ],
  advice: 'Avoid sun',
  lab_report: null,
  procedure_today: null,
  follow_up_date: null,
  print_language: 'english',
  status: 'draft',
  approved_at: null,
  approved_by_membership_id: null,
  created_at: '2026-10-01T05:00:00.000Z',
  updated_at: '2026-10-01T05:00:00.000Z',
  ...patch,
});

/** One list page as clinozy-be answers it. */
const page = (rows: unknown[], next: string | null = null) => ({
  data: rows,
  meta: {
    request_id: 'req',
    pagination: { per_page: 100, next, has_more: next !== null },
  },
});

const one = (row: unknown) => ({ data: row, meta: { request_id: 'req' } });

/** What a drawer save writes. */
const FIELDS: PrescriptionFields = {
  doctorId: NISHA,
  date: '2026-10-03',
  items: [
    {
      medicineId: 'med_flubolt0000000000000',
      medicineName: 'Flubolt 400',
      doseMorning: 0,
      doseAfternoon: 0,
      doseNight: 1,
      sos: false,
      meal: 'after',
      timing: null,
      timingText: null,
      bodyPart: 'other',
      bodyPartText: 'Neck',
      qty: 8,
      remarks: null,
    },
  ],
  advice: null,
  labReport: 'CBC',
  procedureToday: null,
};

/** The body every write of {@link FIELDS} sends. */
const BODY = {
  doctor_membership_id: NISHA,
  prescription_date: '2026-10-03',
  items: [
    {
      medicine_name: 'Flubolt 400',
      medicine_id: 'med_flubolt0000000000000',
      dose_morning: 0,
      dose_afternoon: 0,
      dose_night: 1,
      is_sos: false,
      meal: 'after',
      timing: null,
      timing_text: null,
      body_part: 'other',
      body_part_text: 'Neck',
      quantity: 8,
      remarks: null,
    },
  ],
  advice: null,
  lab_report: 'CBC',
  procedure_today: null,
};

const PARAMS = { patient_id: PATIENT_ID, patient_prescription_id: RX_ID };

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.patch).mockReset();
  vi.mocked(api.delete).mockReset();
});

describe('the patient’s prescriptions', () => {
  it('reads every page newest first and reads an absent line field as none', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(page([rxRow()], 'cursor-2') as never)
      .mockResolvedValueOnce(
        page([
          rxRow({ id: 'rx_rx49900000000000000000', prescription_number: 499 }),
        ]) as never,
      );
    const rows = await listPatientPrescriptions(PATIENT_ID);
    expect(api.get).toHaveBeenNthCalledWith(
      1,
      '/app/patients/{patient_id}/prescriptions',
      {
        params: { patient_id: PATIENT_ID },
        query: { sort: 'prescription_date', order: 'desc', limit: 100, after: undefined },
      },
    );
    expect(vi.mocked(api.get).mock.calls[1]?.[1]).toMatchObject({
      query: { after: 'cursor-2' },
    });
    expect(rows.map((row) => row.seq)).toEqual([500, 499]);
    expect(rows[0]).toMatchObject({
      id: RX_ID,
      seq: 500,
      patientId: PATIENT_ID,
      doctorId: NISHA,
      date: '2026-10-01',
      status: 'draft',
      advice: 'Avoid sun',
      updatedAt: '2026-10-01T05:00:00.000Z',
    });
    expect(rows[0]?.items).toEqual([
      {
        medicineId: null,
        medicineName: 'Flubolt 400',
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
        remarks: '10 days',
      },
      expect.objectContaining({
        medicineName: 'Clonix-B Lotion',
        timing: 'morning_night',
        bodyPart: 'scalp',
        // No quantity on the wire: one.
        qty: 1,
      }),
    ]);
  });

  it('reads one prescription by its patient and id', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      one(
        rxRow({ status: 'approved', approved_at: '2026-10-02T05:00:00.000Z' }),
      ) as never,
    );
    const rx = await fetchPrescription({ patientId: PATIENT_ID, prescriptionId: RX_ID });
    expect(api.get).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/prescriptions/{patient_prescription_id}',
      { params: PARAMS },
    );
    expect(rx).toMatchObject({
      status: 'approved',
      approvedAt: '2026-10-02T05:00:00.000Z',
    });
  });
});

describe('writes', () => {
  it('writes a draft with every line field, at the visit’s booking when there is one', async () => {
    vi.mocked(api.post).mockResolvedValue(one(rxRow()) as never);
    await createPrescription({
      patientId: PATIENT_ID,
      fields: FIELDS,
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenLastCalledWith(
      '/app/patients/{patient_id}/prescriptions',
      {
        params: { patient_id: PATIENT_ID },
        body: BODY,
        idempotencyKey: KEY,
      },
    );
    await createPrescription({
      patientId: PATIENT_ID,
      fields: FIELDS,
      appointmentId: 'appt_sana0000000000000000',
      idempotencyKey: KEY,
    });
    expect(vi.mocked(api.post).mock.lastCall?.[1]).toMatchObject({
      body: { ...BODY, appointment_id: 'appt_sana0000000000000000' },
    });
  });

  it('saves a draft with the read’s updated_at', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(one(rxRow()) as never);
    await updatePrescription({
      patientId: PATIENT_ID,
      prescriptionId: RX_ID,
      fields: FIELDS,
      expectedUpdatedAt: '2026-10-01T05:00:00.000Z',
      idempotencyKey: KEY,
    });
    expect(api.patch).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/prescriptions/{patient_prescription_id}',
      {
        params: PARAMS,
        body: { ...BODY, expected_updated_at: '2026-10-01T05:00:00.000Z' },
        idempotencyKey: KEY,
      },
    );
  });

  it('approves, deletes with the reason and restores', async () => {
    vi.mocked(api.post).mockResolvedValue(one(rxRow({ status: 'approved' })) as never);
    const approved = await approvePrescription({
      patientId: PATIENT_ID,
      prescriptionId: RX_ID,
      idempotencyKey: KEY,
    });
    expect(approved.status).toBe('approved');
    expect(api.post).toHaveBeenLastCalledWith(
      '/app/patients/{patient_id}/prescriptions/{patient_prescription_id}/approve',
      { params: PARAMS, idempotencyKey: KEY },
    );

    await deletePrescription({
      patientId: PATIENT_ID,
      prescriptionId: RX_ID,
      reason: 'other',
      note: 'Written twice',
    });
    expect(api.delete).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/prescriptions/{patient_prescription_id}',
      { params: PARAMS, reason: 'other', note: 'Written twice' },
    );
    await deletePrescription({
      patientId: PATIENT_ID,
      prescriptionId: RX_ID,
      reason: 'mistake',
      note: null,
    });
    expect(vi.mocked(api.delete).mock.lastCall?.[1]).toEqual({
      params: PARAMS,
      reason: 'mistake',
      note: undefined,
    });

    await restorePrescription({
      patientId: PATIENT_ID,
      prescriptionId: RX_ID,
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenLastCalledWith(
      '/app/patients/{patient_id}/prescriptions/{patient_prescription_id}/restore',
      { params: PARAMS, idempotencyKey: KEY },
    );
  });
});

describe('the drawer’s reads', () => {
  it('reads the member’s kits A to Z, every page', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([
        {
          id: 'rxk_hairfall00000000000000',
          owner_membership_id: NISHA,
          name: 'Hair fall kit',
          items: [{ medicine_name: 'Flubolt 400', dose_night: 1, quantity: 8 }],
          created_at: '2026-10-01T05:00:00.000Z',
          updated_at: '2026-10-01T05:00:00.000Z',
        },
      ]) as never,
    );
    const kits = await listPrescriptionKits();
    expect(api.get).toHaveBeenCalledWith('/app/prescription-kits', {
      query: { sort: 'name', order: 'asc', limit: 100, after: undefined },
    });
    expect(kits).toEqual([
      {
        id: 'rxk_hairfall00000000000000',
        name: 'Hair fall kit',
        items: [expect.objectContaining({ medicineName: 'Flubolt 400', qty: 8 })],
      },
    ]);
  });

  it('reads the store’s medicines with their stock', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([
        {
          id: 'med_flubolt0000000000000',
          name: 'Flubolt 400',
          composition: 'Fluconazole',
          mrp: 120,
          quantity: 8,
          stock_level: 'ok',
        },
      ]) as never,
    );
    expect(await listRxMedicines()).toEqual([
      {
        id: 'med_flubolt0000000000000',
        name: 'Flubolt 400',
        composition: 'Fluconazole',
        stock: 8,
      },
    ]);
    expect(api.get).toHaveBeenCalledWith('/app/medicines', {
      query: { sort: 'name', order: 'asc', limit: 100, after: undefined },
    });
  });

  it('reads the clinic, and the branch only with branch:read', async () => {
    const organization = one({
      id: 'org_test',
      name: 'Cresence Skin Clinic',
      specialties: ['skin'],
      currency: 'INR',
    });
    vi.mocked(api.get).mockImplementation(async (path) =>
      path === '/tenancy/organization'
        ? (organization as never)
        : (one({ id: 'brn_main', phone: '+919825044120', gst_number: 'GSTIN' }) as never),
    );
    expect(await fetchRxSheetClinic({ branchId: 'brn_main', readsBranch: true })).toEqual(
      {
        organization: { name: 'Cresence Skin Clinic', specialties: ['skin'] },
        branch: { phone: '+919825044120', gstNumber: 'GSTIN' },
      },
    );
    expect(api.get).toHaveBeenCalledWith('/app/branches/{branch_id}', {
      params: { branch_id: 'brn_main' },
    });

    vi.mocked(api.get).mockClear();
    expect(
      await fetchRxSheetClinic({ branchId: 'brn_main', readsBranch: false }),
    ).toEqual({
      organization: { name: 'Cresence Skin Clinic', specialties: ['skin'] },
      branch: { phone: '', gstNumber: null },
    });
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
