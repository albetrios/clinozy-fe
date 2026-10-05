import { describe, expect, it } from 'vitest';

import { validateStockCreateSearch } from './stock.dialog-search.ts';

describe('validateStockCreateSearch — the create drawers’ prefills (S:74, S:79, S:82)', () => {
  it('reads the dialog prefills', () => {
    expect(validateStockCreateSearch({ reorder: 'low', name: ' Cotton rolls ' })).toEqual(
      {
        reorder: 'low',
        name: 'Cotton rolls',
      },
    );
    expect(validateStockCreateSearch({ reorder: 'all', name: 'x'.repeat(121) })).toEqual({
      reorder: undefined,
      name: undefined,
    });
  });
});
