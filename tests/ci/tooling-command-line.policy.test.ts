import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

// One argument parser and one entry check for every FE tooling script: `parseCommandLine` and
// `isMain` from tooling/ci/script.mjs (node:util parseArgs underneath). Before, each script read
// `process.argv` its own way — hand-written loops, `indexOf('--flag') + 1`, `includes('--flag')`
// — and compared `import.meta.url` with `process.argv[1]` four different ways.

const ROOT = process.cwd();
const SCANNED_DIRECTORIES = ['tooling', 'agent-os/evals'];
const HELPER_FILE = 'tooling/ci/script.mjs';
const SCRIPT_TEST = 'tooling/ci/script.test.mjs';

/** `process.argv` read any way but whole, after the script: `[1]`, `.includes(`, `.indexOf(`. */
const READS_ARGV_BY_HAND = /process\.argv(?!\.slice\(2\))/;
/** An argument list scanned by hand: `argv.indexOf('--x')`, `commandLine.includes(…)`, a loop. */
const SCANS_ARGUMENTS =
  /\b(?:argv|args|commandLine|argumentsList|rawArguments)\.(?:includes|indexOf)\(|<\s*(?:argv|args|commandLine|argumentsList|rawArguments)\.length/;

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sourceFiles(path, found);
    else if (/\.(?:[cm]?[jt]s)$/.test(entry.name) && !/\.test\./.test(entry.name))
      found.push(relative(ROOT, path));
  }
  return found;
}

/** The code of a file without its comment lines (a usage line may name `--flag`s freely). */
function code(file: string): string {
  return readFileSync(join(ROOT, file), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

const scripts = SCANNED_DIRECTORIES.flatMap((directory) =>
  sourceFiles(join(ROOT, directory)),
).filter((file) => file !== HELPER_FILE);
const readingArgv = scripts.filter((file) => code(file).includes('process.argv'));

describe('tooling command lines — one parser, one entry check', () => {
  it('finds the scripts that read a command line (anti-vacuity)', () => {
    expect(readingArgv).toEqual(
      expect.arrayContaining([
        'tooling/ci/build.mjs',
        'tooling/iterations/intake-iteration.mjs',
        'tooling/setup/github/sync.mjs',
        'agent-os/evals/check.ts',
      ]),
    );
  });

  it('reads process.argv only whole, as process.argv.slice(2) handed to a parser', () => {
    expect(readingArgv.filter((file) => READS_ARGV_BY_HAND.test(code(file)))).toEqual([]);
  });

  it('scans no argument list by hand', () => {
    expect(scripts.filter((file) => SCANS_ARGUMENTS.test(code(file)))).toEqual([]);
  });

  it('parses through tooling/ci/script.mjs', () => {
    expect(
      readingArgv.filter(
        (file) => !/from '[./]+(?:\/ci|tooling\/ci)?\/script\.mjs'/.test(code(file)),
      ),
    ).toEqual([]);
  });

  it('has each of them stop on an unknown option in tooling/ci/script.test.mjs', () => {
    const scriptTest = readFileSync(join(ROOT, SCRIPT_TEST), 'utf8');
    expect(readingArgv.filter((file) => !scriptTest.includes(`'${file}'`))).toEqual([]);
  });

  it('flags the hand-written shapes it replaced', () => {
    expect(READS_ARGV_BY_HAND.test("process.argv.includes('--check')")).toBe(true);
    expect(
      READS_ARGV_BY_HAND.test('resolve(process.argv[1]) === fileURLToPath(url)'),
    ).toBe(true);
    expect(READS_ARGV_BY_HAND.test('parseCommandLine(process.argv.slice(2), {})')).toBe(
      false,
    );
    expect(SCANS_ARGUMENTS.test("const index = argv.indexOf('--base');")).toBe(true);
    expect(SCANS_ARGUMENTS.test('for (let i = 0; i < argv.length; i += 1) {')).toBe(true);
    expect(SCANS_ARGUMENTS.test("commandLine.includes('--help')")).toBe(true);
  });
});
