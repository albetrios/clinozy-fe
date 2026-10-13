import type { StockMovementItem, StockMovementRow } from '../../stock-contracts.ts';

/** A movement the Revert confirm can take: one whose item is still in the room. */
export type StockRevertTarget = StockMovementRow & { item: StockMovementItem };

/**
 * Whether a Movements row can be reverted (`clinic-stock.md:65`): neither
 * reverted nor itself a revert — clinozy-be refuses both with `409
 * already_reverted` — and its item not deleted.
 */
export const isRevertable = (row: StockMovementRow): row is StockRevertTarget =>
  row.kind !== 'reverted' && !row.reverted && row.item !== null;
