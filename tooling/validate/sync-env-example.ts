/**
 * Sync `.env.example` with the env schema — both KEYS and per-key DESCRIPTIONS.
 *
 * `envFieldDescriptions` in src/core/config/env-schema.ts is the single source of
 * truth. This tool enforces that, for every schema key, `.env.example` (a) has the
 * key and (b) carries that exact description as the `# comment` on the line
 * directly above `KEY=`. So the wording a developer reads in the schema is the
 * wording they see in their scaffolded `.env.<environment>` (setup:local copies
 * `.env.example` verbatim). `--fix` rewrites the comment lines from the schema.
 *
 * Usage:
 *   pnpm tool:sync-env-example
 *   pnpm tool:sync-env-example --fix
 */
import '../load-env-files.mjs';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { envFieldDescriptions, envSchemaKeys } from '../../src/core/config/env-schema.ts';

const projectRoot = resolve(import.meta.dirname, '../..');
const envExamplePath = resolve(projectRoot, '.env.example');

/** Matches a key's assignment line, whether live (`KEY=`) or commented (`# KEY=`). */
const keyLine = (key: string) => new RegExp(`^#?\\s*${key}\\s*=`);

/** A `# comment` that is NOT a structural banner/section header. */
function isManagedComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith('#') && !t.startsWith('# ---') && !t.startsWith('# ###');
}

function parseDocumentedKeys(lines: readonly string[]): Set<string> {
  const keys = new Set<string>();
  const re = /^(?:#\s*)?([A-Z][A-Z0-9_]*)\s*=/;
  for (const line of lines) {
    const m = line.trim().match(re);
    if (m?.[1]) keys.add(m[1]);
  }
  return keys;
}

function findKeyIndex(lines: readonly string[], key: string): number {
  return lines.findIndex((line) => keyLine(key).test(line.trim()));
}

/** Append missing keys with their description (used only under --fix). */
function appendMissing(lines: readonly string[], missing: readonly string[]): string[] {
  const appendix = missing.flatMap((key) => [
    '',
    `# ${envFieldDescriptions[key] ?? ''}`,
    `${key}=`,
  ]);
  return [...lines, ...appendix];
}

/**
 * Reconcile each key's description comment against the schema. Under --fix the
 * `lines` array is mutated in place; otherwise the drift is collected and
 * returned for reporting.
 */
function reconcileDescriptions(lines: string[], fix: boolean): string[] {
  const mismatches: string[] = [];
  for (const key of envSchemaKeys) {
    const desc = envFieldDescriptions[key];
    if (!desc) continue; // reported via `undescribed`
    const idx = findKeyIndex(lines, key);
    if (idx === -1) continue; // reported via `missing`
    const expected = `# ${desc}`;
    const above = idx > 0 ? (lines[idx - 1] ?? '') : '';
    if (above.trim() === expected) continue;
    if (!fix) {
      mismatches.push(
        `  ${key}: comment above is ${JSON.stringify(above.trim())}, expected ${JSON.stringify(expected)}`,
      );
    } else if (isManagedComment(above)) {
      lines[idx - 1] = expected;
    } else {
      lines.splice(idx, 0, expected);
    }
  }
  return mismatches;
}

function reportAndExit(
  undescribed: readonly string[],
  missing: readonly string[],
  mismatches: readonly string[],
): void {
  const errors: string[] = [];
  if (undescribed.length > 0)
    errors.push(`Keys with no envFieldDescriptions entry: ${undescribed.join(', ')}`);
  if (missing.length > 0)
    errors.push(`Keys missing from .env.example: ${missing.join(', ')}`);
  if (mismatches.length > 0)
    errors.push(`Description drift (schema vs .env.example):\n${mismatches.join('\n')}`);

  if (errors.length > 0) {
    console.error(`[sync-env-example]\n${errors.join('\n')}`);
    console.error('\nRun `pnpm tool:sync-env-example:fix` to sync.');
    process.exit(1);
  }
  console.info('[sync-env-example] .env.example documents all keys + descriptions.');
}

function main(): void {
  const fix = process.argv.includes('--fix');
  if (!existsSync(envExamplePath)) {
    console.error('[sync-env-example] .env.example not found');
    process.exit(1);
  }

  let lines = readFileSync(envExamplePath, 'utf-8').split('\n');
  const undescribed = envSchemaKeys.filter((key) => !envFieldDescriptions[key]);
  const missing = envSchemaKeys.filter((key) => !parseDocumentedKeys(lines).has(key));
  if (fix && missing.length > 0) lines = appendMissing(lines, missing);

  const mismatches = reconcileDescriptions(lines, fix);

  if (fix) {
    writeFileSync(envExamplePath, lines.join('\n'), 'utf-8');
    console.info('[sync-env-example] .env.example synced to schema keys + descriptions.');
    return;
  }
  reportAndExit(undescribed, missing, mismatches);
}

main();
