/**
 * Load `.env*` files for Node tooling scripts (validators, github:sync helpers).
 *
 * Vite loads env for dev/build; this mirrors the same convention for scripts that
 * import `src/core/config/env-schema.ts` via tsx.
 *
 * Convention:
 *   - Primary: `.env.${NODE_ENV}` (default NODE_ENV=local for scripts)
 *   - Fallback: `.env.local` when primary missing (never in production)
 *
 * One `.env.<NODE_ENV>` file per environment (`.env.local` locally, mirroring
 * clinozy-be). Deploys inject env from GitHub Environments (process.env), not files.
 * Empty values (`KEY=`) are stripped so optional Zod fields see `undefined` — only when the
 * value IN EFFECT is empty: a value the shell already set (a cloud environment's Variables)
 * survives a blank placeholder in `.env.local`. Same rule as clinozy-be's loader.
 */
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const SAFE_KEY = /^[A-Z][A-Z0-9_]*$/;

/**
 * Loads one env file into `process.env`, then unsets every key it names whose value in effect
 * is empty. Without `override` the shell wins, blank file line or not.
 *
 * @param {string} envFilePath
 * @param {boolean} [override]
 */
export function applyDotenvFile(envFilePath, override = false) {
  const result = config({ path: envFilePath, override });
  const parsed = result.parsed ?? {};
  for (const key of Object.keys(parsed)) {
    if (!SAFE_KEY.test(key)) continue;
    if (process.env[key] === '') {
      delete process.env[key];
    }
  }
}

export function loadEnvFiles() {
  const nodeEnv = process.env.NODE_ENV ?? 'local';
  const primary = resolve(projectRoot, `.env.${nodeEnv}`);
  if (existsSync(primary)) {
    applyDotenvFile(primary);
  } else if (nodeEnv !== 'production') {
    const fallback = resolve(projectRoot, '.env.local');
    if (existsSync(fallback)) {
      applyDotenvFile(fallback);
    }
  }
}

loadEnvFiles();
