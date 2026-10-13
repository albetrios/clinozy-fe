import { keepPreviousData } from '@tanstack/react-query';

import {
  commandSearchQueryKeys,
  isCommandSearchQuery,
  searchAppCommands,
} from '@/shared/api/app/command-search-api.ts';
import type { CommandSearchResult } from '@/shared/api/app/command-search-contracts.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedValue/index.ts';

/** ⌘K waits this long after the last keystroke before it searches (KICKOFF §6.0 Timers, `S:1565`). */
const COMMAND_SEARCH_DEBOUNCE_MS = 250;

/** ⌘K's search as the menu reads it. */
export interface CommandSearch {
  /**
   * The hits on screen: the answer to the query as typed, or — while the next
   * answer is on its way — to an earlier query that one extends or shortens.
   * Undefined below the contacts search's minimum and before any related answer.
   */
  data: CommandSearchResult | undefined;
  /** A search is waiting out the debounce or in flight for the query as typed. */
  isSearching: boolean;
}

interface Answer {
  query: string;
  result: CommandSearchResult;
}

/** One query extends or shortens the other ("dha" → "dhar", "dhar" → "dha"). */
function isRelated(a: string, b: string): boolean {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left.startsWith(right) || right.startsWith(left);
}

/**
 * ⌘K's search (`commandSearch`; D158): the people `GET /app/contacts?q=` finds, debounced
 * 250ms, once the query is one the contacts search takes (3+ letters, 4+ digits or a contact
 * number). The previous answer stays up while the next one loads, so the group does not blink on
 * every keystroke — but only when the two queries are related, so "rhe"'s people never stand in
 * for "dha".
 */
export function useCommandSearch(
  query: string,
  { enabled = true }: { enabled?: boolean } = {},
): CommandSearch {
  const { debounced, isPending } = useDebouncedSearch(query, COMMAND_SEARCH_DEBOUNCE_MS);
  const typed = query.trim();
  const live = enabled && isCommandSearchQuery(typed);
  const search = useAppQuery<Answer>({
    queryKey: commandSearchQueryKeys.search(debounced.toLowerCase()),
    queryFn: async () => ({
      query: debounced,
      result: await searchAppCommands(debounced),
    }),
    enabled: enabled && isCommandSearchQuery(debounced),
    placeholderData: keepPreviousData,
  });
  const answer = search.data;
  return {
    data: live && answer && isRelated(answer.query, typed) ? answer.result : undefined,
    isSearching: live && (isPending || search.isFetching),
  };
}
