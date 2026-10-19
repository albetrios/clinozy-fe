import { describe, expect, it } from 'vitest';

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
  it('classifies by allowlist membership; unmanaged otherwise', () => {
    expect(classifyManagedKey('NETLIFY_AUTH_TOKEN', sets)).toBe('secret');
    expect(classifyManagedKey('VITE_DEBUG_LOGGING', sets)).toBe('variable');
    expect(classifyManagedKey('SONAR_TOKEN', sets)).toBe('unmanaged');
  });

  it('secret wins when a key is in both lists (never leak a secret as a variable)', () => {
    const both = { secretKeys: new Set(['X']), variableKeys: new Set(['X']) };
    expect(classifyManagedKey('X', both)).toBe('secret');
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

  it('buckets secrets, variables, blanks, and schema-defaults; drops unmanaged', () => {
    const { secrets, variables, blank, schemaDefault } = splitManagedEntries(declared, {
      secretKeys,
      variableKeys,
      schemaDefaults,
    });
    expect(secrets.map((e) => e.name)).toStrictEqual(['NETLIFY_AUTH_TOKEN']);
    expect(variables.map((e) => e.name)).toStrictEqual(['VITE_VERSION_CHECK']);
    expect(blank.map((e) => e.name)).toStrictEqual(['VITE_API_BASE_URL']);
    expect(schemaDefault.map((e) => e.name)).toStrictEqual(['VITE_DEBUG_LOGGING']);
  });

  it('keepSchemaDefaults routes a default-valued variable back to pushable', () => {
    const { variables, schemaDefault } = splitManagedEntries(declared, {
      secretKeys,
      variableKeys,
      schemaDefaults,
      keepSchemaDefaults: true,
    });
    expect(schemaDefault.length).toBe(0);
    expect(variables.some((e) => e.name === 'VITE_DEBUG_LOGGING')).toBeTruthy();
  });

  it('a secret is never treated as schema-default even if its value matches', () => {
    const { secrets, schemaDefault } = splitManagedEntries(
      [{ name: 'NETLIFY_AUTH_TOKEN', value: 'false' }],
      {
        secretKeys,
        variableKeys,
        schemaDefaults: new Map([['NETLIFY_AUTH_TOKEN', 'false']]),
      },
    );
    expect(secrets.map((e) => e.name)).toStrictEqual(['NETLIFY_AUTH_TOKEN']);
    expect(schemaDefault.length).toBe(0);
  });
});

describe('findStaleManaged', () => {
  const managedNames = new Set([...secretKeys, ...variableKeys]);

  it('flags a managed remote key with no local declaration; leaves unmanaged alone', () => {
    const stale = findStaleManaged({
      remoteKeys: ['VITE_DEBUG_LOGGING', 'VITE_VERSION_CHECK', 'HAND_MADE_VAR'],
      declaredNames: new Set(['VITE_VERSION_CHECK']),
      managedNames,
    });
    expect(stale).toStrictEqual(['VITE_DEBUG_LOGGING']); // HAND_MADE_VAR unmanaged → not pruned
  });
});

describe('planEnvironmentSyncPreview', () => {
  it('computes the right decision per key', () => {
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
    expect(byName.get('NETLIFY_AUTH_TOKEN')).toBe('secret');
    expect(byName.get('VITE_API_BASE_URL')).toBe('secret-create');
    expect(byName.get('VITE_DEBUG_LOGGING')).toBe('skip+prune');
    expect(byName.get('VITE_VERSION_CHECK')).toBe('update');
    expect(byName.get('VITE_CAPTCHA_DISABLED')).toBe('create');
    expect(byName.has('SONAR_TOKEN')).toBe(false); // unmanaged omitted
    expect(byName.get('VITE_DEVTOOLS')).toBe('prune-stale'); // managed remote, no local line
    expect(byName.has('STALE_VAR')).toBe(false); // unmanaged remote never pruned
  });

  it('masks secret values in both local and remote columns', () => {
    const rows = planEnvironmentSyncPreview({
      declared: [{ name: 'NETLIFY_AUTH_TOKEN', value: 'super-secret' }],
      remoteVariables: new Map(),
      remoteSecretNames: new Set(['NETLIFY_AUTH_TOKEN']),
      secretKeys,
      variableKeys,
    });
    const row = rows.find((r) => r.name === 'NETLIFY_AUTH_TOKEN');
    expect(row).toBeTruthy();
    expect(row.local.includes('super-secret')).toBe(false);
    expect(row.remote.includes('super-secret')).toBe(false);
  });
});

describe('formatSyncPreviewTable', () => {
  it('renders headers, rows, and a per-decision summary', () => {
    const rows = planEnvironmentSyncPreview({
      declared: [{ name: 'VITE_CAPTCHA_DISABLED', value: 'true' }],
      remoteVariables: new Map(),
      remoteSecretNames: new Set(),
      secretKeys,
      variableKeys,
    });
    const table = formatSyncPreviewTable({ rows, environment: 'production' });
    expect(table).toMatch(/github:sync production — preview/);
    expect(table).toMatch(/VARIABLE\s+KIND\s+DEFAULT\s+LOCAL\s+REMOTE\s+DECISION/);
    expect(table).toMatch(/create=1/);
  });
});
