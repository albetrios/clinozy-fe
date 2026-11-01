import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// The local Docker stack (docker-compose*.yml). H-8: a published port binds the host's loopback
// only — published on every interface, the SonarQube server (admin / admin until the gate changes
// it) answered anyone on the network. H-12: every image is pinned by digest, which, unlike a tag,
// cannot be re-pointed at other bytes. clinozy-be pins its own compose files the same way.

const composeFiles = readdirSync('.').filter((file) =>
  /^(?:docker-)?compose(?:\.[\w-]+)?\.ya?ml$/.test(file),
);

/** The entries of every `ports:` list in `text`, unquoted. */
function publishedPorts(text: string): string[] {
  const ports: string[] = [];
  let listIndent = -1;
  for (const line of text.split('\n')) {
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    if (trimmed === 'ports:') {
      listIndent = indent;
      continue;
    }
    if (listIndent < 0 || trimmed === '' || trimmed.startsWith('#')) continue;
    if (indent > listIndent && trimmed.startsWith('- ')) {
      ports.push(trimmed.slice(2).replace(/^['"]|['"]$/g, ''));
      continue;
    }
    listIndent = -1;
  }
  return ports;
}

/** Every `image:` value in `text`. */
const images = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('image:'))
    .map((line) => line.slice('image:'.length).trim());

/** `text` without its comment lines. */
const withoutComments = (text: string) =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

describe('local Docker stack', () => {
  it('finds the compose files and their ports (parser sanity)', () => {
    expect(composeFiles).toContain('docker-compose.sonar.yml');
    expect(
      publishedPorts(readFileSync('docker-compose.sonar.yml', 'utf8')).length,
    ).toBeGreaterThan(0);
  });

  it.each(composeFiles)('%s publishes every port on 127.0.0.1 only', (file) => {
    for (const port of publishedPorts(readFileSync(file, 'utf8'))) {
      expect(port, `${file}: ${port}`).toMatch(/^127\.0\.0\.1:/);
    }
  });

  it.each(composeFiles)('%s pins every image by digest', (file) => {
    const found = images(readFileSync(file, 'utf8'));
    expect(found.length).toBeGreaterThan(0);
    for (const image of found) {
      expect(image, `${file}: ${image}`).toMatch(
        /^[\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}$/,
      );
    }
  });

  it('the parser reads a list item, a quoted entry and the end of the list', () => {
    expect(
      publishedPorts(
        '  db:\n    ports:\n      - \'5432:5432\'\n      - "127.0.0.1:1:1"\n    image: x\n',
      ),
    ).toEqual(['5432:5432', '127.0.0.1:1:1']);
  });

  it('containers reach the loopback-bound server on the host network, never host.docker.internal', () => {
    const sonar = withoutComments(readFileSync('docker-compose.sonar.yml', 'utf8'));
    expect(sonar).toContain('network_mode: host');
    expect(sonar).not.toContain('host.docker.internal');
    const mcpLauncher = readFileSync('tooling/dev/sonarqube-mcp.mjs', 'utf8');
    expect(mcpLauncher).toMatch(/'--network',\s*'host'/);
    expect(mcpLauncher).not.toMatch(/'\$1host\.docker\.internal'/);
  });
});
