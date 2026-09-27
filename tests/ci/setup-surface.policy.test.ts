import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Locks the setup surface after the local-provisioning tooling was removed:
// clinozy-fe is provisioned externally and consumes the resulting
// `.env.<environment>` values, mirroring clinozy-be. `pnpm setup:local` (local dev
// bootstrap) and `pnpm setup:mac-tools` (macOS external-tool installer) stay; the
// Netlify/GitHub provisioning orchestrator under `tooling/setup/live/` and its
// tracked `config.setup.env` input are gone.
//
// Guards two regressions:
//  1. a `setup:*` provisioning entry point creeping back into package.json;
//  2. docs or runtime output pointing at a command that no longer exists —
//     the failure mode clinozy-be hit in #951, where `env-add.ts` printed a
//     "Next steps" list naming two commands that had never/no longer existed.

const packageJson = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
) as { scripts: Record<string, string> };
const scripts = packageJson.scripts;

/** Provisioning entry points removed with `tooling/setup/live/`. */
const REMOVED_SCRIPTS = [
  'setup',
  'setup:check',
  'setup:revert:all',
  'setup:infra:netlify',
  'setup:infra:github-secrets',
];

/** Paths that must stay deleted — the provisioner and its config input. */
const REMOVED_PATHS = [
  'config.setup.env',
  'tooling/setup/live',
  'tooling/setup/netlify.sh',
  'tooling/setup/github-secrets.sh',
];

describe('setup surface policy (no local provisioner)', () => {
  it('has no resurrected provisioning scripts', () => {
    const resurrected = REMOVED_SCRIPTS.filter((name) => name in scripts);
    expect(resurrected).toEqual([]);
  });

  it('exposes no setup:infra:* namespace', () => {
    expect(Object.keys(scripts).filter((name) => name.startsWith('setup:infra'))).toEqual(
      [],
    );
  });

  it('keeps setup:local + setup:mac-tools as the only setup entry points', () => {
    expect(
      Object.keys(scripts)
        .filter((name) => name.startsWith('setup'))
        .sort(),
    ).toEqual(['setup:local', 'setup:mac-tools']);
    expect(scripts['setup:local']).toBe('tsx tooling/dev/setup-local.ts');
    expect(scripts['setup:mac-tools']).toBe('bash tooling/dev/setup-mac-tools.sh');
  });

  it('keeps the provisioner and its config input deleted', () => {
    const present = REMOVED_PATHS.filter((path) => existsSync(join(process.cwd(), path)));
    expect(present).toEqual([]);
  });
});
