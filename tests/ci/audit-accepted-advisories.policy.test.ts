import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ACCEPTED_COMMENT_LABELS,
  type AcceptedAdvisory,
  type BulkAdvisory,
  judgeAudit,
  type NewestRelease,
  readAcceptedAdvisories,
} from '../../tooling/ci/bulk-audit.mjs';

/**
 * Accepted advisories — `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml`.
 *
 * The rule (shared with clinozy-be): an advisory with a published fix is fixed — an
 * `overrides` entry or a bump. Only an advisory with NO fixed version may be accepted,
 * and only with a comment naming its package, path, why there is no fix, and when to
 * remove it. `pnpm audit` honours the list, and `tooling/ci/bulk-audit.mjs` (the gate
 * behind `pnpm deps:audit`) reads the same list: it reports each accepted advisory
 * without failing, and fails the moment the package's newest release is outside the
 * vulnerable range, so an acceptance expires with its reason.
 *
 * The verdict is pure, so these checks feed it fixture advisory data — no network.
 */

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

const BRACES_GHSA = 'GHSA-vfj7-8cjw-p6xm';

const BRACES: BulkAdvisory = {
  id: 1240992,
  title:
    'braces vulnerable to stack-exhaustion denial of service through deeply nested patterns',
  severity: 'high',
  url: `https://github.com/advisories/${BRACES_GHSA}`,
  vulnerable_versions: '<=3.0.3',
};

const LODASH: BulkAdvisory = {
  id: 1,
  title: 'Prototype pollution',
  severity: 'high',
  url: 'https://github.com/advisories/GHSA-p6mc-m468-83gw',
  vulnerable_versions: '<4.17.21',
};

const workspaceWith = (list: string): string =>
  `engineStrict: true\n\nauditConfig:\n  ignoreGhsas:\n${list}\noverrides:\n  esbuild: '>=0.28.1'\n`;

const DOCUMENTED_BRACES = [
  '    # Package: braces <=3.0.3 (high) — stack-exhaustion DoS.',
  '    # Path: micromatch@4 ← markdownlint-cli2.',
  '    # No fix: 3.0.3 is the newest release.',
  '    # Remove when: braces publishes a release above 3.0.3.',
  `    - ${BRACES_GHSA}`,
].join('\n');

const acceptedBraces = (): AcceptedAdvisory[] => {
  const { entries, problems } = readAcceptedAdvisories(workspaceWith(DOCUMENTED_BRACES));
  expect(problems).toEqual([]);
  return entries;
};

const audited = new Map([
  ['braces', new Set(['3.0.3'])],
  ['lodash', new Set(['4.17.20'])],
]);

const newestBraces = (version: string, stillVulnerable: boolean) =>
  new Map<string, NewestRelease>([
    ['braces', { version, ghsas: new Set(stillVulnerable ? [BRACES_GHSA] : []) }],
  ]);

describe('accepted advisories (auditConfig.ignoreGhsas)', () => {
  it('passes an accepted advisory with no fix published, and still reports it', () => {
    const verdict = judgeAudit({
      advisories: { braces: [BRACES] },
      audited,
      level: 'high',
      accepted: acceptedBraces(),
      newest: newestBraces('3.0.3', true),
      prodOnly: false,
    });
    expect(verdict.failing).toEqual([]);
    expect(verdict.acceptanceProblems).toEqual([]);
    expect(verdict.accepted).toHaveLength(1);
    expect(verdict.accepted[0]).toContain(
      'accepted (no fix published; newest braces is 3.0.3)',
    );
    expect(verdict.accepted[0]).toContain(BRACES_GHSA);
  });

  it('fails an accepted advisory once its newest release is outside the vulnerable range', () => {
    const verdict = judgeAudit({
      advisories: { braces: [BRACES] },
      audited,
      level: 'high',
      accepted: acceptedBraces(),
      newest: newestBraces('3.0.4', false),
      prodOnly: false,
    });
    expect(verdict.accepted).toEqual([]);
    expect(verdict.acceptanceProblems).toEqual([
      `${BRACES_GHSA} now has a fix (3.0.4) — remove it from auditConfig.ignoreGhsas and override/bump instead.`,
    ]);
  });

  it('fails an accepted advisory whose data names patched versions', () => {
    const verdict = judgeAudit({
      advisories: { braces: [{ ...BRACES, patched_versions: '>=3.0.4' }] },
      audited,
      level: 'high',
      accepted: acceptedBraces(),
      newest: newestBraces('3.0.3', true),
      prodOnly: false,
    });
    expect(verdict.acceptanceProblems).toEqual([
      expect.stringContaining(`${BRACES_GHSA} now has a fix (>=3.0.4)`),
    ]);
  });

  it('still fails every advisory at or above the threshold that is not accepted', () => {
    const verdict = judgeAudit({
      advisories: { braces: [BRACES], lodash: [LODASH] },
      audited,
      level: 'high',
      accepted: acceptedBraces(),
      newest: newestBraces('3.0.3', true),
      prodOnly: false,
    });
    expect(verdict.failing).toEqual([
      expect.stringContaining('HIGH     lodash (locked: 4.17.20'),
    ]);
    expect(verdict.accepted).toHaveLength(1);

    const belowThreshold = judgeAudit({
      advisories: { lodash: [LODASH] },
      audited,
      level: 'critical',
      accepted: [],
      newest: new Map(),
      prodOnly: false,
    });
    expect(belowThreshold.failing).toEqual([]);
    expect(belowThreshold.belowThreshold).toHaveLength(1);
  });

  it('fails an entry no locked package reports any more — on the full tree only', () => {
    const run = (prodOnly: boolean) =>
      judgeAudit({
        advisories: {},
        audited,
        level: 'high',
        accepted: acceptedBraces(),
        newest: new Map(),
        prodOnly,
      }).acceptanceProblems;
    expect(run(false)).toEqual([expect.stringContaining('no locked package reports it')]);
    expect(run(true)).toEqual([]);
  });

  it('fails an entry whose Package: names another package than the advisory', () => {
    const { entries } = readAcceptedAdvisories(
      workspaceWith(DOCUMENTED_BRACES.replace('Package: braces', 'Package: micromatch')),
    );
    const verdict = judgeAudit({
      advisories: { braces: [BRACES] },
      audited,
      level: 'high',
      accepted: entries,
      newest: newestBraces('3.0.3', true),
      prodOnly: false,
    });
    expect(verdict.acceptanceProblems).toEqual([
      expect.stringContaining('its comment names Package: micromatch'),
    ]);
  });
});

