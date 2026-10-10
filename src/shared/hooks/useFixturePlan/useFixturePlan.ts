import {
  fetchFixturePlan,
  fixturePlanQueryKeys,
} from '@/shared/api/clinic/plan-fixture-api.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';

/*
 * The fixture world's plan for the rooms still on fixtures — the invoice drawer's plan rows
 * (Payments). The patient file reads clinozy-be's plan (`usePlan`); this goes with the last
 * fixture room that reads a plan.
 */

/** A fixture patient's plan; idle without a patient. */
export function useFixturePlan(patientId: string | null) {
  return useAppQuery({
    queryKey: fixturePlanQueryKeys.detail(patientId ?? ''),
    queryFn: () => fetchFixturePlan(patientId ?? ''),
    enabled: patientId !== null,
  });
}
