import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';

import {
  listPatientPackages,
  listPatientPurchases,
  patientPackageQueryKeys,
  updatePatientPackage,
} from './patient-packages-api.ts';
import { patientQueryKeys } from './patients-api.ts';

const PATIENT = 'pat_priti000000000000000';
const PACKAGE = 'poff_tvsx5uubk0jtmkvb7634h';

/** A bought offering as clinozy-be answers it (live: `GET …/offerings`). */
const offeringRow = (patch: Record<string, unknown> = {}) => ({
  id: PACKAGE,
  patient_id: PATIENT,
  offering_id: 'off_12y8j0m4ewq7zyr32dqvt',
  offering_name: 'LHR Full Face',
  invoice_id: 'invc_vpyowzjwx80tpo4ba84fb',
  invoice_item_id: 'iitm_m63rfqy254v4hm4t4nz6b',
  sessions_total: 7,
  sessions_used: 1,
  sessions_left: 6,
  is_package: true,
  valid_until: '2027-10-10',
  status: 'active',
  created_at: '2026-10-10T01:48:09.406Z',
  updated_at: '2026-10-10T01:48:09.406Z',
  ...patch,
});

/** The package as the file reads it. */
const PACKAGE_ROW = {
  id: PACKAGE,
  offeringId: 'off_12y8j0m4ewq7zyr32dqvt',
  name: 'LHR Full Face',
  sessionsTotal: 7,
  sessionsUsed: 1,
  sessionsLeft: 6,
  status: 'active',
  validUntil: '2027-10-10',
  invoiceId: 'invc_vpyowzjwx80tpo4ba84fb',
  createdAt: '2026-10-10T01:48:09.406Z',
  updatedAt: '2026-10-10T01:48:09.406Z',
};

const page = (
  rows: unknown[],
  pagination: { next?: string | null; has_more?: boolean } = {},
) => ({
  data: rows,
  meta: {
    request_id: 'req',
    pagination: { per_page: 100, next: null, has_more: false, ...pagination },
  },
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('patient package keys', () => {
  it('sit under the patients’ key, the purchases under the patient’s packages', () => {
    expect(patientPackageQueryKeys.all.slice(0, 2)).toEqual([...patientQueryKeys.all]);
    expect(patientPackageQueryKeys.purchases('org', PATIENT).slice(0, 5)).toEqual([
      ...patientPackageQueryKeys.patient('org', PATIENT),
    ]);
  });
});

describe('listPatientPackages', () => {
  it('reads every page of the packages, newest first, with the server’s sessions and status', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(page([offeringRow()], { next: 'c2', has_more: true }))
      .mockResolvedValueOnce(
        page([offeringRow({ id: 'poff_two', status: 'expired', valid_until: null })]),
      );
    const rows = await listPatientPackages(PATIENT);
    expect(api.get).toHaveBeenNthCalledWith(1, '/app/patients/{patient_id}/offerings', {
      params: { patient_id: PATIENT },
      query: {
        is_package: 'true',
        sort: 'created_at',
        order: 'desc',
        limit: 100,
        after: undefined,
      },
    });
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      '/app/patients/{patient_id}/offerings',
      expect.objectContaining({ query: expect.objectContaining({ after: 'c2' }) }),
    );
    expect(rows).toEqual([
      PACKAGE_ROW,
      { ...PACKAGE_ROW, id: 'poff_two', status: 'expired', validUntil: null },
    ]);
  });
});

describe('listPatientPurchases', () => {
  it('reads the last six bought offerings of every kind, marking the packages', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([
        offeringRow({
          id: 'poff_hydra',
          offering_name: 'Hydrafacial',
          is_package: false,
          sessions_total: 1,
          sessions_left: 1,
          sessions_used: 0,
        }),
        offeringRow(),
      ]),
    );
    const rows = await listPatientPurchases(PATIENT);
    expect(api.get).toHaveBeenCalledWith('/app/patients/{patient_id}/offerings', {
      params: { patient_id: PATIENT },
      query: { sort: 'created_at', order: 'desc', limit: 6 },
    });
    expect(rows.map((row) => [row.name, row.isPackage])).toEqual([
      ['Hydrafacial', false],
      ['LHR Full Face', true],
    ]);
    expect(rows[1]).toEqual({ ...PACKAGE_ROW, isPackage: true });
  });
});

describe('updatePatientPackage', () => {
  it('sends only the changed fields with `expected_updated_at` and the action’s key', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: offeringRow({ sessions_total: 8, sessions_left: 7, valid_until: null }),
    });
    const saved = await updatePatientPackage({
      patientId: PATIENT,
      packageId: PACKAGE,
      change: { sessionsTotal: 8, validUntil: null },
      expectedUpdatedAt: '2026-10-10T01:48:09.406Z',
      idempotencyKey: 'key-1',
    });
    expect(api.patch).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/offerings/{patient_offering_id}',
      {
        params: { patient_id: PATIENT, patient_offering_id: PACKAGE },
        body: {
          valid_until: null,
          sessions_total: 8,
          expected_updated_at: '2026-10-10T01:48:09.406Z',
        },
        idempotencyKey: 'key-1',
      },
    );
    expect(saved).toMatchObject({ sessionsTotal: 8, sessionsLeft: 7, validUntil: null });

    vi.mocked(api.patch).mockResolvedValueOnce({ data: offeringRow() });
    await updatePatientPackage({
      patientId: PATIENT,
      packageId: PACKAGE,
      change: { validUntil: '2027-12-31' },
      expectedUpdatedAt: '2026-10-10T01:48:09.406Z',
      idempotencyKey: 'key-2',
    });
    expect(vi.mocked(api.patch).mock.lastCall?.[1]).toMatchObject({
      body: {
        valid_until: '2027-12-31',
        expected_updated_at: '2026-10-10T01:48:09.406Z',
      },
    });
    expect(vi.mocked(api.patch).mock.lastCall?.[1]).not.toHaveProperty(
      'body.sessions_total',
    );
  });
});
