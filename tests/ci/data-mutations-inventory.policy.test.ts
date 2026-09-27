import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Regression guard for #198 — docs↔code drift in the mutation inventory.
//
// docs/reference/data-mutations.md carries a "current inventory" table naming
// every write hook and its optimistic/non-optimistic classification. That table
// drifted: it listed `useCreateInvitation`, `useRevokeInvitation`, and
// `useResendInvitation`, none of which exist — clinozy-be models an invite as an
// `invited` membership, so the real hooks are `useInviteMember` (create) and
// `useRemoveMember` (revoke), and there is no resend hook. The weekly advisory
// `docs:staleness` canary caught it after the fact.
//
// This locks that specific doc so the same class can't silently reappear on a
// PR: every `use<X>` hook the inventory names must resolve to a real `src/`
// export. We run the actual staleness scanner (the source of truth) and scope
// the assertion to this one file — unrelated advisory drift elsewhere stays the
// weekly canary's job and must never make this deterministic test flaky.
const SCANNER = join(process.cwd(), 'tooling/ci/check-doc-staleness.mjs');
const DOC = 'docs/reference/data-mutations.md';

type Finding = { file: string; line: number; kind: string; token: string };

function scannerFindings(): Finding[] {
  // --json prints the full findings array to stdout and exits 1 when ANY doc
  // has a finding — capture stdout in both the clean (exit 0) and dirty (exit 1)
  // cases so drift in an unrelated doc can't throw here.
  try {
    // process.execPath is the absolute path to the running Node binary — never a
    // bare PATH-resolved name (sonarjs/no-os-command-from-path).
    const out = execFileSync(process.execPath, [SCANNER, '--json'], { encoding: 'utf8' });
    return JSON.parse(out) as Finding[];
  } catch (err) {
    const stdout = (err as { stdout?: string | Buffer }).stdout;
    if (stdout != null) return JSON.parse(stdout.toString()) as Finding[];
    throw err;
  }
}

describe('data-mutations inventory ↔ code', () => {
  it('every hook named in data-mutations.md resolves to a real src/ export', () => {
    const stale = scannerFindings().filter((f) => f.file === DOC);
    // On failure, surface which symbols drifted rather than a bare length diff.
    expect(stale, `dead references in ${DOC}: ${JSON.stringify(stale)}`).toEqual([]);
  });
});
