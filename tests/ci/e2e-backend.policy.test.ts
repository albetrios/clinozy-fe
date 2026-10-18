import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The E2E workflow against the backend's GHCR image (.github/workflows/e2e-backend.yml): a merge to
// main runs the @smoke set, the nightly run the full suite, with one retry; the backend comes from
// its latest image with Postgres, Redis and the reference seed — never the shared development
// environment — and a red run opens a ci-failure issue.

const WORKFLOW = readFileSync(join('.github', 'workflows', 'e2e-backend.yml'), 'utf8');
const SPECS = join('tests', 'e2e');

/** The `@smoke`-tagged tests: `test('<title>', { tag: '@smoke' }, …)`, per spec file. */
function smokeTests(): string[] {
  return readdirSync(SPECS)
    .filter((name) => name.endsWith('.e2e.test.ts'))
    .flatMap((name) =>
      [
        ...readFileSync(join(SPECS, name), 'utf8').matchAll(
          /test\(\s*'([^']+)',\s*\{ tag: '@smoke' \}/g,
        ),
      ].map((match) => `${name} › ${match[1]}`),
    );
}

describe('E2E against the backend image', () => {
  it('runs the smoke set on main and the full suite nightly, with one retry', () => {
    expect(WORKFLOW).toMatch(/push:\n\s+branches: \[main\]/);
    expect(WORKFLOW).toMatch(/schedule:\n\s+- cron: '30 1 \* \* \*'/);
    expect(WORKFLOW).toContain("github.event_name == 'schedule' && 'full'");
    expect(WORKFLOW).toContain('pnpm exec playwright test --grep @smoke --retries=1');
    expect(WORKFLOW).toContain('pnpm exec playwright test --retries=1');
  });

  it("boots the backend's latest image, never the shared development environment", () => {
    expect(WORKFLOW).toMatch(/BACKEND_IMAGE: ghcr\.io\/.+-api:latest/);
    expect(WORKFLOW).toContain('packages: read');
    expect(WORKFLOW).toContain(
      'node dist/src/infrastructure/database/migration/migrate.js',
    );
    expect(WORKFLOW).toContain('node dist/src/scripts/seed/minimal.js');
    expect(WORKFLOW).toContain('postgres:');
    expect(WORKFLOW).toContain('redis:');
    expect(WORKFLOW).not.toMatch(/DEVELOPMENT_API_URL|VITE_API_BASE_URL/);
    // The suite signs in through the app's Playwright hooks, which only this flag installs.
    expect(WORKFLOW).toContain("VITE_E2E_HOOKS: 'true'");
  });

  it('tags the smoke set: sign-in, Today, one create, one edit and axe on five pages', () => {
    const tagged = smokeTests();
    expect(tagged).toHaveLength(9);
    expect(
      tagged.filter((test) => test.startsWith('accessibility.e2e.test.ts')),
    ).toHaveLength(5);
    for (const spec of ['auth', 'home', 'app-writes', 'account-settings']) {
      expect(
        tagged.some((test) => test.startsWith(`${spec}.e2e.test.ts`)),
        spec,
      ).toBe(true);
    }
  });

  it('opens a ci-failure issue when red, and lets it read the run', () => {
    expect(WORKFLOW).toMatch(
      /mode: open\n\s+title: E2E against the backend image failing/,
    );
    expect(WORKFLOW).toMatch(
      /mode: close\n\s+title: E2E against the backend image failing/,
    );
    expect(WORKFLOW).toContain("contains(needs.*.result, 'cancelled')");
    expect(WORKFLOW).toMatch(/^ {6}actions: read\b/m);
  });
});
