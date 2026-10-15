/**
 * URL search-param schema for the Branches room (consumed by routeTree's
 * `validateSearch`): the Filters' one section, Created (`users.md:204`;
 * KICKOFF §6.12 — no search, no sort: the main branch first, then as opened).
 * A value the URL can't hold is dropped, never an error.
 *
 * Dependency-free on purpose: `routeTree.tsx` is the entry chunk.
 */
import {
  type CreatedFilter,
  readCreatedFilter,
} from '@/shared/api/app/app-list-filters.ts';

import type { BranchDrawerStepId } from './components/BranchDrawer/branch-form.ts';

/**
 * The Branch drawer's steps a link may open on (`?step=`): Payment received's "Add the link"
 * opens Contact, where the Google review link is (`feat-payment-celebration`).
 */
const BRANCH_DRAWER_STEPS = [
  'place',
  'contact',
  'people',
  'places',
] as const satisfies readonly BranchDrawerStepId[];

/** Validated `?…` search params for `/branches` and its dialog routes. */
export interface BranchesSearch {
  created?: CreatedFilter;
  /** The edit drawer's step to open on — read once, as it opens. */
  step?: BranchDrawerStepId;
}

/** Parse `/branches` search params. */
export function validateBranchesSearch(search: Record<string, unknown>): BranchesSearch {
  return {
    created: readCreatedFilter(search.created),
    step: BRANCH_DRAWER_STEPS.find((step) => step === search.step),
  };
}
