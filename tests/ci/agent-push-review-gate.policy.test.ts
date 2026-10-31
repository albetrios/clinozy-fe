import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { gitEnvironmentWithoutInheritedRepository } from '../../tooling/ci/git-environment.mjs';
import {
  createThrowawayRepository,
  removeThrowawayRepositories,
} from '../../tooling/ci/throwaway-repository.mjs';

// The push review gate (agent-os/hooks/fe-guardrails.mjs, clinozy-be's): an agent push of auth,
// token, CSP, routeTree or guard changes warns until /fe-pre-merge-review records a clean result
// for HEAD (`pnpm agent-os:review-clean`), and never asks the user; other pushes, and pushes in
// another repository, go through silently.

const GUARDRAILS = join(process.cwd(), 'agent-os', 'hooks', 'fe-guardrails.mjs');
const REVIEW_MARKER = join(process.cwd(), 'tooling', 'agent-os', 'review-marker.mjs');
const temporaryDirectories: string[] = [];

afterEach(() => {
  removeThrowawayRepositories();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** A repository whose branch commits `changedFile` on top of `origin/main`. */
function repository(changedFile: string): string {
  const repository = createThrowawayRepository({
    prefix: 'push-review-gate-',
    branch: 'main',
    files: { 'README.md': '# fixture\n' },
  });
  repository.git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  repository.git(['switch', '--quiet', '-c', 'feat/change']);
  repository.writeFiles({ [changedFile]: 'export const changed = true;\n' });
  repository.commitAll({ message: 'change' });
  return repository.root;
}

/** The guardrail's answer for `command` run in `root`: a decision, `warn`, or '' when silent. */
function decision(options: { root: string; command: string }): string {
  const result = spawnSync(process.execPath, [GUARDRAILS], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: options.command },
      cwd: options.root,
    }),
    encoding: 'utf8',
    env: {
      ...gitEnvironmentWithoutInheritedRepository(),
      CLAUDE_PROJECT_DIR: options.root,
    },
  });
  const output = result.stdout.trim();
  if (!output.startsWith('{')) return '';
  const parsed = JSON.parse(output) as {
    hookSpecificOutput?: { permissionDecision?: string };
    systemMessage?: string;
  };
  if (parsed.hookSpecificOutput?.permissionDecision) {
    return parsed.hookSpecificOutput.permissionDecision;
  }
  return parsed.systemMessage?.includes('push review gate') ? 'warn' : '';
}

describe('fe-guardrails.mjs push review gate', () => {
  it('warns on pushing an unreviewed auth change, not after a clean review of HEAD', () => {
    const root = repository('src/shared/auth/service.ts');
    expect(decision({ root, command: 'git push -u origin feat/change' })).toBe('warn');
    const recorded = spawnSync(process.execPath, [REVIEW_MARKER, '--note', 'clean'], {
      cwd: root,
      encoding: 'utf8',
      env: gitEnvironmentWithoutInheritedRepository(),
    });
    expect(recorded.status).toBe(0);
    expect(decision({ root, command: 'git push -u origin feat/change' })).toBe('');
  });

  it('warns for tokens, CSP, routeTree and the guards too, and lets a docs-only push through', () => {
    for (const file of [
      'src/core/http/fetch-client.ts',
      'src/lib/csp-api-origin.ts',
      'netlify.toml',
      'src/app/routes/routeTree.tsx',
      'src/app/guards/requireAuth.ts',
    ])
      expect(decision({ root: repository(file), command: 'git push' }), file).toBe(
        'warn',
      );
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
