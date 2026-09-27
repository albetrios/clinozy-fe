import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Locks the GitHub IaC surface: one flag-driven `github:sync` for sync (no
// per-domain subcommands) plus discrete `github:tool:*` named tools (the
// governance-mode switch). Guards against quietly re-introducing the
// github:rulesets:* / github:environments:* / gh:rulesets:* / validate:github-env*
// scripts that were collapsed into `github:sync`.
const packageJson = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
) as { scripts: Record<string, string> };
const scripts = packageJson.scripts;

const REMOVED = [
  'github:sync:check',
  'github:sync:dry-run',
  'github:rulesets:sync',
  'github:rulesets:sync:dry-run',
  'github:rulesets:check',
  'github:environments:check',
  'gh:rulesets:sync',
  'gh:rulesets:sync:dry-run',
  'gh:rulesets:check',
  'validate:github-env',
  'validate:github-environments',
  // Legacy shell wrapper around `github:sync` that pushed secrets from the
  // tracked `config.setup.env` rather than the gitignored `.env.<environment>`.
  'setup:infra:github-secrets',
];

/** `.env.<environment>` is the ONLY source `github:sync` reads values from. */
const SYNC_TOOLING = ['sync.mjs', 'sync-env-secrets.mjs'].map((file) =>
  readFileSync(join(process.cwd(), 'tooling/setup/github', file), 'utf8'),
);

describe('GitHub IaC scripts policy (single github:sync)', () => {
  it('exposes only the sanctioned github: entry points', () => {
    const githubScripts = Object.keys(scripts)
      .filter((name) => name.startsWith('github:'))
      .sort();
    expect(githubScripts).toEqual([
      'github:sync',
      'github:tool:governance-mode',
      'github:tool:governance-mode:check',
    ]);
    expect(scripts['github:sync']).toBe('node tooling/setup/github/sync.mjs');
    expect(scripts['github:tool:governance-mode']).toBe(
      'node tooling/setup/github/governance-mode.mjs',
    );
    expect(scripts['github:tool:governance-mode:check']).toBe(
      'node tooling/setup/github/governance-mode.mjs --check',
    );
  });

  it('has no bare gh: scripts — all GitHub IaC lives under github:', () => {
    expect(Object.keys(scripts).filter((name) => name.startsWith('gh:'))).toEqual([]);
  });

  it('has removed every subcommand and legacy alias', () => {
    const resurrected = REMOVED.filter((name) => name in scripts);
    expect(resurrected).toEqual([]);
  });

  it('keeps the deploy-time secret validator as validate:deploy-env', () => {
    expect(scripts['validate:deploy-env']).toBe(
      'node tooling/setup/github/validate-github-env.mjs',
    );
  });

  // `--from-config-setup` let `github:sync` read deploy values from the tracked
  // `config.setup.env` instead of the gitignored `.env.<environment>`. That file
  // held placeholders (`VITE_API_BASE_URL_PROD=https://your-api-domain.com`), so
  // the flag could push junk to a real GitHub Environment. One source only.
  it('reads deploy values only from .env.<environment>', () => {
    for (const source of SYNC_TOOLING) {
      expect(source).not.toContain('--from-config-setup');
      expect(source).not.toContain('config.setup.env');
    }
  });
});
