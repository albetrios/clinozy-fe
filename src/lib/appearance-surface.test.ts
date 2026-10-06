import { describe, expect, it } from 'vitest';

import {
  appearanceChoiceActiveClassName,
  appearanceChoiceClassName,
  appearanceModeCardClassName,
  appearanceTileActiveClassName,
  appearanceTileClassName,
} from './appearance-surface.ts';

describe('appearance-surface', () => {
  // Every step of the radius scale derives from the Corner radius axis
  // (`index.css`), so a named step tracks the theme; a bare or bracketed radius
  // would not (`pnpm validate:theme-axis`).
  it('rounds tiles on a named radius step — the settings card’s 12px', () => {
    expect(appearanceTileClassName).toContain('rounded-xl');
    expect(appearanceModeCardClassName).toContain('rounded-xl');
    expect(appearanceTileClassName).not.toMatch(/rounded-\[/);
  });

  // The pill's `rounded-full` goes on the element, beside its `data-slot="pill"`,
  // so the Sharp shape can square it — the shared classes carry no radius.
  it('leaves the option pill’s corners to the element that carries the pill slot', () => {
    expect(appearanceChoiceClassName).not.toMatch(/\brounded-/);
    expect(appearanceChoiceClassName).toContain('h-7');
  });

  it('marks the picked tile with the ink edge and the picked pill with muted', () => {
    expect(appearanceTileActiveClassName).toContain('border-foreground');
    expect(appearanceChoiceActiveClassName).toContain('bg-muted');
  });
});
