import { describe, expect, it } from 'vitest';

import { staffName } from './tasks.display.ts';

describe('staffName', () => {
  it('joins the first and last name, skipping a missing one', () => {
    expect(staffName({ firstName: 'Riya', lastName: 'Shah' })).toBe('Riya Shah');
    expect(staffName({ firstName: 'Dr. Drashti', lastName: 'Desai' })).toBe(
      'Dr. Drashti Desai',
    );
    expect(staffName({ firstName: 'Asha', lastName: null })).toBe('Asha');
  });
});
