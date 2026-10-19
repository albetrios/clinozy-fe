import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// The before-commit guard runs lint-staged first (it rewrites files), then every read-only step
// in parallel, printing each step's output in step order; when the parallel runner itself breaks
// it runs the steps one by one. These run the guard's runner with stub steps.

const guard = readFileSync('tooling/validate/before-commit-guard.sh', 'utf8');
const runner = guard.slice(
  guard.indexOf('step_label() {'),
  guard.indexOf('echo ""\necho "3. $(step_label 3)..."'),
);
const READ_ONLY = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function run(options: { failing?: number; script: string; tmpdir?: string }) {
  const stubs = READ_ONLY.map((step) =>
    step === options.failing
      ? `step_${step}() { sleep 0.4; echo "output ${step}"; return 1; }`
      : `step_${step}() { sleep 0.4; echo "output ${step}"; }`,
  ).join('\n');
  const started = Date.now();
  const result = spawnSync('/bin/sh', ['-c', `${stubs}\n${runner}\n${options.script}`], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', TMPDIR: options.tmpdir ?? '/tmp' },
  });
  return { ...result, seconds: (Date.now() - started) / 1000 };
}

describe('before-commit guard runner', () => {
  it('keeps the step list, with lint-staged first and the rest read-only', () => {
    expect(guard).toContain('READ_ONLY_STEPS="1 2 4 5 6 7 8 9 10 11 12"');
    expect(guard.indexOf('step_3\n\nstatus=0')).toBeGreaterThan(-1);
    for (const step of [...READ_ONLY, 3]) expect(guard).toContain(`step_${step}() {`);
  });

  it('runs the read-only steps at once and prints them in step order', () => {
    const result = run({ script: 'run_parallel; echo "status $?"' });
    expect(result.stdout).toContain('status 0');
    const headings = [...result.stdout.matchAll(/^(\d+)\. /gm)].map((match) =>
      Number(match[1]),
    );
    expect(headings).toEqual(READ_ONLY);
    expect(result.stdout).toMatch(/4\. Env\/mode sniffing gate\.\.\.\noutput 4\n/);
    // Eleven steps of 0.4 s each take 4.4 s one by one.
    expect(result.seconds).toBeLessThan(2.5);
  });

  it('fails when a step fails, after printing every step', () => {
    const result = run({ failing: 5, script: 'run_parallel; echo "status $?"' });
    expect(result.stdout).toContain('status 1');
    expect(result.stdout).toContain('output 12');
  });

  it('reports a broken runner, so the guard runs the steps one by one', () => {
    const broken = run({
      script: 'run_parallel; echo "status $?"',
      tmpdir: '/nonexistent/dir',
    });
    expect(broken.stdout).toContain('status 2');
    const serial = run({ failing: 4, script: 'run_serial; echo "status $?"' });
    expect(serial.stdout).toContain('output 4');
    expect(serial.stdout).not.toContain('output 5');
    expect(serial.stdout).toContain('status 1');
  });
});
