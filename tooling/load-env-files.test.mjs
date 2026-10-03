import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { applyDotenvFile } from './load-env-files.mjs';

const PREFIX = 'CLINOZY_PROBE_';

/** Runs `body` with a temp `.env.local`, clearing the probe keys afterwards. */
function withEnvFile(body) {
  const directory = mkdtempSync(join(tmpdir(), 'fe-load-env-files-'));
  const file = join(directory, '.env.local');
  writeFileSync(file, `${PREFIX}BLANK=\n${PREFIX}FROM_FILE=file\n`);
  try {
    body(file);
  } finally {
    for (const key of Object.keys(process.env).filter((name) =>
      name.startsWith(PREFIX),
    )) {
      delete process.env[key];
    }
    rmSync(directory, { recursive: true, force: true });
  }
}

test('a value the shell set survives a blank placeholder (cloud Variables)', () => {
  withEnvFile((file) => {
    process.env[`${PREFIX}BLANK`] = 'from-the-cloud-environment';
    applyDotenvFile(file);
    assert.equal(process.env[`${PREFIX}BLANK`], 'from-the-cloud-environment');
  });
});

test('a blank placeholder with nothing behind it is unset', () => {
  withEnvFile((file) => {
    applyDotenvFile(file);
    assert.equal(`${PREFIX}BLANK` in process.env, false);
    assert.equal(process.env[`${PREFIX}FROM_FILE`], 'file');
  });
});

test('with override, a blank file line still unsets the key', () => {
  withEnvFile((file) => {
    process.env[`${PREFIX}BLANK`] = 'shell';
    applyDotenvFile(file, true);
    assert.equal(`${PREFIX}BLANK` in process.env, false);
  });
});
