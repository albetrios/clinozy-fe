import { describe, expect, it } from 'vitest';

import {
  configuredBranchNames,
  findViolations,
  scanText,
} from '../../tooling/validate/no-static-branch-name.ts';

// Verifies the linter both ways: it catches hardcoded branch literals AND the
// live src/ tree is clean, so the gate is meaningful (not a no-op) and green.
describe('no-static-branch-name linter', () => {
  it('resolves the trunk from config (includes main)', () => {
    expect(configuredBranchNames()).toContain('main');
  });

  it('flags quoted branch literals and origin/refs forms', () => {
    expect(scanText(`const b = 'main';`, ['main'])).toHaveLength(1);
    expect(scanText(`checkout("main")`, ['main'])).toHaveLength(1);
    expect(scanText(`fetch('origin/main')`, ['main'])).toHaveLength(1);
    expect(scanText(`ref = 'refs/heads/main';`, ['main'])).toHaveLength(1);
  });

  it('does not flag comments, barewords, JSX, or bounded look-alikes', () => {
    expect(scanText(`// deploy to 'main'`, ['main'])).toHaveLength(0);
    expect(scanText(` * \`main\` -> production`, ['main'])).toHaveLength(0);
    expect(scanText(`const map = { main: 'production' };`, ['main'])).toHaveLength(0);
    expect(scanText(`<main id="main-content">`, ['main'])).toHaveLength(0);
    expect(scanText(`const s = 'maintenance';`, ['main'])).toHaveLength(0);
    expect(scanText(`fetch('origin/maintenance')`, ['main'])).toHaveLength(0);
  });

  it('the live src/ tree has no hardcoded trunk literal', () => {
    const { violations } = findViolations();
    expect(violations, JSON.stringify(violations)).toEqual([]);
  });
});
