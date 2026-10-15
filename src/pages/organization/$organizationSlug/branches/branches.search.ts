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

/** Validated `?…` search params for `/branches` and its dialog routes. */
export interface BranchesSearch {
  created?: CreatedFilter;
}

/** Parse `/branches` search params. */
export function validateBranchesSearch(search: Record<string, unknown>): BranchesSearch {
  return { created: readCreatedFilter(search.created) };
}
