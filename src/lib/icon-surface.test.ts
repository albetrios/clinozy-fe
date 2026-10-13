import { describe, expect, it } from 'vitest';

import { closeControlClassName, iconOnPrimarySurface } from './icon-surface.ts';

describe('icon-surface', () => {
  it('exports primary surface icon token', () => {
    expect(iconOnPrimarySurface).toBe('text-primary-foreground');
  });

  it('exports close control classes with semantic tokens only', () => {
    expect(closeControlClassName).toContain('text-muted-foreground');
    expect(closeControlClassName).toContain('hover:text-foreground');
    expect(closeControlClassName).not.toMatch(/\btext-(white|black)\b/);
  });
});
