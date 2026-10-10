import { useCallback, useMemo } from 'react';

import type { TodayEnquiry } from '@/shared/api/clinic/today-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
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
 * day's bookings — for a member who reads appointments — and the open enquiries — for a member
 * who reads leads — in
 * the header's branches (the D32 preference, read once it has loaded), polled
 * every 60s; their lanes and the pulse. A failed read toasts "Couldn’t load this list · connection dropped.
 * Showing the last copy." with Retry, once, and the last copy stays.
 */
export function useTodayFloorView(): TodayFloorView {
  const { preferences, isPending: preferencesPending } = usePreferences();
  const access = useClinicAccess();
  // Each lane is read only with its code: the floor `appointment:read`, the enquiries `lead:read`.
  const readsFloor = access.isResolved && access.can('appointments', 'view');
  const readsEnquiries = access.can('leads', 'view');
  const params = { branchIds: preferences.branchFilter };
  const options = { enabled: !preferencesPending, notifyOnError: false };
  const floor = useTodayFloor(params, options);
  const enquiries = useTodayEnquiries(params, {
    ...options,
    enabled: options.enabled && readsEnquiries,
  });
  const enquiriesPending = readsEnquiries && enquiries.isPending;
  const floorPending = !access.isResolved || (readsFloor && floor.isPending);
  const { refetch: refetchFloor } = floor;
  const { refetch: refetchEnquiries } = enquiries;
  const retry = useCallback(() => {
    void refetchFloor();
    void refetchEnquiries();
  }, [refetchFloor, refetchEnquiries]);
  const rows = useListLoadError(
    {
      isError: (readsFloor && floor.isError) || (readsEnquiries && enquiries.isError),
      refetch: retry,
      rows: floor.data,
      isPending: floorPending,
    },
    'today-floor',
  );
  const asked = enquiries.data ?? NO_ENQUIRIES;
  const lanes = useMemo(() => groupTodayLanes(rows, asked), [rows, asked]);
  return {
    lanes,
    pulse: todayPulse(lanes),
    loading: floorPending || enquiriesPending,
  };
}
