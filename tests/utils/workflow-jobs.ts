/**
 * A GitHub Actions workflow sliced into its top-level jobs — the one slicer the `tests/ci` workflow
 * policies share. Line by line, without a backtracking regex: a job runs from its `  <name>:`
 * header to the next 2-space-indented line (the next job, or a comment above it).
 */

/** One top-level job, from its `  <name>:` header to the next job key; `''` when there is none. */
export function jobBlock(workflow: string, name: string): string {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  if (start === -1) return '';
  const lines = workflow.slice(start + 1).split('\n');
  const out: string[] = [lines[0] ?? ''];
  for (const line of lines.slice(1)) {
    if (/^ {2}\S/.test(line)) break;
    out.push(line);
  }
  return out.join('\n');
}

/** Every top-level job under `jobs:`, as `[name, block]` in file order. */
export function jobBlocks(workflow: string): Array<[string, string]> {
  const start = workflow.indexOf('\njobs:\n');
  if (start === -1) return [];
  const jobs = workflow.slice(start);
  return [...jobs.matchAll(/^ {2}([a-z][a-z0-9_-]*):$/gm)].map((match) => {
    const name = match[1] ?? '';
    return [name, jobBlock(jobs, name)];
  });
}
