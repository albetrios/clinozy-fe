#!/usr/bin/env node
/**
 * Differential ("patch") coverage gate. Plain-Node port of clinozy-be's
 * tooling/ci/check-patch-coverage.mjs, adapted to this repo's coverage scope.
 *
 * Computes the line-coverage percentage of the lines a change *added or
 * modified* — not the whole tree — and enforces a high bar on that subset.
 * This keeps new code well-tested without forcing a retro-fit of the entire
 * codebase, and it cannot regress: every PR is measured against its own diff.
 *
 * Why this exists: the global thresholds in vitest.config.ts are a RATCHET
 * pinned to measured coverage and move slowly. Patch coverage is the
 * high-leverage complement — it holds the *delta* to a stricter standard.
 *
 * Usage:
 *   pnpm test:ci   # produces coverage/coverage-final.json first
 *   node tooling/ci/check-patch-coverage.mjs \
 *     --coverage coverage/coverage-final.json \
 *     [--base <ref>] \
 *     [--threshold 90] \
 *     [--report-only]
 *
 * `--base` defaults to the upstream, else origin/<trunk> (`resolveBase`); PR CI passes the PR's base.
 *
 * A changed line is "coverable" only if the coverage map has a statement
 * starting on that line. Comments, blank lines, type-only lines, and import
 * lines with no executable statement are excluded — so the denominator is
 * executable new code.
 *
 * Measured surface (mirrors `vitest.config.ts` `coverage.include`/`exclude`):
 * every `src/**` .ts/.tsx file except tests, `__tests__/`, and .d.ts files.
 * Keeping this in lock step with the global coverage scope is what makes the
 * metric honest.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { git, resolveBase } from './git-environment.mjs';
import { isMain, parseCommandLine } from './script.mjs';

const DEFAULT_THRESHOLD = 90;

function parseArguments(argv) {
  const { values, positionals } = parseCommandLine(argv, {
    options: {
      coverage: { type: 'string' },
      base: { type: 'string' },
      threshold: { type: 'string' },
      'report-only': { type: 'boolean' },
    },
    // An empty argument (a CI step's unset optional flag) is skipped; anything else is unknown.
    maxPositionals: Number.POSITIVE_INFINITY,
    messages: { unknownOption: (option) => `Unknown flag: ${option}` },
  });
  const stray = positionals.find((positional) => positional !== '');
  if (stray !== undefined) throw new Error(`Unknown flag: ${stray}`);
  const coveragePath = values.coverage;
  const base = values.base;
  const threshold =
    values.threshold === undefined ? DEFAULT_THRESHOLD : Number(values.threshold);
  const reportOnly = values['report-only'] === true;
  if (!coveragePath) throw new Error('Missing --coverage <coverage-final.json>');
  if (!Number.isFinite(threshold)) throw new Error('--threshold must be a number');
  return { coveragePath, base, threshold, reportOnly };
}

/**
 * Returns true when a path is inside the measured coverage surface — i.e. it
 * would be instrumented by `vitest.config.ts` `coverage.include`/`exclude`.
 * Only these files contribute to patch coverage. Mirrors that config:
 *   include — src/**\/*.{ts,tsx}
 *   exclude — tests, __tests__ directories, and .d.ts files
 */
function isMeasuredPath(relativePath) {
  if (!(relativePath.endsWith('.ts') || relativePath.endsWith('.tsx'))) return false;
  if (relativePath.endsWith('.d.ts')) return false;
  // Excludes take precedence over includes.
  if (/\.(test|spec)\.(ts|tsx)$/.test(relativePath)) return false;
  if (relativePath.includes('/__tests__/')) return false;
  // Includes.
  return relativePath.startsWith('src/');
}

/**
 * Parses `git diff --unified=0` output into a map of relative file path →
 * Set of added/modified line numbers (on the new side of the diff).
 */
