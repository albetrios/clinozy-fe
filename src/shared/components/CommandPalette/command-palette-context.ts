import { createContext, type RefObject, useContext } from 'react';

/**
 * The 52px input row (H:2672): the search mark · the input · "esc". Content-box,
 * as the design draws it: 52px inside the 1px rule under it.
 */
export const COMMAND_SEARCH_ROW_CLASS =
  'text-muted-foreground box-content flex h-13 flex-none items-center gap-2.5 border-b px-4';

/** The input row's search mark: 15px, muted. */
export const COMMAND_SEARCH_ICON_CLASS = 'size-3.75 flex-none';

/** Keep the pending and resolved search inputs visually identical: 15px, full row height. */
export const COMMAND_SEARCH_CLASS =
  'placeholder:text-muted-foreground text-foreground text-title flex h-full min-w-0 flex-1 bg-transparent py-0 outline-none disabled:cursor-not-allowed disabled:opacity-50';

/** The design's query cap (H:2672). */
export const COMMAND_SEARCH_MAX_LENGTH = 80;

/** Selection and focus retained while the deferred command engine arrives. */
export interface SearchFocus {
  focused: boolean;
  start: number | null;
  end: number | null;
}

/** Search state belongs to the persistent shell, not the deferred result list. */
export const CommandPaletteContext = createContext<{
  query: string;
  setQuery: (query: string) => void;
  searchFocus: RefObject<SearchFocus>;
  rememberFocus: (focused: boolean) => void;
  rememberSelection: (input: HTMLInputElement) => void;
} | null>(null);

/** Access the shell-owned query and input focus handoff. */
export function useCommandPaletteSearch() {
  const context = useContext(CommandPaletteContext);
  if (!context) throw new Error('Command palette search requires its shell');
  return context;
}
