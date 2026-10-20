import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { jobBlocks } from '@/tests/utils/workflow-jobs.ts';

// Every scheduled check, and post-merge CI, opens (or comments on) one `ci-failure` issue per
// check when it fails and closes it on the next green run, through the
// `.github/actions/ci-failure-issue` action — so an open issue means the check is red right now.
// The action is a true copy of clinozy-be's (tests/ci/mirrored-files.policy.test.ts); clinozy-be
// pins the action itself in src/tests/unit/ci/ci-failure-issue.policy.unit.test.ts, and the case
// below runs it here too for the one rule both repositories met first: an issue tracks main.

const WORKFLOWS = '.github/workflows';
const USES = 'uses: ./.github/actions/ci-failure-issue';
const SCRIPT = '.github/actions/ci-failure-issue/ci-failure-issue.sh';

// Not checks: cache housekeeping, and two jobs whose job is a tracked issue of their own.
const OWN_SIGNAL = new Set([
  'cleanup-cache.yml',
  'sync-drift-canary.yml',
  'dead-code-audit-reminder.yml',
]);

const files = readdirSync(WORKFLOWS).filter((name) => name.endsWith('.yml'));
const text = (name: string) => readFileSync(join(WORKFLOWS, name), 'utf8');
const alerted = [
  ...files.filter((name) => /^ {2}schedule:/m.test(text(name)) && !OWN_SIGNAL.has(name)),
  'post-merge-ci.yml',
];

const titles = (source: string, mode: 'open' | 'close') =>
  [...source.matchAll(new RegExp(`mode: ${mode}\\n\\s+title: (.+)`, 'g'))].map(
    (match) => match[1] ?? '',
  );

describe('ci-failure alert on every scheduled check', () => {
  it('covers the eight scheduled checks and post-merge CI', () => {
    expect(alerted.sort()).toEqual(
      [
        'codeql.yml',
        'e2e-backend.yml',
        'cross-browser.yml',
        'lighthouse.yml',
        'mutation-test.yml',
        'post-merge-ci.yml',
        'scheduled-deps-audit.yml',
        'scheduled-release-guards.yml',
        'scheduled-unit-nightly.yml',
      ].sort(),
    );
  });

  it.each(alerted)('%s opens and closes its issue through the shared action', (name) => {
    const source = text(name);
    const opened = titles(source, 'open');
    expect(opened.length).toBeGreaterThan(0);
    expect(new Set(titles(source, 'close'))).toEqual(new Set(opened));
    for (const [job, block] of jobBlocks(source)) {
      if (!block.includes(USES)) continue;
      expect(block, `${name} → ${job}`).toContain('issues: write');
      // A local action needs the checkout first; this job needs nothing else from it.
      const checkout = block.indexOf('sparse-checkout: .github/actions/ci-failure-issue');
      expect(checkout, `${name} → ${job}`).toBeGreaterThan(-1);
      expect(checkout, `${name} → ${job}`).toBeLessThan(block.indexOf(USES));
    }
  });

  it.each(alerted)(
    '%s alerts on a timed-out job too (it ends cancelled, not failed)',
    (name) => {
      for (const [job, block] of jobBlocks(text(name))) {
        if (!/mode: open\n/.test(block)) continue;
        if (name === 'post-merge-ci.yml') {
          // A superseded development deploy is cancelled on purpose, so only release-please.
          expect(block, job).toContain("needs.release-please.result == 'cancelled'");
          expect(block, job).not.toContain(
            "needs.deploy-development.result == 'cancelled'",
          );
          continue;
        }
        expect(block, `${name} → ${job}`).toContain(
          "contains(needs.*.result, 'cancelled')",
        );
      }
    },
  );

  // The shared action adds a fix plan to the issue (the failed steps, their log tail, the owning
  // page and the skill that fixes it); reading the run's jobs and logs needs `actions: read`.
  it.each(alerted)(
    '%s lets the issue-opening job read the run, for the fix plan',
    (name) => {
      for (const [job, block] of jobBlocks(text(name))) {
        if (!/mode: open\n/.test(block)) continue;
        expect(block, `${name} → ${job}`).toMatch(/^ {6}actions: read\b/m);
      }
    },
  );

  it('no workflow keeps its own ci-failure issue code', () => {
    const inline = files.filter((name) =>
      /labels: \['ci-failure'\]|--label ci-failure/.test(text(name)),
    );
    expect(inline).toEqual([]);
  });

  it('CodeQL alerts on its scheduled runs only, never on a PR', () => {
    for (const [job, block] of jobBlocks(text('codeql.yml'))) {
      if (block.includes(USES)) {
        expect(block, job).toContain("github.event_name != 'pull_request'");
      }
    }
  });
});

describe('ci-failure issue action', () => {
  it('leaves the issue about main alone on a run from another ref', () => {
    // A green workflow_dispatch on a branch closed main's issue while main was still red (20 Oct
    // 2026); a red one would open an issue about main.
    const directory = mkdtempSync(join(tmpdir(), 'ci-failure-issue-'));
    const state = join(directory, 'open-issue');
    const log = join(directory, 'gh.log');
    // A stand-in `gh`: logs each call; `issue list` prints the open issue number, if any.
    writeFileSync(
      join(directory, 'gh'),
      [
        '#!/usr/bin/env bash',
        'echo "$*" >> "$GH_LOG"',
        'case "$1 $2" in',
        '  "issue list") [ -f "$GH_STATE" ] && cat "$GH_STATE"; exit 0 ;;',
        '  "issue create") echo 7 > "$GH_STATE" ;;',
        '  "issue close") rm -f "$GH_STATE" ;;',
        'esac',
        '',
      ].join('\n'),
    );
    chmodSync(join(directory, 'gh'), 0o755);
    const run = (mode: string, extra: Record<string, string> = {}) => {
      // The stand-in gh, then the base system directories only.
      const result = spawnSync('/bin/bash', [SCRIPT], {
        encoding: 'utf8',
        env: {
          PATH: `${directory}:/usr/bin:/bin`,
          GH_LOG: log,
          GH_STATE: state,
          GH_REPOSITORY: 'owner/repository',
          MODE: mode,
          TITLE: 'E2E against the backend image failing',
          BODY: 'What failed.',
          CLOSE_COMMENT: 'Green again.',
          WORKFLOW_URL: 'https://github.com/owner/repository/actions/runs/42',
          ...extra,
        },
      });
      return { status: result.status, output: `${result.stdout}${result.stderr}` };
    };
    const ghLog = () => readFileSync(log, 'utf8');
    try {
      expect(run('open').status).toBe(0);
      const branch = run('close', { REF: 'refs/heads/fix/a-branch' });
      expect(branch.status).toBe(0);
      expect(branch.output).toContain('refs/heads/fix/a-branch is not main');
      expect(run('open', { REF: 'refs/pull/7/merge' }).status).toBe(0);
      expect(ghLog().match(/^issue (?:close|comment) /gm)).toBeNull();

      expect(run('close', { REF: 'refs/heads/main' }).output).toContain(
        'Closed ci-failure issue #7.',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
