import { describe, expect, it } from 'vitest';

import { validateOfferingCreateSearch } from './offerings.dialog-search.ts';

describe('validateOfferingCreateSearch (S:99)', () => {
  it('prefills the name it was asked with', () => {
    expect(validateOfferingCreateSearch({ name: ' Hydra facial ' })).toEqual({
      name: 'Hydra facial',
    });
  });

  it('drops an empty or over-long name', () => {
    expect(validateOfferingCreateSearch({})).toEqual({ name: undefined });
    expect(validateOfferingCreateSearch({ name: 'x'.repeat(121) })).toEqual({
      name: undefined,
    });
  });
});
