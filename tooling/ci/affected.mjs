#!/usr/bin/env node
/**
 * `pnpm test:affected [--base <ref>]` — behind `/fe-validate --affected` (clinozy-be's preview):
 * what `git push` will run for the commits it pushes (the steps of `.husky/pre-push`, each with why
 * it runs or not), then the tests `pnpm test:select` picks for them, with why each was picked.
 *
 * Pre-push runs that selection (`pre-push-tests.mjs`), or the whole Vitest suite when it escalates.
 * The steps mirror `.husky/pre-push` (`tests/ci/affected.policy.test.ts` keeps the two in step). It
 * changes nothing.
 */
import { resolve } from 'node:path';
import { resolveBase, tryGit } from './git-environment.mjs';
import { isMain, parseCommandLine } from './script.mjs';
import { pushSemgrepTargets } from './push-semgrep.mjs';
import { ALWAYS_RUN_REASON, selectTests } from './test-selection.mjs';

/** The files that make pre-push run the Vitest suite (its `PUSHED_UNIT_RELEVANT` pattern). */
export const UNIT_RELEVANT =
  /^(src\/|tests\/utils\/|vitest\.config\.ts$|package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$)/;

/** The files the SonarQube gate analyzes at push (its `PUSHED_RUNTIME` patterns). */
export const SONAR_RUNTIME = /^src\/.*\.(ts|tsx)$/;
export const SONAR_EXCLUDED =
  /(__tests__\/|\.test\.tsx?$|\.spec\.tsx?$|\.fixtures\.ts$|\/mock-[^/]*\.ts$|\.d\.ts$)/;

/**
 * The steps of `.husky/pre-push` for the pushed files, in its order.
 *
 * @param {readonly string[]} changedFiles
 * @returns {{ command: string, runs: boolean, why: string }[]}
 */
export function pushSteps(changedFiles) {
  const markdown = changedFiles.some((file) => file.endsWith('.md'));
  const unitRelevant = changedFiles.some((file) => UNIT_RELEVANT.test(file));
  const semgrep = pushSemgrepTargets(changedFiles);
  const runtime = changedFiles.filter(
    (file) => SONAR_RUNTIME.test(file) && !SONAR_EXCLUDED.test(file),
  );
  const always = (command, why = 'always') => ({ command, runs: true, why });
  return [
    always('branch-name policy'),
    always('pnpm biome:check'),
    always('pnpm type-check'),
    always('pnpm knip'),
    always('pnpm build --defaults', 'always — the build the size budget is measured on'),
    always('pnpm build:check'),
    always('pnpm size'),
    {
      command: 'pnpm docs:lint:changed',
      runs: markdown,
      why: markdown ? 'pushed Markdown' : 'no Markdown pushed',
    },
    {
      command: 'pnpm test:pre-push',
      runs: unitRelevant,
      why: unitRelevant
        ? 'pushed unit-relevant files — the files selected below (all of them when the selection escalates)'
        : 'nothing unit-relevant pushed',
    },
    {
      command: 'pnpm security:semgrep:push',
      runs: semgrep.length > 0,
      why:
        semgrep.length > 0
          ? `${semgrep.length} auth / HTTP client / CSP file(s)`
          : 'none of auth, the HTTP client, CSP',
    },
    always('pnpm contracts:drift', 'always (skips without the clinozy-be checkout)'),
    always(
      'pnpm api:types:check',
      'always (skips without the clinozy-be OpenAPI document)',
    ),
    {
      command: 'pnpm sonar:scan',
      runs: runtime.length > 0,
      why:
        runtime.length > 0
          ? `${runtime.length} deployed-surface file(s) under src/`
          : 'no deployed-surface code pushed',
    },
  ];
}

/**
 * The selection as Markdown: tests picked for a reason of their own, then the always-run counts.
 *
 * @param {import('./test-selection.mjs').TestSelection} selection
 * @returns {string[]}
 */
export function selectionTable(selection) {
  const lines = [`Selection: ${selection.mode} — ${selection.reasons.join('; ')}`];
  if (selection.mode !== 'selected') return lines;
  lines.push('', '| Project | Test file | Why selected |', '| --- | --- | --- |');
  const alwaysOnly = new Map();
  for (const [project, tests] of Object.entries(selection.projects))
    for (const test of tests) {
      const own = (selection.why[test] ?? []).filter(
        (reason) => !reason.startsWith(ALWAYS_RUN_REASON),
      );
      if (own.length === 0) alwaysOnly.set(project, (alwaysOnly.get(project) ?? 0) + 1);
      else lines.push(`| ${project} | \`${test}\` | ${own.join('; ')} |`);
    }
  for (const [project, count] of alwaysOnly)
    lines.push(`| ${project} | ${count} file(s) | always run (any source change) |`);
  return lines;
}

function main() {
  const repositoryRoot = resolve(import.meta.dirname, '../..');
  const { values } = parseCommandLine(process.argv.slice(2), {
    options: { base: { type: 'string' } },
  });
  const base = resolveBase({ base: values.base, cwd: repositoryRoot });
  const changed = tryGit(['diff', '--name-only', '--no-renames', `${base}...HEAD`], {
    cwd: repositoryRoot,
  });
  if (!changed.ok) {
    console.error(`Cannot diff against ${base} — pass --base <ref>.`);
    process.exitCode = 1;
    return;
  }
  const changedFiles = changed.output.split('\n').filter(Boolean);
  const lines = [
    `## What git push will run (${changedFiles.length} file(s) since ${base})`,
    '',
    '| Step | Runs | Why |',
    '| --- | --- | --- |',
    ...pushSteps(changedFiles).map(
      (step) => `| \`${step.command}\` | ${step.runs ? 'yes' : 'no'} | ${step.why} |`,
    ),
    '',
    '## The tests pnpm test:select picks',
    '',
    'Pre-push runs this selection (the whole Vitest suite when it escalates). CI runs everything.',
    '',
    ...selectionTable(selectTests({ changedFiles, repositoryRoot })),
  ];
  console.log(lines.join('\n'));
}

if (isMain(import.meta.url)) main();
