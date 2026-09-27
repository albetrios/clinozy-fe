/**
 * Pure planning core for `github:sync` deploy-value reconciliation — no I/O, fully
 * unit-tested. The I/O layer (`sync-env-secrets.mjs`) reads the local
 * `.env.<environment>` file and the live GitHub Environment, then feeds those facts
 * here to decide, per key, exactly what to push, skip, or prune. The `--diff`
 * preview renders {@link planEnvironmentSyncPreview} so it can never disagree with
 * what the sync actually does.
 *
 * Adapted from clinozy-be's name-based classifier to clinozy-fe's ALLOWLIST model: a key
 * is a Secret iff it is in `deploySecrets`, a Variable iff in `deployVariables`
 * (both from `setup.config.json`, aligned to the deploy workflow's `secrets.*` /
 * `vars.*` reads). Keys in neither list are UNMANAGED and never touched, so a
 * hand-created GitHub item outside the allowlist is left alone.
 *
 * Reconciliation rules:
 *   - Secrets → always pushed (GitHub hides secret values, so they can't be diffed).
 *   - Variables → pushed only when missing or changed; an unchanged value is left alone.
 *   - Variables whose value EQUALS their env-schema default (`envProfiles.<env>.defaults`)
 *     → not pushed, and pruned from GitHub if present (the runtime falls back to the
 *     identical default). `keepSchemaDefaults` pushes them verbatim instead.
 *   - A managed key DECLARED but blank (`KEY=`) → neither pushed nor deleted (blank =
 *     "not managed here"; the remote value is preserved). Only removing the LINE
 *     marks it stale.
 *   - A managed remote item no longer declared (or reclassified across kinds) → deleted.
 */

/**
 * @typedef {{ name: string, value: string }} EnvEntry
 * @typedef {'secret' | 'variable' | 'unmanaged'} ManagedKind
 * @typedef {{ secretKeys: ReadonlySet<string>, variableKeys: ReadonlySet<string> }} KindSets
 */

/**
 * Classify a key by allowlist membership. Secret wins if a key is (mistakenly) in
 * both lists — never leak a secret as a plaintext variable.
 * @param {string} name
 * @param {KindSets} sets
 * @returns {ManagedKind}
 */
export function classifyManagedKey(name, sets) {
  if (sets.secretKeys.has(name)) return 'secret';
  if (sets.variableKeys.has(name)) return 'variable';
  return 'unmanaged';
}

/**
 * Split declared env entries into the buckets the sync acts on. Unmanaged keys
 * (outside both allowlists) are dropped entirely.
 * @param {readonly EnvEntry[]} declared
 * @param {{
 *   secretKeys: ReadonlySet<string>,
 *   variableKeys: ReadonlySet<string>,
 *   schemaDefaults?: ReadonlyMap<string, string>,
 *   keepSchemaDefaults?: boolean,
 * }} options
 * @returns {{ secrets: EnvEntry[], variables: EnvEntry[], blank: EnvEntry[], schemaDefault: EnvEntry[] }}
 */
export function splitManagedEntries(declared, options) {
  const {
    secretKeys,
    variableKeys,
    schemaDefaults = new Map(),
    keepSchemaDefaults = false,
  } = options;
  /** @type {EnvEntry[]} */ const secrets = [];
  /** @type {EnvEntry[]} */ const variables = [];
  /** @type {EnvEntry[]} */ const blank = [];
  /** @type {EnvEntry[]} */ const schemaDefault = [];

  for (const entry of declared) {
    const kind = classifyManagedKey(entry.name, { secretKeys, variableKeys });
    if (kind === 'unmanaged') continue;
    if (entry.value === '') {
      blank.push(entry);
      continue;
    }
    const equalsSchemaDefault =
      kind === 'variable' &&
      !keepSchemaDefaults &&
      schemaDefaults.get(entry.name) === entry.value;
    if (equalsSchemaDefault) {
      schemaDefault.push(entry);
      continue;
    }
    if (kind === 'secret') secrets.push(entry);
    else variables.push(entry);
  }

  return { secrets, variables, blank, schemaDefault };
}

