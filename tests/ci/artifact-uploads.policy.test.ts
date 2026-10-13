import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// actions/upload-artifact skips hidden files and folders unless
// `include-hidden-files: true` is set — and a path that names a dot-folder is
// nothing BUT hidden files, so the step finds "no files", warns and uploads
// nothing. That is how `lighthouse.yml` ran for weeks with no `lighthouse-results`
// artifact: `.lighthouseci/` held every report and none of them left the runner.
// actionlint cannot see it (the step is valid YAML); this lane does.

const WORKFLOWS_DIR = join(process.cwd(), '.github/workflows');

interface UploadStep {
  file: string;
  paths: string[];
  includeHiddenFiles: boolean;
}

/**
 * Every `actions/upload-artifact` step: the paths it uploads and whether it sets
 * `include-hidden-files: true`. A step ends at the next list item at its own
 * indentation or shallower.
 */
function uploadSteps(): UploadStep[] {
  const steps: UploadStep[] = [];
  for (const file of readdirSync(WORKFLOWS_DIR)) {
    if (!(file.endsWith('.yml') || file.endsWith('.yaml'))) continue;
    const lines = readFileSync(join(WORKFLOWS_DIR, file), 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (!/^\s*(?:- )?uses:\s*actions\/upload-artifact@/.test(line)) return;
      const stepIndent = line.search(/\S/);
      const body: string[] = [];
      for (const next of lines.slice(index + 1)) {
        const indent = next.search(/\S/);
        if (indent !== -1 && indent <= stepIndent && next.trimStart().startsWith('- '))
          break;
        if (indent !== -1 && indent < stepIndent) break;
        body.push(next);
      }
      const pathAt = body.findIndex((entry) => /^\s*path:/.test(entry));
      const pathValue =
        pathAt === -1 ? '' : (body[pathAt]?.split('path:')[1] ?? '').trim();
      // A block scalar (`path: |`) lists one path per following line.
      const paths =
        pathValue === '|' || pathValue === '>'
          ? body
              .slice(pathAt + 1)
              .filter((entry) => !/^\s*[\w-]+:/.test(entry))
              .map((entry) => entry.trim())
              .filter(Boolean)
          : [pathValue];
      steps.push({
        file,
        paths,
        includeHiddenFiles: body.some((entry) =>
          /^\s*include-hidden-files:\s*true\b/.test(entry),
        ),
      });
    });
  }
  return steps;
}

/** A path whose first segment, or any later one, is a dot-folder or dot-file. */
const namesHiddenEntry = (path: string) =>
  path
    .split('/')
    .some((segment) => segment.startsWith('.') && segment !== '.' && segment !== '..');

describe('artifact uploads policy', () => {
  const steps = uploadSteps();

  it('finds upload-artifact steps to check (parser sanity)', () => {
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.find((step) => step.file === 'lighthouse.yml')?.paths).toEqual([
      '.lighthouseci/',
    ]);
  });

  it('every upload of a hidden path sets include-hidden-files: true', () => {
    const silent = steps.filter(
      (step) => step.paths.some(namesHiddenEntry) && !step.includeHiddenFiles,
    );
    expect(
      silent,
      `upload-artifact step(s) that would upload nothing — add include-hidden-files: true:\n${silent
        .map((step) => `  ${step.file}: ${step.paths.join(', ')}`)
        .join('\n')}`,
    ).toEqual([]);
  });
});
