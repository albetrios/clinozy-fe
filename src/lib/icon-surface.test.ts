import { describe, expect, it } from 'vitest';

import {
  closeControlClassName,
  iconOnBrandSurface,
  iconOnPrimarySurface,
  iconOnSidebarSurface,
} from './icon-surface.ts';

describe('icon-surface', () => {
  it('exports brand surface icon token', () => {
    expect(iconOnBrandSurface).toBe('text-brand-foreground');
  });

  it('exports sidebar surface icon token', () => {
    expect(iconOnSidebarSurface).toBe('text-sidebar-foreground');
  });

  it('exports primary surface icon token', () => {
    expect(iconOnPrimarySurface).toBe('text-primary-foreground');
  });

  it('exports close control classes with semantic tokens only', () => {
    expect(closeControlClassName).toContain('text-muted-foreground');
    expect(closeControlClassName).toContain('hover:text-foreground');
    expect(closeControlClassName).not.toMatch(/\btext-(white|black)\b/);
  });
});