/**
 * Remote items to delete: a remote key that is MANAGED (in the allowlist for
 * either kind) but not in the declared set for its kind. `declaredNames` MUST
 * include blank-valued keys so blanking never deletes a live value; schema-default
 * VARIABLE names are deliberately EXCLUDED from the variable declared-set so the
 * prune removes any stale remote copy.
 * @param {{
 *   remoteKeys: readonly string[],
 *   declaredNames: ReadonlySet<string>,
 *   managedNames: ReadonlySet<string>,
 * }} options
 * @returns {string[]}
 */
export function findStaleManaged(options) {
  const { remoteKeys, declaredNames, managedNames } = options;
  return remoteKeys.filter((name) => managedNames.has(name) && !declaredNames.has(name));
}

/** The reconciliation decision for one key — the unit the `--diff` preview renders. */
/**
 * @typedef {'blank' | 'secret' | 'secret-create' | 'skip+prune' | 'skip' | 'create' | 'unchanged' | 'update' | 'prune-stale'} SyncDecision
 * @typedef {{
 *   name: string,
 *   kind: 'secret' | 'variable' | 'blank',
 *   schemaDefault: string | null,
 *   local: string,
 *   remote: string,
 *   decision: SyncDecision,
 * }} SyncPreviewRow
 */

/** Shown in place of a secret value — secret values are never printed. */
const PREVIEW_SECRET_MASK = '••••';

/**
 * Compute, per managed declared key, the exact decision `github:sync` would make
 * against a given remote — the pure core of `--diff`. Unmanaged keys are omitted;
 * managed remote keys with no local line are appended as `prune-stale`.
 * @param {{
 *   declared: readonly EnvEntry[],
 *   remoteVariables: ReadonlyMap<string, string>,
 *   remoteSecretNames: ReadonlySet<string>,
 *   secretKeys: ReadonlySet<string>,
 *   variableKeys: ReadonlySet<string>,
 *   schemaDefaults?: ReadonlyMap<string, string>,
 *   keepSchemaDefaults?: boolean,
 * }} options
 * @returns {SyncPreviewRow[]}
 */
export function planEnvironmentSyncPreview(options) {
  const {
    declared,
    remoteVariables,
    remoteSecretNames,
    secretKeys,
    variableKeys,
    schemaDefaults = new Map(),
    keepSchemaDefaults = false,
  } = options;
  const sets = { secretKeys, variableKeys };
  const { blank, schemaDefault } = splitManagedEntries(declared, {
    secretKeys,
    variableKeys,
    schemaDefaults,
    keepSchemaDefaults,
  });
  const blankNames = new Set(blank.map((entry) => entry.name));
  const schemaDefaultNames = new Set(schemaDefault.map((entry) => entry.name));
  const managedNames = new Set([...secretKeys, ...variableKeys]);
  const declaredAllNames = new Set(declared.map((entry) => entry.name));

  /** @type {SyncPreviewRow[]} */
  const rows = [];
  for (const { name, value } of declared) {
    const kind = classifyManagedKey(name, sets);
    if (kind === 'unmanaged') continue;
    const secret = kind === 'secret';
    const onRemote = remoteVariables.has(name) || remoteSecretNames.has(name);
    /** @type {SyncDecision} */
    let decision;
    if (blankNames.has(name)) decision = 'blank';
    else if (schemaDefaultNames.has(name)) decision = onRemote ? 'skip+prune' : 'skip';
    else if (secret) decision = remoteSecretNames.has(name) ? 'secret' : 'secret-create';
    else if (!remoteVariables.has(name)) decision = 'create';
    else decision = remoteVariables.get(name) === value ? 'unchanged' : 'update';
    rows.push({
      name,
      kind: value === '' ? 'blank' : secret ? 'secret' : 'variable',
      schemaDefault: secret ? null : (schemaDefaults.get(name) ?? null),
      local: value === '' ? '' : secret ? PREVIEW_SECRET_MASK : value,
      remote: secret
        ? remoteSecretNames.has(name)
          ? PREVIEW_SECRET_MASK
          : ''
        : (remoteVariables.get(name) ?? ''),
      decision,
    });
  }

  // Managed remote keys with NO local line → pruned as stale. Schema-default names
  // are declared, so they are already emitted above as skip+prune — filter them out.
  const declaredSecretNames = new Set(
    declared
      .filter((entry) => classifyManagedKey(entry.name, sets) === 'secret')
      .map((e) => e.name),
  );
  const declaredVariableNames = new Set(
    declared
      .filter(
        (entry) =>
          classifyManagedKey(entry.name, sets) === 'variable' &&
          !schemaDefaultNames.has(entry.name),
      )
      .map((entry) => entry.name),
  );
  const staleVariables = findStaleManaged({
    remoteKeys: [...remoteVariables.keys()],
    declaredNames: declaredVariableNames,
    managedNames,
  }).filter((name) => !declaredAllNames.has(name));
  const staleSecrets = findStaleManaged({
    remoteKeys: [...remoteSecretNames],
    declaredNames: declaredSecretNames,
    managedNames,
  }).filter((name) => !declaredAllNames.has(name));
  for (const name of staleVariables) {
    rows.push({
      name,
      kind: 'variable',
      schemaDefault: schemaDefaults.get(name) ?? null,
      local: '',
      remote: remoteVariables.get(name) ?? '',
      decision: 'prune-stale',
    });
  }
  for (const name of staleSecrets) {
    rows.push({
      name,
      kind: 'secret',
      schemaDefault: null,
      local: '',
      remote: PREVIEW_SECRET_MASK,
      decision: 'prune-stale',
    });
  }

  return rows;
}

