import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { WARN_ONLY_CHECKS } from '../../tooling/validate/warn-only.ts';

const ROOT = process.cwd();

/** Every workflow and composite action, relative to the repository root. */
const WORKFLOW_FILES = [
  ...readdirSync(join(ROOT, '.github/workflows'))
    .filter((name) => name.endsWith('.yml'))
    .map((name) => `.github/workflows/${name}`),
  ...readdirSync(join(ROOT, '.github/actions')).map(
    (name) => `.github/actions/${name}/action.yml`,
  ),
];

const CONTINUE_ON_ERROR = /^\s*continue-on-error:\s*(?!false\b)\S/;
const REPORT_ONLY_FLAG = /(?:^|[\s"'=])--report-only\b/;

/** Whether `command` ends by swallowing its own exit code (`|| echo …`, `|| true`, `|| exit 0`). */
function swallowsItsExit(command: string): boolean {
  const parts = command.split('||');
  if (parts.length < 2) return false;
  const last = (parts.at(-1) ?? '').trim();
  if (last.includes('&&') || last.includes(';')) return false;
  return last.startsWith('echo') || ['true', 'exit 0', ':'].includes(last);
}

const indentOf = (line: string) => line.length - line.trimStart().length;
const unquote = (value: string) => value.trim().replace(/^['"]/, '').replace(/['"]$/, '');

/** The `name:` of the step that holds line `index` (a step starts at `- ` under `steps:`). */
function stepName(lines: string[], index: number): string {
  const indent = indentOf(lines[index] ?? '');
  let at = index;
  while (at >= 0 && !(lines[at] ?? '').trimStart().startsWith('- ')) at -= 1;
  if (at < 0 || indentOf(lines[at] ?? '') >= indent) return '(job level)';
  const nameLine = lines
    .slice(at, index + 1)
    .map((line) => line.trimStart().replace(/^- /, ''))
    .find((line) => line.startsWith('name:'));
  return nameLine ? unquote(nameLine.slice('name:'.length)) : '(unnamed step)';
}

/** The warn-only checks the repository declares, as `workflow › step` / `script` keys. */
function declaredWarnOnlyChecks(): string[] {
  const found: string[] = [];
  for (const workflow of WORKFLOW_FILES) {
    const lines = readFileSync(join(ROOT, workflow), 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (CONTINUE_ON_ERROR.test(line))
        found.push(`${workflow} › ${stepName(lines, index)} (continue-on-error)`);
      if (REPORT_ONLY_FLAG.test(line) && !line.trimStart().startsWith('#'))
        found.push(`${workflow} › ${stepName(lines, index)} (report-only flag)`);
    });
  }
  const scripts = (
    JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    }
  ).scripts;
  for (const [name, command] of Object.entries(scripts)) {
    if (REPORT_ONLY_FLAG.test(command)) found.push(`script ${name} (report-only flag)`);
    else if (swallowsItsExit(command)) found.push(`script ${name} (report script)`);
  }
  return found.sort();
}

/**
 * Locks in one place that decides warn-only versus blocking (`tooling/validate/warn-only.ts`, as
 * in clinozy-be): every `continue-on-error` step, `--report-only` flag and exit-swallowing script
 * is listed there with its reason, and nothing listed is gone.
 */
describe('warn-only checks', () => {
  it('lists exactly the checks the workflows and scripts declare as non-blocking', () => {
    const listed = WARN_ONLY_CHECKS.map((check) =>
      'workflow' in check
        ? `${check.workflow} › ${check.step} (${check.mechanism})`
        : `script ${check.script} (${check.mechanism})`,
    ).sort();
    expect(declaredWarnOnlyChecks()).toEqual(listed);
  });

  it('gives every warn-only check its reason', () => {
    for (const check of WARN_ONLY_CHECKS) expect(check.reason.length).toBeGreaterThan(30);
  });

  it('counts a swallowed exit only at the end of a command', () => {
    expect(swallowsItsExit('pnpm audit || echo "advisory"')).toBe(true);
    expect(swallowsItsExit('rm -rf out 2>/dev/null || true && playwright test')).toBe(
      false,
    );
  });
});
