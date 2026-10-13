import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * One copy of Radix in the lockfile.
 *
 * `radix-ui` (every shadcn primitive), `vaul` (the phone sheets, `ConfirmDialog` among
 * them) and `cmdk` (the pickers and the command menu) all build on the same Radix dialog
 * stack: `@radix-ui/react-dialog` → `react-dismissable-layer`, `react-focus-scope`,
 * `react-focus-guards`, `react-portal`, `react-presence`, and the scroll-lock and
 * `aria-hidden` helpers under them. Those modules keep **module-level** state — the
 * stack of open layers, the `<body>` `pointer-events` value saved when a modal layer
 * opens, the focus-scope stack, the focus-guard count — and React contexts. Two
 * versions in the lockfile means two copies of that state, each blind to the other.
 *
 * Dependabot's npm-non-major PR #47 (radix-ui 1.6.7 → 1.8.0) moved `radix-ui` onto
 * `@radix-ui/react-dialog` 1.3.0 and `react-dismissable-layer` 1.2.0 but left `vaul`
 * on 1.1.23 / 1.1.19 and `cmdk` on 1.1.15 / 1.1.11: an incremental lockfile update
 * never re-resolves a sub-dependency whose range is still satisfied. When a Radix menu
 * opened the vaul confirm sheet at phone width, closing the sheet restored the menu's
 * saved `pointer-events: none` on `<body>` — and the page stopped taking clicks. It
 * failed 19 interaction tests in three suites (`OrganizationRolesPanel`,
 * `OrganizationMembersPanel` and its pending invitations, the `NewTaskDrawer` picker)
 * and was a real bug on phones. `pnpm dedupe` collapses every copy onto the
 * newest one each range accepts — it adds no version, only drops duplicates.
 *
 * Scope: every `@radix-ui/*` package, plus the singleton helpers the dialog stack
 * shares. A second copy of any of them is the same failure class, so the rule is
 * simply "one version each".
 */

const ROOT = process.cwd();

/** Non-Radix packages the Radix dialog stack holds module-level state in. */
const SHARED_DIALOG_HELPERS = new Set([
  'aria-hidden',
  'react-remove-scroll',
  'react-remove-scroll-bar',
  'react-style-singleton',
  'use-callback-ref',
  'use-sidecar',
]);

const isGuarded = (name: string): boolean =>
  name.startsWith('@radix-ui/') || SHARED_DIALOG_HELPERS.has(name);

/**
 * Every `name → versions` the lockfile resolves, read from the `packages:` sections.
 *
 * pnpm writes the lockfile as YAML documents (its own `packageManager` pin first, then
 * the project). Each `packages:` entry is a two-space-indented `name@version:` key —
 * quoted when it starts with `@` — with no peer suffix (that lives in `snapshots:`).
 */
function resolvedVersions(lockfile: string): Map<string, Set<string>> {
  const versions = new Map<string, Set<string>>();
  let inPackages = false;
  for (const line of lockfile.split('\n')) {
    if (/^\S/.test(line)) {
      inPackages = line.startsWith('packages:');
      continue;
    }
    if (!inPackages) continue;
    const key = /^ {2}'?((?:@[^/\s']+\/)?[^@\s']+)@([^'\s():]+)'?:\s*$/.exec(line);
    const name = key?.[1];
    const version = key?.[2];
    if (!name || !version) continue;
    const known = versions.get(name) ?? new Set<string>();
    known.add(version);
    versions.set(name, known);
  }
  return versions;
}

const byVersion = (a: string, b: string): number =>
  a.localeCompare(b, 'en', { numeric: true });

/** The guarded packages that resolve to more than one version, as `name (a, b)`. */
function duplicateCopies(lockfile: string): string[] {
  return [...resolvedVersions(lockfile)]
    .filter(([name, versions]) => isGuarded(name) && versions.size > 1)
    .map(([name, versions]) => `${name} (${[...versions].sort(byVersion).join(', ')})`)
    .sort();
}

describe('lockfile — one copy of the Radix dialog stack', () => {
  const lockfile = readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8');

  it('reads the Radix packages radix-ui, vaul and cmdk resolve', () => {
    // A parser that silently matched nothing would make the guard below pass vacuously.
    const versions = resolvedVersions(lockfile);
    for (const name of [
      'radix-ui',
      'vaul',
      'cmdk',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dismissable-layer',
      '@radix-ui/react-focus-scope',
      '@radix-ui/react-portal',
      '@radix-ui/react-presence',
    ]) {
      expect(versions.get(name)?.size ?? 0, name).toBeGreaterThan(0);
    }
  });

  it('resolves every @radix-ui package and dialog helper to a single version', () => {
    const duplicates = duplicateCopies(lockfile);
    expect(
      duplicates,
      `pnpm-lock.yaml holds more than one copy of: ${duplicates.join('; ')}. ` +
        'Each copy keeps its own layer stack and <body> pointer-events, so closing a ' +
        'vaul sheet a Radix menu opened can leave the page unclickable. ' +
        'Run `pnpm dedupe` and commit pnpm-lock.yaml with the bump. If a duplicate ' +
        'survives the dedupe, `pnpm why <package>` names the dependency pinning an ' +
        'incompatible range.',
    ).toEqual([]);
  });

  it('flags a second copy, scoped and quoted the way pnpm writes it', () => {
    const fixture = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      "  '@radix-ui/react-dialog@1.1.23':",
      '    resolution: {integrity: sha512-a}',
      '',
      "  '@radix-ui/react-dialog@1.3.0':",
      '    resolution: {integrity: sha512-b}',
      '',
      "  '@radix-ui/react-portal@1.2.0':",
      '    resolution: {integrity: sha512-c}',
      '',
      '  react-remove-scroll@2.6.0:',
      '    resolution: {integrity: sha512-d}',
      '',
      '  react-remove-scroll@2.7.2:',
      '    resolution: {integrity: sha512-e}',
      '',
      '  zod@3.25.0:',
      '    resolution: {integrity: sha512-f}',
      '',
      '  zod@4.6.6:',
      '    resolution: {integrity: sha512-g}',
      '',
      'snapshots:',
      '',
      "  '@radix-ui/react-portal@1.1.9(react@19.3.0)':",
      '    dependencies: {}',
      '',
    ].join('\n');
    expect(duplicateCopies(fixture)).toEqual([
      '@radix-ui/react-dialog (1.1.23, 1.3.0)',
      'react-remove-scroll (2.6.0, 2.7.2)',
    ]);
  });
});
