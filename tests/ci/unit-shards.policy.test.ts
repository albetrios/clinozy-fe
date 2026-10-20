import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { jobBlock } from '@/tests/utils/workflow-jobs.ts';

// The unit suite runs in shards whose coverage is merged before the ratchet thresholds are
// checked, the shard count is a repository variable, a main-branch Vitest cache lasts, and the
// workers follow the CPU count.

const reusable = readFileSync('.github/workflows/reusable-vitest-unit-only.yml', 'utf8');
const prCi = readFileSync('.github/workflows/pr-ci.yml', 'utf8');
const nightly = readFileSync('.github/workflows/scheduled-unit-nightly.yml', 'utf8');
const vitestConfig = readFileSync('vitest.config.ts', 'utf8');
const gitignore = readFileSync('.gitignore', 'utf8');

/** One top-level job of the reusable workflow. */
const job = (name: string): string => jobBlock(reusable, name);

describe('sharded unit suite', () => {
  it('takes the shard count from VITEST_SHARDS, 4 by default, and rejects anything else', () => {
    expect(job('plan')).toContain("VITEST_SHARDS: ${{ vars.VITEST_SHARDS || '4' }}");
    expect(job('plan')).toContain('must be a whole number from 1 to 12');
    expect(job('shard')).toContain('shard: ${{ fromJSON(needs.plan.outputs.shards) }}');
  });

  it('the tooling tests run once: in the shards when they run, else in Static sync', () => {
    // The shards run `pnpm test:ci`, every project; the tooling project is one of them.
    expect(readFileSync('package.json', 'utf8')).toContain(
      '"test:ci": "vitest run --coverage"',
    );
    expect(vitestConfig).toContain("name: 'tooling'");
    const shardsRun =
      "(needs.changes.outputs.src-code == 'true' || needs.changes.outputs.ci-config == 'true')";
    expect(jobBlock(prCi, 'unit-tests')).toContain(shardsRun);
    const step =
      jobBlock(prCi, 'static-sync').split('- name: Tooling script tests')[1] ?? '';
    expect(step.split('- name:')[0]).toContain(
      "if: needs.changes.outputs.src-code != 'true' && needs.changes.outputs.ci-config != 'true'",
    );
  });

  it('each shard runs the CI script with its coverage thresholds off and writes a blob', () => {
    const shard = job('shard');
    expect(shard).toContain('pnpm test:ci --shard="${SHARD}/${TOTAL}" --reporter=blob');
    for (const metric of ['lines', 'functions', 'branches', 'statements']) {
      expect(shard).toContain(`--coverage.thresholds.${metric}=0`);
    }
    expect(shard).toContain('include-hidden-files: true');
    expect(shard).toContain('fail-fast: false');
  });

  it('the merge checks every shard arrived, then the real thresholds and patch coverage', () => {
    const merge = job('merge');
    expect(merge).toContain('name: Unit + global');
    expect(merge).toContain('-ne "${TOTAL}"');
    expect(merge).toContain('pnpm test:ci --merge-reports .vitest/blob');
    expect(merge).not.toContain('--coverage.thresholds');
    expect(merge.indexOf('--merge-reports')).toBeLessThan(
      merge.indexOf('check-patch-coverage.mjs'),
    );
  });

  it('caches the directory Vitest 5 writes, restored everywhere, saved on main only', () => {
    const shard = job('shard');
    expect(reusable).not.toContain('node_modules/.vitest\n');
    expect(shard).toContain('path: node_modules/.vite/vitest');
    expect(shard).toContain('actions/cache/restore@');
    const save = shard.slice(shard.indexOf('Save the Vitest cache'));
    expect(save).toContain("github.ref == 'refs/heads/main'");
    expect(save).toContain('actions/cache/save@');
  });

  it('a nightly main run keeps the main-branch cache fresh', () => {
    expect(nightly).toMatch(/schedule:\n\s+- cron: '0 2 \* \* \*'/);
    expect(nightly).toContain('uses: ./.github/workflows/reusable-vitest-unit-only.yml');
  });

  it('workers follow the CPU count, at most four, and blob reports stay out of git', () => {
    expect(vitestConfig).toContain('maxWorkers: Math.min(4, availableParallelism()),');
    expect(gitignore).toMatch(/^\.vitest\/$/m);
  });
});
