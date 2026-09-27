import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Locks the weekly sync-drift canary: the docs↔code drift watch that turns
// silent semantic drift (a doc referencing a renamed path or deleted symbol)
// into a tracked Monday issue instead of a manual audit after the fact. The
// deterministic gates block the PR lane; this canary is the home for the class
// no single commit can break.
const CANARY_WORKFLOW = join(process.cwd(), '.github/workflows/sync-drift-canary.yml');

describe('sync-drift canary policy', () => {
  const workflow = readFileSync(CANARY_WORKFLOW, 'utf8');

  it('runs weekly on Monday 07:00 with manual dispatch', () => {
    expect(workflow).toContain("cron: '0 7 * * 1'");
    expect(workflow).toContain('workflow_dispatch:');
  });

  it('runs BOTH the deterministic and advisory scans', () => {
    // sync:check is the deterministic backstop; docs:staleness is the advisory
    // semantic scan. Dropping either narrows what the canary can catch.
    expect(workflow).toContain('pnpm sync:check');
    expect(workflow).toContain('pnpm docs:staleness');
  });

  it('can write issues and files one tracked issue by hidden marker', () => {
    // issues: write is required to open/update/close; the marker keeps it to a
    // single find-or-create issue instead of spamming a new one each week.
    expect(workflow).toContain('issues: write');
    expect(workflow).toContain('<!-- sync-drift-canary -->');
    expect(workflow).toContain('labels: [label]');
    expect(workflow).toMatch(/label = 'sync-drift'/);
  });

  it('self-heals — closes the issue when both scans are clean again', () => {
    expect(workflow).toContain("state: 'closed'");
  });
});
