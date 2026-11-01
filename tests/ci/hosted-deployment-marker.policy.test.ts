import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { jobBlock } from '@/tests/utils/workflow-jobs.ts';

/**
 * The hosted-deploy marker, clinozy-be's A-4 on this repository's builds. `validate:client-env`
 * refuses every test-only switch when HOSTED_DEPLOYMENT is true (hostedDeploymentRefusals in
 * src/core/config/env-schema.ts), so the marker must reach every job that builds a hosted bundle,
 * before its client-env check, and nothing else: the e2e and Lighthouse builds on CI runners turn
 * VITE_E2E_HOOKS on, and a marker there would refuse them. clinozy-be pins its own in
 * src/tests/unit/ci/hosted-deployment-marker.policy.unit.test.ts.
 */

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/** The hosted builds: the workflow, the job, and the client-env step that must see the marker. */
const HOSTED_BUILDS = [
  { workflow: '.github/workflows/reusable-netlify-deploy.yml', job: 'run' },
  { workflow: '.github/workflows/preview.yml', job: 'build' },
] as const;

const MARKER = "      HOSTED_DEPLOYMENT: 'true'";

describe('hosted-deployment marker (policy)', () => {
  it.each(HOSTED_BUILDS)(
    '$workflow job $job sets HOSTED_DEPLOYMENT=true for its client-env check and build',
    ({ workflow, job }) => {
      const block = jobBlock(readFileSync(workflow, 'utf8'), job);
      expect(block).not.toBe('');
      const jobEnvironment = /\n {4}env:\n((?: {6}.*\n| *#.*\n)+)/.exec(block)?.[1] ?? '';
      expect(jobEnvironment.split('\n')).toContain(MARKER);
      const check = block.indexOf('pnpm validate:client-env');
      expect(check).toBeGreaterThan(-1);
      expect(check).toBeLessThan(block.indexOf('pnpm build'));
    },
  );

  it('no other workflow or composite action sets the marker', () => {
    const hosted = new Set<string>(HOSTED_BUILDS.map(({ workflow }) => workflow));
    const offenders = [...listFiles('.github/workflows'), ...listFiles('.github/actions')]
      .filter((path) => !hosted.has(path))
      .filter((path) => readFileSync(path, 'utf8').includes('HOSTED_DEPLOYMENT'));
    expect(offenders).toEqual([]);
  });

  it('no build plugin, Vite config or the test runner sets the marker', () => {
    for (const path of [
      'vite.config.ts',
      'vitest.config.ts',
      ...listFiles('plugins'),
      ...listFiles('tooling/ci'),
    ]) {
      expect(readFileSync(path, 'utf8'), path).not.toMatch(/HOSTED_DEPLOYMENT\s*[:=]/);
    }
  });

  it('.env.example documents it only commented out, so no scaffolded env file carries it', () => {
    const template = readFileSync('.env.example', 'utf8');
    expect(template).toMatch(/^# HOSTED_DEPLOYMENT=false$/m);
    expect(template).not.toMatch(/^HOSTED_DEPLOYMENT=/m);
  });

  it('no environment syncs it: it is not a deploy Secret or Variable', () => {
    const config = readFileSync('tooling/setup/setup.config.json', 'utf8');
    expect(config).not.toContain('HOSTED_DEPLOYMENT');
  });
});
