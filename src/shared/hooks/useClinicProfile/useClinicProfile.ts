import { useQuery } from '@tanstack/react-query';

import {
  type ClinicProfileChange,
  clinicQueryKeys,
  type ClinicSettingsChange,
  fetchClinicProfile,
  fetchClinicSettings,
  updateClinicProfile,
  updateClinicSettings,
} from '@/shared/api/app/clinic-api.ts';
import { offeringQueryKeys } from '@/shared/api/app/offerings-api.ts';
import {
  useAppMutation,
  type WriteReportOptions,
} from '@/shared/hooks/useAppMutation/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { meContextQueryKey } from '@/shared/tenancy/me-context.ts';

/** The clinic's name, specialties and timezone (`GET /tenancy/organization`, RC-20). */
export function useClinicProfile({ enabled = true }: { enabled?: boolean } = {}) {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  return useQuery({
    queryKey: clinicQueryKeys.profile(organizationId),
    queryFn: fetchClinicProfile,
    enabled: enabled && organizationId !== null,
  });
}

/**
 * Saves the clinic's specialties and/or timezone (`PATCH /tenancy/organization`, RC-21); the
 * offerings' default specialty and me/context (the clinic's timezone) are read again.
 */
export function useUpdateClinicProfile(
  options: WriteReportOptions & { successMessage?: string } = {},
) {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  return useAppMutation({
    mutationFn: (change: ClinicProfileChange, action) =>
      updateClinicProfile({ change, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [
      clinicQueryKeys.profile(organizationId),
      offeringQueryKeys.specialties(organizationId),
      meContextQueryKey,
    ],
    notifyOnError: options.notifyOnError ?? true,
    ...(options.successMessage && !options.suppressSuccessToast
      ? { successMessage: options.successMessage }
      : {}),
  });
}

/** The clinic's operating values (`GET /tenancy/organization/settings`, RC-22). */
export function useClinicSettings({ enabled = true }: { enabled?: boolean } = {}) {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  return useQuery({
    queryKey: clinicQueryKeys.settings(organizationId),
    queryFn: fetchClinicSettings,
    enabled: enabled && organizationId !== null,
  });
}

/** Saves the clinic's operating values (`PATCH /tenancy/organization/settings`, RC-23). */
export function useUpdateClinicSettings(
  options: WriteReportOptions & { successMessage?: string } = {},
) {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  return useAppMutation({
    mutationFn: (change: ClinicSettingsChange, action) =>
      updateClinicSettings({ change, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [clinicQueryKeys.settings(organizationId)],
    notifyOnError: options.notifyOnError ?? true,
    ...(options.successMessage && !options.suppressSuccessToast
      ? { successMessage: options.successMessage }
      : {}),
  });
}
