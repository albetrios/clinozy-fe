import { existsSync, readFileSync } from 'node:fs';

/**
 * Parse a simple KEY=VALUE env file (no export prefix, # comments).
 * @param {string} filePath
 * @returns {Map<string, string>}
 */
export function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return new Map();
  }

  /** @type {Map<string, string>} */
  const entries = new Map();
  const content = readFileSync(filePath, 'utf-8');

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) entries.set(key, value);
  }

  return entries;
}
