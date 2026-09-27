import { describe, expect, it } from 'vitest';

import { APP_SHELL_VARIANT, resolveAppShellVariant } from './resolve-app-shell.ts';

describe('resolveAppShellVariant', () => {
  it('uses the focus shell for personal-only deployments', () => {
    expect(resolveAppShellVariant('personal-only', 0)).toBe(APP_SHELL_VARIANT.focus);
    expect(resolveAppShellVariant('personal-only', 2)).toBe(APP_SHELL_VARIANT.focus);
  });

  it('maps theme variant to preview shells when teams are enabled', () => {
    expect(resolveAppShellVariant('personal-and-team', 0)).toBe(
      APP_SHELL_VARIANT.sidebar,
    );
    expect(resolveAppShellVariant('personal-and-team', 1)).toBe(APP_SHELL_VARIANT.topNav);
    expect(resolveAppShellVariant('personal-and-team', 2)).toBe(APP_SHELL_VARIANT.rail);
    expect(resolveAppShellVariant('team-only', 1)).toBe(APP_SHELL_VARIANT.topNav);
  });

  it('clamps out-of-range theme variants', () => {
    expect(resolveAppShellVariant('team-only', 99)).toBe(APP_SHELL_VARIANT.rail);
    expect(resolveAppShellVariant('team-only', -1)).toBe(APP_SHELL_VARIANT.sidebar);
  });
});
