import { describe, expect, it } from 'vitest';

import {
  appearanceChoiceClassName,
  appearanceModeCardClassName,
  appearanceTileClassName,
} from './appearance-surface.ts';

describe('appearance-surface', () => {
  it('uses theme radius CSS variables', () => {
    expect(appearanceTileClassName).toContain('rounded-[var(--radius-lg)]');
    expect(appearanceChoiceClassName).toContain('rounded-[var(--radius-md)]');
    expect(appearanceModeCardClassName).toContain('rounded-[var(--radius-lg)]');
  });
});
