import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import {
  patientOfferingWire,
  type PatientPackageChange,
  type PatientPackageRow,
  type PatientPurchaseRow,
  toPatientPackageRow,
  toPatientPurchaseRow,
} from './patient-packages-contracts.ts';
import { patientQueryKeys } from './patients-api.ts';

/*
 * A patient's bought offerings on clinozy-be (`/app/patients/:patient_id/offerings`,
 * api-integration §5.4): the packages, the plan card's last purchases, and a package's change
 * of validity or sessions (`PATCH`, `payment:update`). Bought only by invoicing (G4); the
 * sessions move only with treatments (§6 #20).
 */

/** TanStack Query keys for a patient's bought offerings — under the patients' key. */
export const patientPackageQueryKeys = {
  all: [...patientQueryKeys.all, 'packages'] as const,
  patient: (organizationId: string | null, patientId: string) =>
    [...patientPackageQueryKeys.all, organizationId, patientId] as const,
  /** The last purchases — under the patient's packages, so a change refreshes both. */
  purchases: (organizationId: string | null, patientId: string) =>
    [...patientPackageQueryKeys.patient(organizationId, patientId), 'purchases'] as const,
};

/** The most one page of a patient's offerings takes. */
const PAGE_SIZE = 100;

/** How many lines "<first>’s last purchases" lists (H:2819). */
const PURCHASE_LINES = 6;

/** Every package a patient holds, newest first (`is_package=true`, every page). */
export async function listPatientPackages(
  patientId: string,
): Promise<PatientPackageRow[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/patients/{patient_id}/offerings', {
      params: { patient_id: patientId },
      query: {
        is_package: 'true',
        sort: 'created_at',
        order: 'desc',
        limit: PAGE_SIZE,
        after: after ?? undefined,
      },
    });
    return {
      rows: z
        .array(patientOfferingWire)
        .parse(response.data ?? [])
        .map(toPatientPackageRow),
      next: response.meta?.pagination?.has_more
        ? (response.meta.pagination.next ?? null)
        : null,
    };
  }, 'patient-packages');
}

/** The patient's last six bought offerings, every kind, newest first — one page. */
export async function listPatientPurchases(
  patientId: string,
): Promise<PatientPurchaseRow[]> {
  const response = await api.get('/app/patients/{patient_id}/offerings', {
    params: { patient_id: patientId },
    query: { sort: 'created_at', order: 'desc', limit: PURCHASE_LINES },
  });
  return z
    .array(patientOfferingWire)
    .parse(response.data ?? [])
    .map(toPatientPurchaseRow);
}

/**
 * Change a package's validity or sessions — `400` names `valid_until` (before its invoice's
 * date) or `sessions_total` (below what was spent); `409 record_changed` when it changed since
 * `expectedUpdatedAt`.
 */
export async function updatePatientPackage({
  patientId,
  packageId,
  change,
  expectedUpdatedAt,
  idempotencyKey,
}: {
  patientId: string;
  packageId: string;
  change: PatientPackageChange;
  expectedUpdatedAt: string;
  idempotencyKey: string;
}): Promise<PatientPackageRow> {
  const response = await api.patch(
    '/app/patients/{patient_id}/offerings/{patient_offering_id}',
    {
      params: { patient_id: patientId, patient_offering_id: packageId },
      body: {
        ...(change.validUntil !== undefined && { valid_until: change.validUntil }),
        ...(change.sessionsTotal !== undefined && {
          sessions_total: change.sessionsTotal,
        }),
        expected_updated_at: expectedUpdatedAt,
      },
      idempotencyKey,
    },
  );
  return toPatientPackageRow(patientOfferingWire.parse(response.data));
}
