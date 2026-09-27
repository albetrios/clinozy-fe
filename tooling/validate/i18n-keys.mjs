#!/usr/bin/env node
/**
 * Validates that i18n key paths referenced in `*_KEYS` constants exist in
 * locale JSON under `src/locales/en/`. Run: `pnpm validate:i18n`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../..');
const LOCALES_EN = join(ROOT, 'src/locales/en');
const SRC = join(ROOT, 'src');

const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(dir, filter) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules') continue;
      out.push(...walk(full, filter));
      continue;
    }
    if (filter(full)) out.push(full);
  }
  return out;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function keyExists(obj, dottedPath) {
  const parts = dottedPath.split('.');
  let cur = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object' || !(part in cur)) return false;
    cur = cur[part];
  }
  return typeof cur === 'string' || typeof cur === 'object';
}

function localeHasKey(bundle, dottedPath) {
  if (keyExists(bundle, dottedPath)) return true;
  const leaf = dottedPath.split('.').pop() ?? dottedPath;
  const parent = dottedPath.slice(0, -(leaf.length + 1));
  const pluralBase = parent ? `${parent}.${leaf}` : leaf;
  return (
    keyExists(bundle, `${pluralBase}_one`) || keyExists(bundle, `${pluralBase}_other`)
  );
}

function collectKeyLiterals(fileText) {
  const keys = new Set();
  const re = /['"]([a-z][a-z0-9]*(?:\.[a-z][a-z0-9_]*)+)['"]/gi;
  let m;
  while ((m = re.exec(fileText)) !== null) {
    const key = m[1];
    if (
      key.includes('.') &&
      !key.startsWith('@/') &&
      !key.includes('-page') &&
      !key.includes('-form') &&
      !key.startsWith('onboarding-')
    ) {
      keys.add(key);
    }
  }
  return keys;
}

function inferNamespace(filePath, fileText) {
  const nsMatch = fileText.match(/_NS\s*=\s*I18N_NAMESPACES\.(\w+)/);
  if (nsMatch) return nsMatch[1];
  const nsMatch2 = fileText.match(/_NS\s*=\s*['"]([\w-]+)['"]/);
  if (nsMatch2) return nsMatch2[1];

  const rel = relative(SRC, filePath);
  const segment = rel.split('/')[1];
  if (
    segment &&
    ['onboarding', 'login', 'auth', 'dashboard', 'settings'].includes(segment)
  ) {
    return segment;
  }
  if (rel.includes('/SettingsModal/')) return 'settings';
  if (rel.includes('/layouts/')) return 'layout';
  if (rel.includes('/i18n/errors')) return 'errors';
  return 'common';
}

const localeFiles = readdirSync(LOCALES_EN).filter((f) => f.endsWith('.json'));
const localeData = Object.fromEntries(
  localeFiles.map((f) => [f.replace(/\.json$/, ''), loadJson(join(LOCALES_EN, f))]),
);

const constantsFiles = walk(SRC, (p) => /\.constants\.ts$/.test(p));

for (const file of constantsFiles) {
  const text = readFileSync(file, 'utf8');
  if (!/export const \w+_KEYS\s*=\s*\{/.test(text)) continue;
  const ns = inferNamespace(file, text);
  const bundle = localeData[ns];
  if (!bundle) {
    fail(`${file}: namespace "${ns}" has no src/locales/en/${ns}.json`);
    continue;
  }
  for (const key of collectKeyLiterals(text)) {
    if (!localeHasKey(bundle, key)) {
      fail(`${file}: missing locale key "${key}" in en/${ns}.json`);
    }
  }
}

if (failures.length > 0) {
  console.error('i18n key validation failed:\n');
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}

console.log(`i18n keys OK (${constantsFiles.length} constants files scanned)`);
