import { appointmentQueryKeys } from './appointments-api.ts';
import { clinicToday } from './clinic-time.ts';
import { leadQueryKeys } from './leads-api.ts';
import {
  type TodayEnquiry,
  type TodayFloorParams,
  type TodayFloorParamsInput,
  todayFloorParamsSchema,
  type TodayFloorRow,
} from './today-contracts.ts';

/*
 * The Today API (KICKOFF §6.2; `schema-routes.md` S:1577–1578, plus Appendix
 * F's Enquiries lane). REPLACE_WITH_API: every call runs on the fixture
 * server, loaded on demand so the seed data never lands in a room's chunk;
 * when clinozy-be serves the floor, these bodies become `apiClient` calls and
 * nothing else moves.
 */

const server = () => import('./fixtures/today-server.fixtures.ts');

/** Floor params with the day filled (today, clinic-local) and the branches in a stable order. */
export function normalizeTodayFloorParams(
  params: TodayFloorParamsInput = {},
): Required<TodayFloorParams> {
  const parsed = todayFloorParamsSchema.parse(params);
  return {
    date: parsed.date ?? clinicToday(),
    branchIds: [...new Set(parsed.branchIds)].sort(),
  };
}

/**
 * TanStack Query keys for Today. The floor lives under the appointments
 * prefix and the enquiries under the leads one, so every booking, visit, lead
 * or task write — each refetches its domain — refreshes the floor too
 * (S:1577: "status change, any appointment save").
 */
export const todayQueryKeys = {
  floors: () => [...appointmentQueryKeys.all, 'today-floor'] as const,
  floor: (params: TodayFloorParamsInput = {}) =>
    [...todayQueryKeys.floors(), normalizeTodayFloorParams(params)] as const,
  enquiries: (params: TodayFloorParamsInput = {}) =>
    [...leadQueryKeys.all, 'today-enquiries', normalizeTodayFloorParams(params)] as const,
};

/** Today's floor (`listTodayFloor`): the day's bookings on the floor, by start time. */
export async function fetchTodayFloor(
  params: TodayFloorParamsInput = {},
): Promise<TodayFloorRow[]> {
  return (await server()).listTodayFloor(normalizeTodayFloorParams(params));
}

/** The open enquiries that wrote in today, by when they wrote. */
export async function fetchTodayEnquiries(
  params: TodayFloorParamsInput = {},
): Promise<TodayEnquiry[]> {
  return (await server()).listTodayEnquiries(normalizeTodayFloorParams(params));
}
