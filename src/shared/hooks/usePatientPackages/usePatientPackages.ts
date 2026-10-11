import {
  listPatientPackages,
  listPatientPurchases,
  patientPackageQueryKeys,
  updatePatientPackage,
} from '@/shared/api/app/patient-packages-api.ts';
import type {
  PatientPackageChange,
  PatientPackageRow,
} from '@/shared/api/app/patient-packages-contracts.ts';
import { planQueryKeys } from '@/shared/api/app/plan-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/**
 * One patient's packages (`GET /app/patients/:patient_id/offerings?is_package=true`) — the
 * Packages section, a treatment's "From package", the Overview's care card; idle without a
 * patient or an organization.
 */
export function usePatientPackages(patientId: string, { enabled = true } = {}) {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  return useAppQuery({
    queryKey: patientPackageQueryKeys.patient(organizationId, patientId),
    queryFn: () => listPatientPackages(patientId),
    enabled: enabled && patientId !== '' && organizationId !== null,
  });
}

/**
 * The patient's last six bought offerings, every kind (`GET …/offerings`) — the plan card's
 * "<first>’s last purchases"; idle without a patient or an organization.
 */
export function usePatientPurchases(patientId: string | null) {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  return useAppQuery({
    queryKey: patientPackageQueryKeys.purchases(organizationId, patientId ?? ''),
    queryFn: () => listPatientPurchases(patientId ?? ''),
    enabled: Boolean(patientId) && organizationId !== null,
  });
}

/** What a package's edit sends: the package as read and its change. */
export interface PatientPackageUpdateVars {
  patientId: string;
  /** The package as read — its id and the `updated_at` the save sends back. */
  row: Pick<PatientPackageRow, 'id' | 'updatedAt'>;
  change: PatientPackageChange;
}

/**
 * Change a package's validity or sessions (`PATCH …/offerings/:patient_offering_id`,
 * `payment:update`) — the caller toasts. It refetches the patient's bought offerings and the
 * plans (an idea renews a package almost used up).
 */
export function useUpdatePatientPackage(
  options: CrudMutationOptions<PatientPackageRow, PatientPackageUpdateVars> = {},
) {
  return useAppMutation<PatientPackageRow, PatientPackageUpdateVars>({
    mutationFn: ({ patientId, row, change }, action) =>
      updatePatientPackage({
        patientId,
        packageId: row.id,
        change,
        expectedUpdatedAt: row.updatedAt,
        idempotencyKey: action.idempotencyKey,
      }),
    invalidateKeys: [patientPackageQueryKeys.all, planQueryKeys.all],
    ...options,
  });
}
