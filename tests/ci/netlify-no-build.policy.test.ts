import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/**
 * Netlify-never-builds guard. netlify-cli runs the `netlify.toml` build command before every
 * `netlify deploy` unless `--no-build` is passed, so each deploy shipped a SECOND build made
 * inside the deploy step — on 2026-10-03 the live `buildId` was minted 20 s after the Build
 * step finished. That bundle is not the one whose env was validated, whose production bytes
 * were attested, or whose source maps went to Sentry. Every deploy therefore uploads the
 * existing `dist/` with `--no-build`, and `netlify.toml` refuses to build at all.
 */
describe('Netlify never builds', () => {
  const workflows = readdirSync(join(ROOT, '.github/workflows'))
    .filter((name) => name.endsWith('.yml'))
    .map((name) => [name, read(`.github/workflows/${name}`)] as const);
  const scripts = (
    JSON.parse(read('package.json')) as { scripts: Record<string, string> }
  ).scripts;

  /** Every `netlify deploy` command line — comments excluded. */
  const deployCommands = (source: string): string[] =>
    source
      .split('\n')
      .filter((line) => line.includes('netlify deploy') && !line.trim().startsWith('#'));

  it('every workflow deploy uploads dist/ without building', () => {
    const commands = workflows.flatMap(([name, source]) =>
      deployCommands(source).map((line) => [name, line] as const),
    );
    expect(commands.length).toBeGreaterThanOrEqual(2);
    for (const [name, line] of commands) {
      expect(line, name).toContain('--no-build');
      if (line.includes('--dir="$DEPLOY_DIR"')) {
        // Production deploys dist-verified/: dist/ unpacked from its cosign-verified tarball.
        const source = workflows.find(([file]) => file === name)?.[1] ?? '';
        const directories = [...source.matchAll(/DEPLOY_DIR="([^"]+)"/g)].map(
          (match) => match[1],
        );
        expect(directories.length, name).toBeGreaterThan(0);
        for (const directory of directories)
          expect(['dist', 'dist-verified'], name).toContain(directory);
      } else {
        expect(line, name).toContain('--dir=dist');
      }
    }
  });

  it('every package script deploy passes --no-build', () => {
    const deploys = Object.entries(scripts).filter(([, command]) =>
      command.includes('netlify deploy'),
    );
    expect(deploys.length).toBeGreaterThanOrEqual(2);
    for (const [name, command] of deploys) {
      expect(command, name).toContain('netlify deploy');
      expect(command.slice(command.indexOf('netlify deploy')), name).toContain(
        '--no-build',
      );
    }
  });

  it('netlify.toml cancels Git builds and fails any other build', () => {
    const toml = read('netlify.toml');
    const build = toml.slice(
      toml.indexOf('[build]'),
      toml.indexOf('[build.environment]'),
    );
    const lines = build.split('\n').map((line) => line.trim());
    expect(lines).toContain('ignore = "exit 0"');
    const command = lines.filter((line) => line.startsWith('command = '));
    expect(command).toHaveLength(1);
    expect(command[0]?.endsWith('exit 1"')).toBe(true);
    expect(build).not.toContain('pnpm build"');
  });
});
