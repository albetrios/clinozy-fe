import type { AutomaticSectionValue } from '@/shared/components/RoomToolbar/index.ts';

import type { StockLabel } from './hooks/useStockWords/index.ts';
import type { StockFacets } from './stock-api.ts';

/** An automatic Filters section's chip from a stock word: its value, label and tone. */
export function sectionValue(id: string, word: StockLabel): AutomaticSectionValue {
  return { id, name: word.label, tone: word.tone ?? undefined };
}

/** The values of `key` the tab's whole list holds — none until the facets load. */
export function facetValues(
  facets: StockFacets | undefined,
  key: string,
): readonly string[] {
  return facets?.values[key] ?? [];
}
