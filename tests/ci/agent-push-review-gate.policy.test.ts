import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

// The push review gate (agent-os/hooks/guardrails.mjs, clinozy-be's): an agent push of auth,
// token, CSP, routeTree or guard changes asks the user first until /fe-pre-merge-review records a
// clean result for HEAD (`pnpm agent-os:review-clean`); other pushes, and pushes in another
// repository, go through.

const GUARDRAILS = join(process.cwd(), 'agent-os', 'hooks', 'guardrails.mjs');
const REVIEW_MARKER = join(process.cwd(), 'tooling', 'agent-os', 'review-marker.mjs');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** A repository whose branch commits `changedFile` on top of `origin/main`. */
function repository(changedFile: string): string {
  const root = mkdtempSync(join(tmpdir(), 'push-review-gate-'));
  temporaryDirectories.push(root);
  const git = (...args: string[]) =>
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- fixed 'git' binary, no user input
    spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '--quiet', '--initial-branch', 'main');
  git('config', 'user.email', 'gate@example.com');
  git('config', 'user.name', 'gate');
  writeFileSync(join(root, 'README.md'), '# fixture\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'init');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('switch', '--quiet', '-c', 'feat/change');
  mkdirSync(dirname(join(root, changedFile)), { recursive: true });
  writeFileSync(join(root, changedFile), 'export const changed = true;\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'change');
  return root;
}

/** The guardrail's decision for `command` run in `root`: `ask`, or '' when it lets it through. */
function decision(options: { root: string; command: string }): string {
  const result = spawnSync(process.execPath, [GUARDRAILS], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: options.command },
      cwd: options.root,
    }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: options.root },
  });
  const output = result.stdout.trim();
  if (!output.startsWith('{"hookSpecificOutput"')) return '';
  return (JSON.parse(output) as { hookSpecificOutput: { permissionDecision: string } })
    .hookSpecificOutput.permissionDecision;
}

describe('guardrails.mjs push review gate', () => {
  it('asks before pushing an unreviewed auth change, not after a clean review of HEAD', () => {
    const root = repository('src/shared/auth/service.ts');
    expect(decision({ root, command: 'git push -u origin feat/change' })).toBe('ask');
    const recorded = spawnSync(process.execPath, [REVIEW_MARKER, '--note', 'clean'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(recorded.status).toBe(0);
    expect(decision({ root, command: 'git push -u origin feat/change' })).toBe('');
  });

  it('asks for tokens, CSP, routeTree and the guards too, and lets a docs-only push through', () => {
    for (const file of [
      'src/core/http/fetch-client.ts',
      'src/lib/csp-api-origin.ts',
      'netlify.toml',
      'src/app/routes/routeTree.tsx',
      'src/app/guards/requireAuth.ts',
    ])
      expect(decision({ root: repository(file), command: 'git push' }), file).toBe('ask');
    expect(
      decision({ root: repository('docs/reference/design.md'), command: 'git push' }),
    ).toBe('');
    expect(
      decision({
        root: repository('src/pages/today/TodayPage.tsx'),
        command: 'git push',
      }),
    ).toBe('');
  });

  it('judges only pushes in its own repository', () => {
    const root = repository('src/shared/auth/token.ts');
    const elsewhere = mkdtempSync(join(tmpdir(), 'push-review-elsewhere-'));
    temporaryDirectories.push(elsewhere);
    expect(decision({ root, command: `cd ${elsewhere} && git push` })).toBe('');
    expect(decision({ root, command: `git -C ${elsewhere} push` })).toBe('');
  });
});
