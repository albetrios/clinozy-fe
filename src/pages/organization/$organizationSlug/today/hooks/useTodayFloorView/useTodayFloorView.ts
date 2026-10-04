import { useCallback, useMemo } from 'react';

import type { TodayEnquiry } from '@/shared/api/clinic/today-contracts.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useTodayEnquiries, useTodayFloor } from '@/shared/hooks/useTodayFloor/index.ts';

import { groupTodayLanes, type TodayLanes, todayPulse } from '../../today.lanes.ts';

const NO_ENQUIRIES: readonly TodayEnquiry[] = [];

/** What the room shows of the floor. */
export interface TodayFloorView {
  lanes: TodayLanes;
  pulse: ReturnType<typeof todayPulse>;
  /** The first load: the page wears its skeleton (later visits read the cache at once). */
  loading: boolean;
}

/**
 * The floor as the room shows it (KICKOFF §6.2 Route and data, States): the
 * day's bookings and open enquiries in the header's branches (the D32
 * preference, read once it has loaded), polled every 60s; their lanes and the
 * pulse. A failed read toasts "Couldn’t load this list · connection dropped.
 * Showing the last copy." with Retry, once, and the last copy stays.
 */
export function useTodayFloorView(): TodayFloorView {
  const { preferences, isPending: preferencesPending } = usePreferences();
  const params = { branchIds: preferences.branchFilter };
  const options = { enabled: !preferencesPending, notifyOnError: false };
  const floor = useTodayFloor(params, options);
  const enquiries = useTodayEnquiries(params, options);
  const { refetch: refetchFloor } = floor;
  const { refetch: refetchEnquiries } = enquiries;
  const retry = useCallback(() => {
    void refetchFloor();
    void refetchEnquiries();
  }, [refetchFloor, refetchEnquiries]);
  const rows = useListLoadError(
    {
      isError: floor.isError || enquiries.isError,
      refetch: retry,
      rows: floor.data,
      isPending: floor.isPending,
    },
    'today-floor',
  );
  const asked = enquiries.data ?? NO_ENQUIRIES;
  const lanes = useMemo(() => groupTodayLanes(rows, asked), [rows, asked]);
  return {
    lanes,
    pulse: todayPulse(lanes),
    loading: floor.isPending || enquiries.isPending,
  };
}
