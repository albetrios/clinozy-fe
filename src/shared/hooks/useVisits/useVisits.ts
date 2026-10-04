import { todayQueryKeys } from '@/shared/api/clinic/today-api.ts';
import type { TodayFloorRow } from '@/shared/api/clinic/today-contracts.ts';
import {
  setVisitStage,
  undoVisitChange,
  VISIT_WRITE_KEYS,
} from '@/shared/api/clinic/visits-api.ts';
import type {
  SetVisitStageInput,
  VisitChange,
  VisitStage,
} from '@/shared/api/clinic/visits-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';

/**
 * The Visit's writes (D18): its stage moves — Today's "Send in" — and their
 * Undo. Writes toast only their errors; the screen toasts success itself with
 * its own words and Undo.
 */

const isFloorRow = (value: unknown): value is TodayFloorRow =>
  typeof value === 'object' && value !== null && 'id' in value && 'visit' in value;

/**
 * A cached floor with one booking's visit moved to `stage` as of `at` — the
 * optimistic side of a stage write. A visit not yet on record carries no id
 * until the refetch brings the server's.
 */
export function withVisitStage(
  data: unknown,
  appointmentId: string,
  stage: VisitStage,
  at: string,
): unknown {
  if (!Array.isArray(data)) return data;
  let changed = false;
  const next = data.map((row: unknown) => {
    if (!(isFloorRow(row) && row.id === appointmentId)) return row;
    changed = true;
    return { ...row, visit: { id: row.visit?.id ?? '', stage, stageAt: at } };
  });
  return changed ? next : data;
}

/**
 * Move a checked-in booking's visit to a stage — optimistic: the floor shows
 * the card in its new lane at once and puts it back if the server refuses
 * (409 with its words). Answers the visit and its Undo token.
 */
export function useSetVisitStage() {
  return useAppMutation<VisitChange, SetVisitStageInput>({
    mutationFn: setVisitStage,
    invalidateKeys: [...VISIT_WRITE_KEYS],
    optimisticQueries: {
      queryKey: todayQueryKeys.floors(),
      update: (data, { appointmentId, stage }) =>
        withVisitStage(data, appointmentId, stage, new Date().toISOString()),
    },
  });
}

/** Undo a stage write by its token — the toast's "Undo"; silent unless it fails. */
export function useUndoVisitChange() {
  return useAppMutation<void, string>({
    mutationFn: undoVisitChange,
    invalidateKeys: [...VISIT_WRITE_KEYS],
  });
}