/** Decision sort order for the preview — outcomes that CHANGE remote state first. */
const PREVIEW_DECISION_ORDER = /** @type {const} */ ([
  'prune-stale',
  'update',
  'skip+prune',
  'create',
  'secret-create',
  'skip',
  'unchanged',
  'secret',
  'blank',
]);

/**
 * Render preview rows as an aligned text table plus a per-decision count summary.
 * @param {{ rows: readonly SyncPreviewRow[], environment: string }} options
 * @returns {string}
 */
export function formatSyncPreviewTable(options) {
  const { rows, environment } = options;
  const columns = /** @type {const} */ ([
    { header: 'VARIABLE', width: 44, value: (/** @type {SyncPreviewRow} */ r) => r.name },
    { header: 'KIND', width: 8, value: (/** @type {SyncPreviewRow} */ r) => r.kind },
    {
      header: 'DEFAULT',
      width: 16,
      value: (/** @type {SyncPreviewRow} */ r) => r.schemaDefault ?? '—',
    },
    {
      header: 'LOCAL',
      width: 20,
      value: (/** @type {SyncPreviewRow} */ r) => r.local || '""',
    },
    {
      header: 'REMOTE',
      width: 20,
      value: (/** @type {SyncPreviewRow} */ r) => r.remote || '—',
    },
    {
      header: 'DECISION',
      width: 14,
      value: (/** @type {SyncPreviewRow} */ r) => r.decision,
    },
  ]);
  const cell = (/** @type {string} */ text, /** @type {number} */ width) => {
    const clean = text.replace(/\s+/g, ' ');
    return (clean.length > width ? `${clean.slice(0, width - 1)}…` : clean).padEnd(width);
  };
  const rank = (/** @type {SyncDecision} */ decision) => {
    const index = PREVIEW_DECISION_ORDER.indexOf(decision);
    return index === -1 ? PREVIEW_DECISION_ORDER.length : index;
  };
  const sorted = [...rows].sort(
    (a, b) => rank(a.decision) - rank(b.decision) || a.name.localeCompare(b.name),
  );

  const lines = [
    `github:sync ${environment} — preview (read-only, no changes made)`,
    columns.map((column) => cell(column.header, column.width)).join('  '),
    columns.map((column) => '-'.repeat(column.width)).join('  '),
    ...sorted.map((row) =>
      columns.map((column) => cell(column.value(row), column.width)).join('  '),
    ),
  ];

  /** @type {Map<SyncDecision, number>} */
  const counts = new Map();
  for (const row of rows) counts.set(row.decision, (counts.get(row.decision) ?? 0) + 1);
  const summary = PREVIEW_DECISION_ORDER.filter((decision) => counts.has(decision))
    .map((decision) => `${decision}=${counts.get(decision)}`)
    .join('  ');
  lines.push('', `total=${rows.length}  ${summary}`);
  return lines.join('\n');
}