function parseAddedLines(diffText) {
  const fileToLines = new Map();
  let currentFile = null;
  const lines = diffText.split('\n');
  for (const line of lines) {
    if (line.startsWith('+++ ')) {
      // `+++ b/path` (or `+++ /dev/null` for deletions)
      const pathPart = line.slice(4).trim();
      currentFile = pathPart === '/dev/null' ? null : pathPart.replace(/^b\//, '');
      continue;
    }
    if (line.startsWith('@@')) {
      // `@@ -oldStart,oldCount +newStart,newCount @@`
      const match = /\+(\d+)(?:,(\d+))?/.exec(line);
      if (!(match && currentFile)) continue;
      const start = Number(match[1]);
      const count = match[2] === undefined ? 1 : Number(match[2]);
      if (count === 0) continue; // pure deletion hunk
      if (!fileToLines.has(currentFile)) fileToLines.set(currentFile, new Set());
      const set = fileToLines.get(currentFile);
      for (let lineNumber = start; lineNumber < start + count; lineNumber += 1) {
        set.add(lineNumber);
      }
    }
  }
  return fileToLines;
}

/**
 * Builds a map of line number → max statement hits for a single file's istanbul
 * coverage entry. A line is coverable when it appears here; covered when its
 * value is > 0.
 */
function buildLineHitMap(fileCoverage) {
  const lineHits = new Map();
  for (const statementId of Object.keys(fileCoverage.statementMap ?? {})) {
    const lineNumber = fileCoverage.statementMap[statementId].start.line;
    const previous = lineHits.get(lineNumber) ?? 0;
    const hits = fileCoverage.s[statementId] ?? 0;
    lineHits.set(lineNumber, Math.max(previous, hits));
  }
  return lineHits;
}

function buildCoverageIndex(coverage) {
  // Index istanbul coverage by relative `src/...` suffix for matching against
  // git paths, which are repo-relative.
  const index = new Map();
  for (const absolutePath of Object.keys(coverage)) {
    const normalized = absolutePath.replace(/\\/g, '/');
    const srcIndex = normalized.lastIndexOf('/src/');
    const relative = srcIndex >= 0 ? normalized.slice(srcIndex + 1) : normalized;
    index.set(relative, coverage[absolutePath]);
  }
  return index;
}

/**
 * Pure core: given an istanbul coverage map and a map of changed file →
 * added-line numbers, computes per-file and overall patch coverage over the
 * measured surface. No I/O — unit-testable.
 */
function computePatchCoverage(coverage, addedLines) {
  const coverageIndex = buildCoverageIndex(coverage);
  let totalCoverable = 0;
  let totalCovered = 0;
  const perFile = [];
  const uncoveredFiles = [];

  for (const [relativePath, lineSet] of addedLines) {
    if (!isMeasuredPath(relativePath)) continue;
    const fileCoverage = coverageIndex.get(relativePath);
    if (!fileCoverage) {
      // Changed in-scope source file with no coverage entry → its executable
      // new lines are entirely uncovered. Surface it explicitly.
      uncoveredFiles.push(relativePath);
      continue;
    }
    const lineHits = buildLineHitMap(fileCoverage);
    let coverable = 0;
    let covered = 0;
    for (const lineNumber of lineSet) {
      if (!lineHits.has(lineNumber)) continue; // not an executable line
      coverable += 1;
      if (lineHits.get(lineNumber) > 0) covered += 1;
    }
    if (coverable === 0) continue;
    totalCoverable += coverable;
    totalCovered += covered;
    perFile.push({ relativePath, coverable, covered, pct: (covered / coverable) * 100 });
  }

  const overallPct = totalCoverable === 0 ? 100 : (totalCovered / totalCoverable) * 100;
  return { overallPct, totalCovered, totalCoverable, perFile, uncoveredFiles };
}

function main() {
  const { coveragePath, base, threshold, reportOnly } = parseArguments(
    process.argv.slice(2),
  );

  const coverage = JSON.parse(readFileSync(resolve(process.cwd(), coveragePath), 'utf8'));
  const diffText = git([
    'diff',
    '--unified=0',
    '--no-color',
    `${resolveBase({ base })}...HEAD`,
  ]);
  const addedLines = parseAddedLines(diffText);
  const { overallPct, totalCovered, totalCoverable, perFile, uncoveredFiles } =
    computePatchCoverage(coverage, addedLines);

  console.log('Patch coverage (changed, executable lines):');
  if (perFile.length === 0 && uncoveredFiles.length === 0) {
    console.log('  No changed production source lines to measure.');
  }
  for (const entry of perFile.sort((a, b) => a.pct - b.pct)) {
    const flag = entry.pct + 1e-9 < threshold ? ' ⚠' : '';
    console.log(
      `  ${entry.pct.toFixed(2).padStart(6)}%  ${entry.covered}/${entry.coverable}  ${entry.relativePath}${flag}`,
    );
  }
  for (const filePath of uncoveredFiles) {
    console.log(`   0.00%  (no coverage data)  ${filePath} ⚠`);
  }

  console.log(
    `\nOverall patch coverage: ${overallPct.toFixed(2)}% (${totalCovered}/${totalCoverable}) — threshold ${threshold}%`,
  );

  const missed = overallPct + 1e-9 < threshold || uncoveredFiles.length > 0;
  if (missed) {
    if (reportOnly) {
      console.warn('\nPatch coverage below threshold (report-only mode — not failing).');
      return;
    }
    console.error('\nPatch coverage below threshold.');
    process.exit(1);
  }
  console.log('\nPatch coverage meets the threshold.');
}

export {
  buildLineHitMap,
  computePatchCoverage,
  isMeasuredPath,
  parseAddedLines,
  parseArguments,
};

// Run as CLI only when invoked directly (not when imported by tests).
if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`check-patch-coverage: ${error.message}`);
    process.exit(2);
  }
}
