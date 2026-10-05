import { describe, expect, it } from 'vitest';

import { VISIT_TABS } from './visits.constants.ts';
import { validateVisitSearch, VISIT_TAB_VALUES } from './visits.search.ts';

describe('validateVisitSearch (`?tab=`, KICKOFF §4)', () => {
  it('keeps a known tab', () => {
    expect(validateVisitSearch({ tab: 'consult' })).toEqual({ tab: 'consult' });
    expect(validateVisitSearch({ tab: 'checkout' })).toEqual({ tab: 'checkout' });
  });

  it('drops an unknown or missing tab — History', () => {
    expect(validateVisitSearch({ tab: 'session' })).toEqual({ tab: undefined });
    expect(validateVisitSearch({})).toEqual({ tab: undefined });
  });

  it('declares the sheet’s tabs in their order', () => {
    expect([...VISIT_TAB_VALUES]).toEqual([...VISIT_TABS]);
  });
});
