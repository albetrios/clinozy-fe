import type { DeleteReason, OfferingSuggestion } from './clinic-schema.ts';
import type {
  PatientPlan,
  SuggestionCreateInput,
  SuggestionPatch,
} from './plan-contracts.ts';

/*
 * A patient's plan (`getPlan`, `addSuggestion`, `updateSuggestion`,
 * `S:1635, 1646`) — the Offering suggestions card's data in the appointment
 * form and the patient file. REPLACE_WITH_API: every call runs on the fixture
 * server, loaded on demand so the seed data never lands in a room's chunk.
 */

const server = () => import('./fixtures/plan-server.fixtures.ts');

/** TanStack Query keys for plans — all under `['clinic', 'plan']`. */
export const planQueryKeys = {
  all: ['clinic', 'plan'] as const,
  detail: (patientId: string) => [...planQueryKeys.all, patientId] as const,
};

/** A patient's plan: suggestions, ideas, last purchases and contact activity. */
export async function fetchPlan(patientId: string): Promise<PatientPlan> {
  return (await server()).getPlan(patientId);
}

/** Add a suggestion — Planned, one unit at list price; 409 when it is already suggested. */
export async function addSuggestion(
  input: SuggestionCreateInput,
): Promise<OfferingSuggestion> {
  return (await server()).addSuggestion(input);
}

/** Edit a suggestion's quantity, final price or status. */
export async function updateSuggestion(
  id: string,
  patch: SuggestionPatch,
): Promise<OfferingSuggestion> {
  return (await server()).updateSuggestion(id, patch);
}

/** Remove a suggestion with the reason confirm's choice. */
export async function removeSuggestion(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<OfferingSuggestion> {
  return (await server()).removeSuggestion(id, reason, note);
}

/** Bring a removed suggestion back (the Undo). */
export async function restoreSuggestion(id: string): Promise<OfferingSuggestion> {
  return (await server()).restoreSuggestion(id);
}
