import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// `pnpm agent-os:check` (agent-os/evals/check.ts) counts its findings once, at `// ── Report ──`.
// A check that records a finding after that line is printed nowhere and fails nothing — the
// selector fixtures did, until the wave-2 planted proof caught it. Every `error(` / `warn(` call
// sits above the count.

const CHECK = readFileSync(join(process.cwd(), 'agent-os', 'evals', 'check.ts'), 'utf8');
const REPORT_COUNT =
  "const errors = findings.filter((finding) => finding.level === 'error');";

describe('agent-os:check report order', () => {
  it('records every finding before the report counts them', () => {
    const reportAt = CHECK.indexOf(REPORT_COUNT);
    expect(reportAt).toBeGreaterThan(0);
    const late = CHECK.slice(reportAt)
      .split('\n')
      .filter((line) => /\b(?:error|warn)\(\s*'/.test(line));
    expect(late).toEqual([]);
  });

  it('runs the selector fixtures above the report', () => {
    expect(CHECK.indexOf('checkSelectorFixtures(repositoryRoot)')).toBeLessThan(
      CHECK.indexOf(REPORT_COUNT),
    );
  });
});
