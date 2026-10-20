#!/usr/bin/env tsx
/**
 * agent-os skills-lock regenerator — recomputes the sha256 of every vendored
 * ecosystem skill's SKILL.md and rewrites agent-os/skills-lock.json. Lets the
 * lock be rebuilt with `pnpm agent-os:lock` after a vendored skill is updated in
 * place, instead of regeneration being available only through the external
 * skills CLI. {@link skillFileHash} is the one hash: the verifier in
 * agent-os/evals/check.ts (`pnpm agent-os:check`) imports it, so `pnpm agent-os:lock`
 * followed by `pnpm agent-os:check` is always consistent.
 *
 * Usage:
 *   tsx tooling/agent-os/lock.ts            # rewrite skills-lock.json with fresh hashes
 *   tsx tooling/agent-os/lock.ts --check    # verify only; exit 1 if any hash drifts
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { isMain, parseCommandLine } from '../ci/script.mjs';

interface SkillEntry {
  source?: string;
  sourceType?: string;
  skillPath: string;
  computedHash: string;
}
interface SkillsLock {
  version: number;
  skills: Record<string, SkillEntry>;
}

/** The hash `agent-os/skills-lock.json` records for a vendored skill file: its sha256, hex. */
export function skillFileHash(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function main(): void {
  const repositoryRoot = process.cwd();
  const lockFile = join(repositoryRoot, 'agent-os', 'skills-lock.json');
  const checkMode =
    parseCommandLine(process.argv.slice(2), { options: { check: { type: 'boolean' } } })
      .values.check === true;
  const lock = JSON.parse(readFileSync(lockFile, 'utf8')) as SkillsLock;

  const drifted: string[] = [];
  const missing: string[] = [];
  for (const [name, entry] of Object.entries(lock.skills)) {
    const absolute = join(repositoryRoot, entry.skillPath);
    if (!existsSync(absolute)) {
      missing.push(`${name} → ${entry.skillPath}`);
      continue;
    }
    const actual = skillFileHash(absolute);
    if (actual !== entry.computedHash) {
      drifted.push(name);
      entry.computedHash = actual;
    }
  }

  if (missing.length > 0) {
    console.error(`✖ skills-lock references missing file(s):\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }

  if (checkMode) {
    if (drifted.length > 0) {
      console.error(
        `✖ skills-lock.json is stale for: ${drifted.join(', ')}. Run: pnpm agent-os:lock`,
      );
      process.exit(1);
    }
    console.info('agent-os/skills-lock.json is up to date.');
  } else if (drifted.length > 0) {
    writeFileSync(lockFile, `${JSON.stringify(lock, null, 2)}\n`);
    console.info(`Rewrote agent-os/skills-lock.json (rehashed: ${drifted.join(', ')}).`);
  } else {
    console.info('agent-os/skills-lock.json already up to date — no changes.');
  }
}

if (isMain(import.meta.url)) main();
