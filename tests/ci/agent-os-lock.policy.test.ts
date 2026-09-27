import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The agent-os:lock regenerator and the agent-os:check verifier must agree:
// every committed skills-lock hash equals sha256 of the file at skillPath. This
// runs in the fast ci-policy lane so a vendored skill edited without rerunning
// `pnpm agent-os:lock` is caught here as well as in the agent-os gate.
const lock = JSON.parse(
  readFileSync(join(process.cwd(), 'agent-os/skills-lock.json'), 'utf8'),
) as { skills: Record<string, { skillPath: string; computedHash: string }> };

describe('agent-os skills-lock', () => {
  it('records at least one vendored skill', () => {
    expect(Object.keys(lock.skills).length).toBeGreaterThan(0);
  });

  it('every recorded hash matches sha256 of its skillPath (lock is fresh)', () => {
    for (const [name, entry] of Object.entries(lock.skills)) {
      const actual = createHash('sha256')
        .update(readFileSync(join(process.cwd(), entry.skillPath)))
        .digest('hex');
      expect(actual, `stale hash for "${name}" — run pnpm agent-os:lock`).toBe(
        entry.computedHash,
      );
    }
  });
});
