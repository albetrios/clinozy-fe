import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  classifyManagedKey,
  findStaleManaged,
  formatSyncPreviewTable,
  planEnvironmentSyncPreview,
  splitManagedEntries,
} from './env-sync-plan.mjs';

const secretKeys = new Set(['NETLIFY_AUTH_TOKEN', 'VITE_API_BASE_URL']);
const variableKeys = new Set([
  'VITE_DEBUG_LOGGING',
  'VITE_VERSION_CHECK',
  'VITE_CAPTCHA_DISABLED',
]);
const schemaDefaults = new Map([
  ['VITE_DEBUG_LOGGING', 'false'],
  ['VITE_VERSION_CHECK', 'true'],
]);
const sets = { secretKeys, variableKeys };

describe('classifyManagedKey', () => {
  test('classifies by allowlist membership; unmanaged otherwise', () => {
    assert.equal(classifyManagedKey('NETLIFY_AUTH_TOKEN', sets), 'secret');
    assert.equal(classifyManagedKey('VITE_DEBUG_LOGGING', sets), 'variable');
    assert.equal(classifyManagedKey('SONAR_TOKEN', sets), 'unmanaged');
  });

  test('secret wins when a key is in both lists (never leak a secret as a variable)', () => {
    const both = { secretKeys: new Set(['X']), variableKeys: new Set(['X']) };
    assert.equal(classifyManagedKey('X', both), 'secret');
  });
});

describe('splitManagedEntries', () => {
  const declared = [
    { name: 'NETLIFY_AUTH_TOKEN', value: 'tok' },
    { name: 'VITE_API_BASE_URL', value: '' }, // blank secret → preserved
    { name: 'VITE_DEBUG_LOGGING', value: 'false' }, // equals default → schemaDefault
    { name: 'VITE_VERSION_CHECK', value: 'false' }, // override → pushable variable
    { name: 'SONAR_TOKEN', value: 'x' }, // unmanaged → dropped
  ];

  test('buckets secrets, variables, blanks, and schema-defaults; drops unmanaged', () => {
    const { secrets, variables, blank, schemaDefault } = splitManagedEntries(declared, {
      secretKeys,
      variableKeys,
      schemaDefaults,
    });
    assert.deepEqual(
      secrets.map((e) => e.name),
      ['NETLIFY_AUTH_TOKEN'],
    );
    assert.deepEqual(
      variables.map((e) => e.name),
      ['VITE_VERSION_CHECK'],
    );
    assert.deepEqual(
      blank.map((e) => e.name),
      ['VITE_API_BASE_URL'],
    );
    assert.deepEqual(
      schemaDefault.map((e) => e.name),
      ['VITE_DEBUG_LOGGING'],
    );
  });

  test('keepSchemaDefaults routes a default-valued variable back to pushable', () => {
    const { variables, schemaDefault } = splitManagedEntries(declared, {
      secretKeys,
      variableKeys,
      schemaDefaults,
      keepSchemaDefaults: true,
    });
    assert.equal(schemaDefault.length, 0);
    assert.ok(variables.some((e) => e.name === 'VITE_DEBUG_LOGGING'));
  });

  test('a secret is never treated as schema-default even if its value matches', () => {
    const { secrets, schemaDefault } = splitManagedEntries(
      [{ name: 'NETLIFY_AUTH_TOKEN', value: 'false' }],
      {
        secretKeys,
        variableKeys,
        schemaDefaults: new Map([['NETLIFY_AUTH_TOKEN', 'false']]),
      },
    );
    assert.deepEqual(
      secrets.map((e) => e.name),
      ['NETLIFY_AUTH_TOKEN'],
    );
    assert.equal(schemaDefault.length, 0);
  });
});

