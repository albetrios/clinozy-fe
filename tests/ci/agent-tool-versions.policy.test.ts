import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// One pin for every tool version: tooling/setup/agent/tool-versions.sh. The cloud installer and CI
// read it, so a bump is one line and CI runs the new version before it lands. clinozy-be pins the
// same file in src/tests/unit/tooling/agent-tool-versions.policy.unit.test.ts.

const PIN_FILE = 'tooling/setup/agent/tool-versions.sh';
const pins = readFileSync(PIN_FILE, 'utf8');
const workflow = readFileSync('.github/workflows/pr-ci.yml', 'utf8');
const installer = readFileSync('tooling/setup/agent/install-gitleaks.sh', 'utf8');

/** The pinned value of `key` in the pin file. */
function pin(key: string): string {
  return new RegExp(`^${key}=(\\S+)$`, 'm').exec(pins)?.[1] ?? '';
}

describe('tool versions', () => {
  it('holds only plain KEY=value lines, so bash and $GITHUB_ENV read it unchanged', () => {
    const lines = pins
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('#'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toMatch(/^[A-Z][A-Z0-9_]*=[^\s"'$]+$/);
  });

  it('pins gitleaks with a checksum for each Linux architecture', () => {
    expect(pin('GITLEAKS_VERSION')).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pin('GITLEAKS_SHA256_LINUX_X64')).toMatch(/^[0-9a-f]{64}$/);
    expect(pin('GITLEAKS_SHA256_LINUX_ARM64')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('installs gitleaks from the pin, checksum-verified, never the latest release', () => {
    expect(installer).toContain('pinned_version GITLEAKS_VERSION');
    expect(installer).toContain('download_verified');
    expect(installer).not.toContain('github_latest_tag');
  });

  it('runs CI on the pinned versions, with no version written in the workflow', () => {
    expect(workflow).toContain(PIN_FILE);
    expect(workflow).toContain('key: gitleaks-${{ env.GITLEAKS_VERSION }}-');
    expect(workflow).toContain('bash tooling/setup/agent/install-gitleaks.sh');
    expect(workflow).not.toMatch(/GITLEAKS_VERSION:\s*\d/);
    const semgrepImage = /image: semgrep\/semgrep:([^@\s]+)@sha256:[0-9a-f]{64}/.exec(
      workflow,
    );
    expect(semgrepImage?.[1]).toBe(pin('SEMGREP_VERSION'));
  });
});
