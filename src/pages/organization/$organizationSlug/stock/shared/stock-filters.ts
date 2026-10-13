import type { AutomaticSectionValue } from '@/shared/components/RoomToolbar/index.ts';

import type { StockLabel } from './hooks/useStockWords/index.ts';

/**
 * A Filters section's chip from a stock word: its value, label and tone. The
 * sections are fixed — every value of the API's enum (Category 6, Status 3,
 * Type 7) — since clinozy-be serves no facets.
 */
export function sectionValue(id: string, word: StockLabel): AutomaticSectionValue {
  return { id, name: word.label, tone: word.tone ?? undefined };
}