describe('findStaleManaged', () => {
  const managedNames = new Set([...secretKeys, ...variableKeys]);

  test('flags a managed remote key with no local declaration; leaves unmanaged alone', () => {
    const stale = findStaleManaged({
      remoteKeys: ['VITE_DEBUG_LOGGING', 'VITE_VERSION_CHECK', 'HAND_MADE_VAR'],
      declaredNames: new Set(['VITE_VERSION_CHECK']),
      managedNames,
    });
    assert.deepEqual(stale, ['VITE_DEBUG_LOGGING']); // HAND_MADE_VAR unmanaged → not pruned
  });
});

describe('planEnvironmentSyncPreview', () => {
  test('computes the right decision per key', () => {
    const rows = planEnvironmentSyncPreview({
      declared: [
        { name: 'NETLIFY_AUTH_TOKEN', value: 'tok' }, // secret, on remote → secret
        { name: 'VITE_API_BASE_URL', value: 'https://api' }, // secret, not on remote → secret-create
        { name: 'VITE_DEBUG_LOGGING', value: 'false' }, // == default, on remote → skip+prune
        { name: 'VITE_VERSION_CHECK', value: 'false' }, // override, remote differs → update
        { name: 'VITE_CAPTCHA_DISABLED', value: 'true' }, // variable, not on remote → create
        { name: 'SONAR_TOKEN', value: 'x' }, // unmanaged → omitted
      ],
      remoteVariables: new Map([
        ['VITE_DEBUG_LOGGING', 'false'],
        ['VITE_VERSION_CHECK', 'true'],
        ['STALE_VAR', 'gone'], // managed? no → not pruned
        ['VITE_DEVTOOLS', 'true'], // managed variable, no local line → prune-stale
      ]),
      remoteSecretNames: new Set(['NETLIFY_AUTH_TOKEN']),
      secretKeys,
      variableKeys: new Set([...variableKeys, 'VITE_DEVTOOLS']),
      schemaDefaults,
    });
    const byName = new Map(rows.map((r) => [r.name, r.decision]));
    assert.equal(byName.get('NETLIFY_AUTH_TOKEN'), 'secret');
    assert.equal(byName.get('VITE_API_BASE_URL'), 'secret-create');
    assert.equal(byName.get('VITE_DEBUG_LOGGING'), 'skip+prune');
    assert.equal(byName.get('VITE_VERSION_CHECK'), 'update');
    assert.equal(byName.get('VITE_CAPTCHA_DISABLED'), 'create');
    assert.equal(byName.has('SONAR_TOKEN'), false); // unmanaged omitted
    assert.equal(byName.get('VITE_DEVTOOLS'), 'prune-stale'); // managed remote, no local line
    assert.equal(byName.has('STALE_VAR'), false); // unmanaged remote never pruned
  });

  test('masks secret values in both local and remote columns', () => {
    const rows = planEnvironmentSyncPreview({
      declared: [{ name: 'NETLIFY_AUTH_TOKEN', value: 'super-secret' }],
      remoteVariables: new Map(),
      remoteSecretNames: new Set(['NETLIFY_AUTH_TOKEN']),
      secretKeys,
      variableKeys,
    });
    const row = rows.find((r) => r.name === 'NETLIFY_AUTH_TOKEN');
    assert.ok(row);
    assert.equal(row.local.includes('super-secret'), false);
    assert.equal(row.remote.includes('super-secret'), false);
  });
});

describe('formatSyncPreviewTable', () => {
  test('renders headers, rows, and a per-decision summary', () => {
    const rows = planEnvironmentSyncPreview({
      declared: [{ name: 'VITE_CAPTCHA_DISABLED', value: 'true' }],
      remoteVariables: new Map(),
      remoteSecretNames: new Set(),
      secretKeys,
      variableKeys,
    });
    const table = formatSyncPreviewTable({ rows, environment: 'production' });
    assert.match(table, /github:sync production — preview/);
    assert.match(table, /VARIABLE\s+KIND\s+DEFAULT\s+LOCAL\s+REMOTE\s+DECISION/);
    assert.match(table, /create=1/);
  });
});
