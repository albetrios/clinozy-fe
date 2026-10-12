import { describe, expect, it } from 'vitest';

import { validateStockSearch } from '../stock.search.ts';
import { movementFilterKey, movementParamsOf } from './movements.params.ts';

describe('movementParamsOf — the Movements read from the URL', () => {
  it('hands on the types, the one item and the Created filter — no search, no sort', () => {
    const params = movementParamsOf(
      validateStockSearch({
        q: 'cotton',
        type: 'used,adjust',
        item: 'sitm_sofra0000000000000000',
        created: 'last_7',
        sort: 'seq:desc',
      }),
    );
    expect(params).toEqual({
      type: ['used', 'adjust'],
      item: 'sitm_sofra0000000000000000',
      created: 'last_7',
    });
  });

  it('reads an empty URL as every movement', () => {
    expect(movementParamsOf(validateStockSearch({}))).toEqual({
      type: undefined,
      item: undefined,
      created: undefined,
    });
  });
});

describe('movementFilterKey', () => {
  it('changes with any filter — the item included', () => {
    const all = movementFilterKey(movementParamsOf({}));
    expect(movementFilterKey(movementParamsOf({ item: 'sitm_a' }))).not.toBe(all);
    expect(movementFilterKey(movementParamsOf({ type: ['used'] }))).not.toBe(all);
    expect(movementFilterKey(movementParamsOf({}))).toBe(all);
  });
});
