import {
  fetchFixtureMyStaff,
  fetchFixtureStaff,
  fixtureStaffQueryKeys,
} from '@/shared/api/app/staff-fixture-api.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

/**
 * The fixture world's staff (REPLACE_WITH_API) — a Medical sale's "Prescribed by" and its team
 * pills. A room on the API reads the live team instead (`useTeamDirectory`).
 */
export function useFixtureStaff() {
  return useAppQuery({
    queryKey: fixtureStaffQueryKeys.list(),
    queryFn: fetchFixtureStaff,
  });
}

/** The signed-in member's fixture staff record, by their sign-in email — a Medical sale's own name. */
export function useFixtureMyStaff() {
  const email = useAuthStore((state) => state.user?.email ?? null);
  return useAppQuery({
    queryKey: fixtureStaffQueryKeys.mine(email),
    queryFn: () => fetchFixtureMyStaff(email),
    staleTime: 5 * 60_000,
  });
}
