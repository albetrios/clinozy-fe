import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Every scheduled check, and post-merge CI, opens (or comments on) one `ci-failure` issue per
// check when it fails and closes it on the next green run, through clinozy-be's shared
// `.github/actions/ci-failure-issue` action — so an open issue means the check is red right now.
// clinozy-be pins the action itself in src/tests/unit/ci/ci-failure-issue.policy.unit.test.ts.

const WORKFLOWS = '.github/workflows';
const ACTION =
  /uses: [\w.-]+\/clinozy-be\/\.github\/actions\/ci-failure-issue@[0-9a-f]{40}\b/;

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

/** The top-level jobs of a workflow, as `[name, block]`. */
function jobBlocks(source: string): Array<[string, string]> {
  const parts = source
    .slice(source.indexOf('\njobs:\n'))
    .split(/^ {2}([a-z][a-z-]*):\n/m);
  const blocks: Array<[string, string]> = [];
  for (let index = 1; index + 1 < parts.length; index += 2) {
    blocks.push([parts[index] ?? '', parts[index + 1] ?? '']);
  }
  return blocks;
}

describe('ci-failure alert on every scheduled check', () => {
  it('covers the seven scheduled checks and post-merge CI', () => {
    expect(alerted.sort()).toEqual(
      [
        'codeql.yml',
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
      if (!block.includes('/.github/actions/ci-failure-issue@')) continue;
      expect(block, `${name} → ${job}`).toMatch(ACTION);
      expect(block, `${name} → ${job}`).toContain('issues: write');
    }
  });

  it('no workflow keeps its own ci-failure issue code', () => {
    const inline = files.filter((name) =>
      /labels: \['ci-failure'\]|--label ci-failure/.test(text(name)),
    );
    expect(inline).toEqual([]);
  });

  it('CodeQL alerts on its scheduled runs only, never on a PR', () => {
    for (const [job, block] of jobBlocks(text('codeql.yml'))) {
      if (block.includes('/.github/actions/ci-failure-issue@')) {
        expect(block, job).toContain("github.event_name != 'pull_request'");
      }
    }
  });
});
