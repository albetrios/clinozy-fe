import {
  fetchTodayEnquiries,
  fetchTodayFloor,
  todayQueryKeys,
} from '@/shared/api/clinic/today-api.ts';
import {
  TODAY_REFETCH_MS,
  type TodayFloorParamsInput,
} from '@/shared/api/clinic/today-contracts.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';

/**
 * Today's server state (KICKOFF §6.2): the floor and the open enquiries, each
 * polled every 60s while the tab is visible and refetched by every booking,
 * visit, lead or task write (their keys sit under those domains' prefixes).
 */

/** Options for {@link useTodayFloor} and {@link useTodayEnquiries}. */
export interface TodayQueryOptions {
  enabled?: boolean;
  /** Toast a failed load (default: true); off when the room shows its own "Couldn’t load" toast. */
  notifyOnError?: boolean;
}

/** Today's floor (`listTodayFloor`, S:1577): the day's bookings on the floor, polled. */
export function useTodayFloor(
  params: TodayFloorParamsInput = {},
  options: TodayQueryOptions = {},
) {
  return useAppQuery({
    queryKey: todayQueryKeys.floor(params),
    queryFn: () => fetchTodayFloor(params),
    refetchInterval: TODAY_REFETCH_MS,
    enabled: options.enabled ?? true,
    notifyOnError: options.notifyOnError ?? true,
  });
}

/** The open enquiries that wrote in today — the Enquiries lane (Appendix F), polled. */
export function useTodayEnquiries(
  params: TodayFloorParamsInput = {},
  options: TodayQueryOptions = {},
) {
  return useAppQuery({
    queryKey: todayQueryKeys.enquiries(params),
    queryFn: () => fetchTodayEnquiries(params),
    refetchInterval: TODAY_REFETCH_MS,
    enabled: options.enabled ?? true,
    notifyOnError: options.notifyOnError ?? true,
  });
}
