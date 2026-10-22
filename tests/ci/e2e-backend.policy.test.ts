import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The E2E workflow against the backend's GHCR image (.github/workflows/e2e-backend.yml): a merge to
// main runs the @smoke set, the nightly run the full suite, with one retry; the backend comes from
// its latest image with Postgres, Redis and the reference seed — never the shared development
// environment — and a red run on main opens a ci-failure issue. A Dependabot pull request that
// changes a dependency runs the @smoke set too.

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

  it('runs the smoke set on a Dependabot PR that changes a dependency, and no issue for it', () => {
    // An axe-core bump (Dependabot #119) passed PR CI on 20 Oct 2026, merged, and kept main's run
    // red for 9 h: this run is red on the bump's own PR, before anyone approves it.
    expect(WORKFLOW).toMatch(
      /pull_request:\n\s+paths:\n\s+- package\.json\n\s+- pnpm-lock\.yaml\n\s+- pnpm-workspace\.yaml\n/,
    );
    expect(WORKFLOW).toContain(
      "if: github.event_name != 'pull_request' || github.event.pull_request.user.login == 'dependabot[bot]'",
    );
    // No input on a pull request, so the suite is the @smoke set.
    expect(WORKFLOW).toContain("inputs.suite || 'smoke'");
    // A pull request's red is its own: neither issue job runs for one.
    for (const job of ['close-failure-issue', 'notify-failure']) {
      const block = WORKFLOW.slice(WORKFLOW.indexOf(`  ${job}:`));
      expect(block.slice(0, block.indexOf('runs-on:')), job).toContain(
        "github.event_name != 'pull_request'",
      );
    }
  });

  it("boots the backend's latest image, never the shared development environment", () => {
    // The name clinozy-be pushes: ghcr.io/<owner>/<repository>/<image>. Without the repository
    // segment the pull fails with "manifest unknown" before the backend boots.
    expect(WORKFLOW).toContain(
      'BACKEND_IMAGE: ghcr.io/${{ github.repository_owner }}/clinozy-be/clinozy-be-api:latest',
    );
    expect(WORKFLOW).toContain('packages: read');
    // clinozy-be's one database step, compiled (create, migrate, permissions and plans).
    expect(WORKFLOW).toContain('node dist/src/scripts/ops/db-prepare.js --seed minimal');
    expect(WORKFLOW).toContain('postgres:');
    expect(WORKFLOW).toContain('redis:');
    expect(WORKFLOW).not.toMatch(/DEVELOPMENT_API_URL|VITE_API_BASE_URL/);
    // The suite signs in through the app's Playwright hooks, which only this flag installs.
    expect(WORKFLOW).toContain("VITE_E2E_HOOKS: 'true'");
    // One API and no worker: without a count the backend's connection budget assumes both,
    // which the default Postgres here cannot hold, and the API exits before it listens.
    expect(WORKFLOW).toContain('-e DEPLOYMENT_TOTAL_REPLICA_COUNT=1');
  });

  it("runs the app and the backend in the variables' organization mode", () => {
    // clinozy-be no longer sends deployment flags, so the app's mode is VITE_PERSONAL_ORGANIZATIONS
    // / VITE_TEAM_ORGANIZATIONS alone. Before this the job set neither: the app and the backend
    // each ran their default, and the team-only specs never ran. It reads development's
    // variables (as preview.yml does) and boots the backend in the same mode.
    expect(WORKFLOW).toMatch(/^ {4}environment: development$/m);
    for (const key of ['VITE_PERSONAL_ORGANIZATIONS', 'VITE_TEAM_ORGANIZATIONS']) {
      expect(WORKFLOW).toMatch(new RegExp(`${key}: \\$\\{\\{ vars\\.${key} \\}\\}`));
    }
    expect(WORKFLOW).toContain('-e "PERSONAL_ORGANIZATION_ENABLED=$personal"');
    expect(WORKFLOW).toContain('-e "TEAM_ORGANIZATION_ENABLED=$team"');
    // An unset variable never reaches the backend as an empty flag, which it reads as false:
    // each flag is added only when the variable is set.
    expect(WORKFLOW).not.toMatch(/-e (PERSONAL|TEAM)_ORGANIZATION_ENABLED(\s|$)/m);
    expect(WORKFLOW).toContain('if [ -n "$personal" ]; then');
    expect(WORKFLOW).toContain('if [ -n "$team" ]; then');
  });

  it('tells the suite the backend has no object storage, so the photo uploads skip', () => {
    // The image boots with no S3_*: without the flag the patient-photos spec waits a minute for
    // uploads that cannot happen, then fails the nightly run.
    expect(WORKFLOW).not.toMatch(/-e S3_/);
    expect(WORKFLOW).toContain("E2E_OBJECT_STORAGE: 'false'");
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
