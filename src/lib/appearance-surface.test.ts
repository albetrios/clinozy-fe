import { describe, expect, it } from 'vitest';

import {
  appearanceModeCardClassName,
  appearanceRowTileClassName,
  appearanceTileActiveClassName,
  appearanceTileClassName,
} from './appearance-surface.ts';

describe('appearance-surface', () => {
  // Every step of the radius scale derives from one token (`index.css`), so a
  // named step tracks it; a bare or bracketed radius would not
  // (`pnpm validate:theme-axis`).
  it('rounds tiles on a named radius step — the settings card’s 12px', () => {
    expect(appearanceTileClassName).toContain('rounded-xl');
    expect(appearanceModeCardClassName).toContain('rounded-xl');
    expect(appearanceRowTileClassName).toContain('rounded-xl');
    expect(appearanceTileClassName).not.toMatch(/rounded-\[/);
  });

  it('marks the picked tile with the ink edge', () => {
    expect(appearanceTileActiveClassName).toContain('border-foreground');
  });
});
