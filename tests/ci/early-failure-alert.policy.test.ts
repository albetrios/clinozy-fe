import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  ALERT_CONTEXT,
  alertStatus,
  findFailedLane,
  lanesFinished,
  type RunJob,
} from '../../tooling/ci/early-failure-alert.mjs';

// The early failure alert posts a red commit status the moment any PR CI lane fails, while every
// lane still finishes and `Quality gate` decides the merge. clinozy-be runs the same script
// (src/tests/unit/ci/early-failure-alert.unit.test.ts).

const prCi = readFileSync('.github/workflows/pr-ci.yml', 'utf8');
const prePush = readFileSync('.husky/pre-push', 'utf8');

const job = (name: string, status: string, conclusion: string | null = null): RunJob => ({
  name,
  status,
  conclusion,
  html_url: `https://github.com/example/actions/jobs/${encodeURIComponent(name)}`,
});

describe('PR CI early failure alert', () => {
  it('finds the first failed or timed-out lane and ignores the watcher and the gate', () => {
    const jobs = [
      job('Biome', 'completed', 'success'),
      job(ALERT_CONTEXT, 'in_progress'),
      job('Quality gate', 'completed', 'failure'),
      job('Knip (dead code)', 'completed', 'failure'),
      job('unit-tests / Unit shard 2/4', 'completed', 'timed_out'),
    ];
    expect(findFailedLane(jobs)?.name).toBe('Knip (dead code)');
    expect(findFailedLane([job('Biome', 'completed', 'cancelled')])).toBeNull();
  });

  it('stops watching once every lane has finished, whatever the watcher itself is doing', () => {
    expect(
      lanesFinished([
        job('Biome', 'completed', 'success'),
        job(ALERT_CONTEXT, 'in_progress'),
      ]),
    ).toBe(true);
    expect(
      lanesFinished([
        job('Biome', 'completed', 'success'),
        job('Build verify', 'in_progress'),
      ]),
    ).toBe(false);
  });

  it('posts a failing status that names the lane and links to it', () => {
    const lane = job('unit-tests / Unit shard 2/4', 'completed', 'failure');
    expect(alertStatus(lane)).toEqual({
      state: 'failure',
      context: ALERT_CONTEXT,
      description: 'unit-tests / Unit shard 2/4 failed; the other lanes keep running',
      target_url: lane.html_url,
    });
  });

  it('runs as an advisory job with the permissions it needs, outside the Quality gate', () => {
    const start = prCi.indexOf('\n  early-failure-alert:');
    const block = prCi.slice(start, prCi.indexOf('\n  quality-gate:'));
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('statuses: write');
    expect(block).toContain('actions: read');
    expect(block).toContain('run: node tooling/ci/early-failure-alert.mjs');
    // No `needs:`: it starts with the run instead of after a lane.
    expect(block).not.toMatch(/^ {4}needs:/m);
    const gate = prCi.slice(prCi.indexOf('\n  quality-gate:'));
    expect(gate.slice(0, gate.indexOf('if: always()'))).not.toContain(
      'early-failure-alert',
    );
  });

  it('pre-push runs Knip and the size budget, after the build it measures', () => {
    expect(prePush).toMatch(/^pnpm knip$/m);
    expect(prePush).toMatch(/^pnpm size$/m);
    expect(prePush.indexOf('\npnpm build\n')).toBeLessThan(
      prePush.indexOf('\npnpm size\n'),
    );
  });
});
