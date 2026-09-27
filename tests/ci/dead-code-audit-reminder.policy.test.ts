import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Locks the quarterly dead-code audit reminder. It is deliberately a nudge, not
// a detector: the per-PR knip gate treats folder barrels as entry points, so a
// barrel's unused re-exports look "used" — a class best caught by a periodic
// manual sweep. This workflow opens/escalates one tracked issue with the
// playbook each quarter.
const WORKFLOW = join(process.cwd(), '.github/workflows/dead-code-audit-reminder.yml');

describe('dead-code audit reminder policy', () => {
  const workflow = readFileSync(WORKFLOW, 'utf8');

  it('runs quarterly (1st of Jan/Apr/Jul/Oct) with manual dispatch', () => {
    expect(workflow).toContain("cron: '0 7 1 */3 *'");
    expect(workflow).toContain('workflow_dispatch:');
  });

  it('opens one tracked issue by hidden marker (no spam)', () => {
    expect(workflow).toContain('issues: write');
    expect(workflow).toContain('<!-- dead-code-audit-reminder -->');
    expect(workflow).toMatch(/label = 'dead-code-audit'/);
    expect(workflow).toContain('labels: [label]');
  });

  it('escalates an unactioned reminder instead of duplicating it', () => {
    expect(workflow).toContain('createComment');
    expect(workflow).toContain('overdue');
  });
});
