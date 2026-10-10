import type { PatientPlan } from './plan-fixture-contracts.ts';

/*
 * The fixture world's plan (`getPlan`, `S:1635`) for the rooms still on fixtures — the invoice
 * drawer (Payments) reads a fixture patient's plan rows and their presets; an invoice write
 * refreshes it. The patient file's plan is clinozy-be's (`plan-api.ts`). Loaded on demand, so
 * the seed data never lands in a room's chunk; this goes with the last fixture room that reads
 * a plan.
 */

const server = () => import('./fixtures/plan-server.fixtures.ts');

/**
 * TanStack Query keys for the fixture plans — all under `['clinic', 'fixture-plan']`, apart
 * from clinozy-be's.
 */
export const fixturePlanQueryKeys = {
  all: ['clinic', 'fixture-plan'] as const,
  detail: (patientId: string) => [...fixturePlanQueryKeys.all, patientId] as const,
};

/** A fixture patient's plan: suggestions, ideas, last purchases and contact activity. */
export async function fetchFixturePlan(patientId: string): Promise<PatientPlan> {
  return (await server()).getPlan(patientId);
}
