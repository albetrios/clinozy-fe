import { appointmentQueryKeys } from './appointments-api.ts';
import type { SetVisitStageInput, VisitChange } from './visits-contracts.ts';

/*
 * The Visit API (D18; Appendix F `setVisitStage` and the Undo of a move —
 * there is no Visit in the schema yet). REPLACE_WITH_API: every call runs on
 * the fixture server, loaded on demand; when clinozy-be serves visits, these
 * bodies become `apiClient` calls and nothing else moves.
 */

const server = () => import('./fixtures/visits-server.fixtures.ts');

/** TanStack Query keys for visits — all under `['clinic', 'visits']`. */
export const visitQueryKeys = {
  all: ['clinic', 'visits'] as const,
};

/**
 * What a visit write may have changed: the visits, and Today's floor (under
 * the appointments prefix) — the card moves lanes.
 */
export const VISIT_WRITE_KEYS = [visitQueryKeys.all, appointmentQueryKeys.all] as const;

/** Move a checked-in booking's visit to a stage — "Send in" moves it to the doctor. */
export async function setVisitStage(input: SetVisitStageInput): Promise<VisitChange> {
  return (await server()).setVisitStage(input);
}

/** Undo a stage write by the token it answered. */
export async function undoVisitChange(undoToken: string): Promise<void> {
  return (await server()).undoVisitChange(undoToken);
}
