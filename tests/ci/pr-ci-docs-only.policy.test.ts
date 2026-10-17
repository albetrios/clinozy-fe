import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// "Docs only" means every changed file is Markdown or under docs/. A file no filter lists — a root
// config such as knip.jsonc — next to a README used to count as docs-only and skip Knip and Build.
// The filters are read from pr-ci.yml and matched the way dorny/paths-filter matches them
// (picomatch with dot: true; the `every` step requires all of a filter's patterns).

const prCi = readFileSync('.github/workflows/pr-ci.yml', 'utf8');

/** The `filters: |` block of the paths-filter step with this id, as filter name → patterns. */
function filtersOf(stepId: string): Map<string, string[]> {
  const step = prCi.slice(prCi.indexOf(`id: ${stepId}\n`));
  const lines = step.slice(step.indexOf('filters: |') + 'filters: |'.length).split('\n');
  const filters = new Map<string, string[]>();
  let current: string[] | undefined;
  for (const line of lines.slice(1)) {
    const name = /^ {12}([a-z0-9-]+):$/.exec(line)?.[1];
    const pattern = /^ {14}- '(.+)'$/.exec(line)?.[1];
    if (name) {
      current = [];
      filters.set(name, current);
    } else if (pattern && current) current.push(pattern);
    else if (line.trim() !== '') break;
  }
  return filters;
}

/** A picomatch-style glob (dot: true) for the shapes pr-ci.yml uses: *, **, ** /, and !negation. */
function matches(pattern: string, file: string): boolean {
  if (pattern.startsWith('!')) return !matches(pattern.slice(1), file);
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const rest = pattern.slice(index);
    if (rest.startsWith('**/')) {
      source += '(?:.*/)?';
      index += 2;
    } else if (rest.startsWith('/**') && index + 3 === pattern.length) {
      source += '(?:/.*)?';
      index += 2;
    } else if (rest.startsWith('**')) {
      source += '.*';
      index += 1;
    } else if (rest.startsWith('*')) {
      source += '[^/]*';
    } else {
      source += (rest[0] ?? '').replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`).test(file);
}

const some = filtersOf('filter');
const every = filtersOf('every');

function changed(files: string[]) {
  const anySome = (name: string) =>
    files.some((file) =>
      (some.get(name) ?? []).some((pattern) => matches(pattern, file)),
    );
  // A filter the workflow does not define matches nothing (`[].every()` would match everything).
  const anyEvery = (name: string) => {
    const patterns = every.get(name) ?? [];
    return (
      patterns.length > 0 &&
      files.some((file) => patterns.every((pattern) => matches(pattern, file)))
    );
  };
  const docsOnly =
    anySome('docs-only-md') &&
    !anyEvery('non-docs') &&
    !anySome('src-code') &&
    !anySome('e2e') &&
    !anySome('ci-config') &&
    !anySome('agent-os');
  return {
    docsOnly,
    knip: !docsOnly,
    build:
      !docsOnly &&
      (anySome('src-code') || anySome('ci-config') || anyEvery('root-config')),
  };
}

describe('pr-ci.yml docs-only filter', () => {
  it('reads both filter steps from the workflow', () => {
    expect(some.get('docs-only-md')).toEqual(['**/*.md', 'docs/**']);
    expect(every.get('non-docs')).toEqual(['**', '!**/*.md', '!docs/**']);
    expect(every.get('root-config')).toEqual(['*', '!*.md']);
    expect(prCi).toContain("predicate-quantifier: 'every'");
    expect(prCi).toContain("needs.changes.outputs.root-config == 'true'");
    expect(prCi).toContain("steps.every.outputs.non-docs == 'false'");
  });

  it('a knip.jsonc + README PR runs Knip and Build', () => {
    expect(changed(['knip.jsonc', 'README.md'])).toEqual({
      docsOnly: false,
      knip: true,
      build: true,
    });
    expect(changed(['.size-limit.json', 'CHANGELOG.md']).build).toBe(true);
  });

  it('a Markdown-only PR still skips them', () => {
    expect(
      changed(['README.md', 'docs/reference/design.md', 'docs/assets/flow.svg']),
    ).toEqual({
      docsOnly: true,
      knip: false,
      build: false,
    });
  });

  it('source changes run both, as before', () => {
    expect(changed(['src/app/App.tsx', 'README.md'])).toEqual({
      docsOnly: false,
      knip: true,
      build: true,
    });
  });
});
