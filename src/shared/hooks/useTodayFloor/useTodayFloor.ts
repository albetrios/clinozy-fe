import {
  appointmentQueryKeys,
  moveAppointment,
} from '@/shared/api/clinic/appointments-api.ts';
import { leadQueryKeys } from '@/shared/api/clinic/leads-api.ts';
import {
  fetchTodayEnquiries,
  fetchTodayFloor,
  moveFloorStage,
  todayQueryKeys,
} from '@/shared/api/clinic/today-api.ts';
import {
  type FloorStage,
  TODAY_REFETCH_MS,
  type TodayFloorParamsInput,
} from '@/shared/api/clinic/today-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useRefreshTasksAfterRules } from '@/shared/hooks/useTasks/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/**
 * Today's server state (KICKOFF §6.2): the floor and the open enquiries, each
 * polled every 60s while the tab is visible and refetched by every booking,
 * visit, lead or task write (their keys sit under those domains' prefixes) —
 * and the floor's moves.
 */

/** Options for {@link useTodayFloor} and {@link useTodayEnquiries}. */
export interface TodayQueryOptions {
  enabled?: boolean;
  /** Toast a failed load (default: true); off when the room shows its own "Couldn’t load" toast. */
  notifyOnError?: boolean;
}

/**
 * Today's floor: the day's open bookings, polled. A member who reads the pharmacy queue
 * (`patient_prescription:read`) also gets each pharmacy card's prescription.
 */
export function useTodayFloor(
  params: TodayFloorParamsInput = {},
  options: TodayQueryOptions = {},
) {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const access = useClinicAccess();
  const readsPrescriptions = access.canCode('patient_prescription:read');
  return useAppQuery({
    queryKey: [...todayQueryKeys.floor(organizationId, params), { readsPrescriptions }],
    queryFn: () => fetchTodayFloor(params, { readsPrescriptions }),
    refetchInterval: TODAY_REFETCH_MS,
    // Once the member's codes are known — the read depends on them, so it is not made twice.
    enabled: (options.enabled ?? true) && access.isResolved,
    notifyOnError: options.notifyOnError ?? true,
  });
}

/** The open enquiries awaiting a reply, active today — the Enquiries lane, polled. */
export function useTodayEnquiries(
  params: TodayFloorParamsInput = {},
  options: TodayQueryOptions = {},
) {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  return useAppQuery({
    queryKey: todayQueryKeys.enquiries(organizationId, params),
    queryFn: () => fetchTodayEnquiries(params),
    refetchInterval: TODAY_REFETCH_MS,
    enabled: options.enabled ?? true,
    notifyOnError: options.notifyOnError ?? true,
  });
}

/**
 * What a move refreshes: the floor and every appointment read (the floor sits under their
 * prefix), and the leads — a check-in moves the contact's open lead to `clinic_visited`.
 */
const MOVE_REFRESHES = [appointmentQueryKeys.all, leadQueryKeys.all];

/**
 * The floor's moves: check in, its Undo, and a later floor stage — each one user action, one key.
 * A check-in and its Undo move the booking's status, so the server's rules run on them (D81 T7:
 * an Arriving task closes, or opens again): the work queue beside the floor reads its tasks again
 * once they have. A stage move leaves the status — no rules run.
 */
export function useTodayMoves() {
  const refreshTasksAfterRules = useRefreshTasksAfterRules();
  const checkIn = useAppMutation({
    mutationFn: (appointmentId: string, action) =>
      moveAppointment({ appointmentId, route: 'check-in', ...action }),
    invalidateKeys: MOVE_REFRESHES,
    onSuccess: refreshTasksAfterRules,
  });
  const undo = useAppMutation({
    mutationFn: (appointmentId: string, action) =>
      moveAppointment({ appointmentId, route: 'undo-check-in', ...action }),
    invalidateKeys: MOVE_REFRESHES,
    onSuccess: refreshTasksAfterRules,
  });
  const moveStage = useAppMutation({
    mutationFn: (
      { appointmentId, stage }: { appointmentId: string; stage: FloorStage },
      action,
    ) => moveFloorStage({ appointmentId, stage, ...action }),
    invalidateKeys: MOVE_REFRESHES,
  });
  return { checkIn, undoCheckIn: undo, moveStage };
}
