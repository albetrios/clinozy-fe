import { describe, expect, it } from 'vitest';

import { appointmentQueryKeys } from './appointments-api.ts';
import { VISIT_WRITE_KEYS, visitQueryKeys } from './visits-api.ts';

describe('the visit query keys (D18)', () => {
  it('refreshes the visits and the floor', () => {
    expect(VISIT_WRITE_KEYS).toEqual([visitQueryKeys.all, appointmentQueryKeys.all]);
  });
});