describe('the ignoreGhsas policy (every run checks it before auditing)', () => {
  it('requires a comment with every label above each entry', () => {
    expect(
      readAcceptedAdvisories(workspaceWith(`    - ${BRACES_GHSA}`)).problems,
    ).toEqual([expect.stringContaining(`${BRACES_GHSA} has no comment above it`)]);
    for (const label of ACCEPTED_COMMENT_LABELS) {
      const withoutLabel = DOCUMENTED_BRACES.split('\n')
        .filter((line) => !line.includes(`# ${label}`))
        .join('\n');
      expect(readAcceptedAdvisories(workspaceWith(withoutLabel)).problems, label).toEqual(
        [expect.stringContaining(`is missing ${label}`)],
      );
    }
  });

  it('detaches a comment separated from its entry by a blank line', () => {
    const detached = DOCUMENTED_BRACES.replace(
      `    - ${BRACES_GHSA}`,
      `\n    - ${BRACES_GHSA}`,
    );
    expect(readAcceptedAdvisories(workspaceWith(detached)).problems).toEqual([
      expect.stringContaining('has no comment above it'),
    ]);
  });

  it('rejects a malformed GHSA id, a duplicate, and a flow-style list', () => {
    for (const id of [
      'GHSA-vfj7-8cjw',
      'CVE-2024-4068',
      'ghsa-vfj7-8cjw-p6xm',
      'GHSA-vfj7-8cjw-p6x0',
    ]) {
      const malformed = DOCUMENTED_BRACES.replace(`- ${BRACES_GHSA}`, `- ${id}`);
      expect(readAcceptedAdvisories(workspaceWith(malformed)).problems, id).toEqual([
        expect.stringContaining(`"${id}" is not a GHSA id`),
      ]);
    }
    expect(
      readAcceptedAdvisories(workspaceWith(`${DOCUMENTED_BRACES}\n${DOCUMENTED_BRACES}`))
        .problems,
    ).toEqual([expect.stringContaining(`${BRACES_GHSA} is listed twice`)]);
    expect(
      readAcceptedAdvisories(`auditConfig:\n  ignoreGhsas: [${BRACES_GHSA}]\n`).problems,
    ).toEqual([expect.stringContaining('must be a block list')]);
  });

  it('reads no entries when there is no auditConfig', () => {
    expect(readAcceptedAdvisories('engineStrict: true\n')).toEqual({
      entries: [],
      problems: [],
    });
  });
});

describe('this repo', () => {
  const { entries, problems } = readAcceptedAdvisories(read('pnpm-workspace.yaml'));

  it('keeps pnpm-workspace.yaml within the policy', () => {
    expect(problems).toEqual([]);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('documents exactly the accepted advisories in the accepted-risk table', () => {
    const doc = read('docs/reference/dependency-upgrades.md');
    const section = doc.slice(
      doc.indexOf('### Accepted risk'),
      doc.indexOf('\n## ', doc.indexOf('### Accepted risk')),
    );
    // Table rows only: the prose under the table names advisories that left the tree.
    const rows = section
      .split('\n')
      .filter((line) => line.startsWith('|'))
      .join('\n');
    const documented = [...new Set(rows.match(/GHSA(?:-[a-z0-9]{4}){3}/g) ?? [])];
    expect(documented.sort()).toEqual(entries.map((entry) => entry.ghsa).sort());
  });

  it('keeps the audit threshold at high, and the scheduled full-tree audit blocking', () => {
    const scripts = (
      JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    ).scripts;
    expect(scripts['deps:audit']).toBe('node tooling/ci/bulk-audit.mjs --level high');
    expect(scripts['deps:audit:prod']).toBe(
      'node tooling/ci/bulk-audit.mjs --prod --level high',
    );
    const scheduled = read('.github/workflows/scheduled-deps-audit.yml');
    expect(scheduled).toContain('run: pnpm deps:audit\n');
    expect(scheduled).toContain('run: pnpm deps:audit:prod');
    expect(scheduled).not.toContain('continue-on-error');
  });
});
