import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Two supply-chain invariants across every GitHub Actions workflow:
//
//  1. Third-party actions are pinned to a full 40-hex commit SHA — a moving
//     tag (`@v4`) or branch is a silent supply-chain hole (the tag can be
//     re-pointed at malicious code after review). Local `./` refs (this repo's
//     own composite actions and reusable workflows) are exempt — they travel
//     with the commit and cannot be re-pointed.
//  2. Every workflow forces JavaScript actions onto the Node 24 runtime via
//     `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`, so a lagging action can never drag
//     a job back onto a retired Node runtime. `.nvmrc` pins the toolchain; this
//     env pins the action runtime.
//
// actionlint validates syntax but enforces neither of these — this lane does.

const WORKFLOWS_DIR = join(process.cwd(), '.github/workflows');
const NODE24_ENV_KEY = 'FORCE_JAVASCRIPT_ACTIONS_TO_NODE24';
const SHA_PIN = /@[0-9a-f]{40}$/;

interface WorkflowFile {
  file: string;
  content: string;
}

function loadWorkflows(): WorkflowFile[] {
  return readdirSync(WORKFLOWS_DIR)
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .map((file) => ({
      file,
      content: readFileSync(join(WORKFLOWS_DIR, file), 'utf8'),
    }));
}

/**
 * Extract every `uses:` ref, dropping trailing `# comment` and surrounding
 * quotes. Comment lines are skipped so prose mentioning `uses:` cannot leak in.
 */
function usesRefs(workflow: WorkflowFile): string[] {
  const refs: string[] = [];
  for (const rawLine of workflow.content.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('#')) continue;
    const body = line.startsWith('- ') ? line.slice(2).trim() : line;
    if (!body.startsWith('uses:')) continue;
    let ref = body.slice('uses:'.length).trim();
    const comment = ref.indexOf('#'); // strip trailing inline comment
    if (comment !== -1) ref = ref.slice(0, comment).trim();
    ref = ref.replace(/^['"]|['"]$/g, '');
    if (ref) refs.push(ref);
  }
  return refs;
}

describe('github actions hardening policy', () => {
  const workflows = loadWorkflows();

  it('finds workflows to check (parser sanity)', () => {
    expect(workflows.length).toBeGreaterThan(0);
  });

  it('every third-party action is pinned to a full 40-hex commit SHA', () => {
    const refs = workflows.flatMap((workflow) =>
      usesRefs(workflow).map((ref) => ({ file: workflow.file, ref })),
    );
    // The repo is known to use third-party actions (checkout, setup-*, …) —
    // zero non-local refs means the parser broke, not that the repo has none.
    const thirdParty = refs.filter(({ ref }) => !ref.startsWith('./'));
    expect(thirdParty.length).toBeGreaterThan(0);

    const unpinned = thirdParty.filter(({ ref }) => !SHA_PIN.test(ref));
    expect(
      unpinned,
      `Unpinned action ref(s) — pin to a 40-hex SHA (keep the # vX comment):\n${unpinned
        .map(({ file, ref }) => `  ${file}: ${ref}`)
        .join('\n')}`,
    ).toEqual([]);
  });

  it(`every workflow declares the ${NODE24_ENV_KEY} env`, () => {
    const missing = workflows
      .filter((workflow) => !workflow.content.includes(NODE24_ENV_KEY))
      .map((workflow) => workflow.file);
    expect(
      missing,
      `Workflow(s) missing the ${NODE24_ENV_KEY} env — add it under a top-level env: block:\n${missing
        .map((file) => `  ${file}`)
        .join('\n')}`,
    ).toEqual([]);
  });
});
