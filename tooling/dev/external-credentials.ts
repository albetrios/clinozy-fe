/**
 * External credentials for `.env.local` — the third-party integration keys
 * `envProfiles.local.externalCredentials` names (src/core/config/env-schema.ts), whose
 * development value is also the right one on localhost (test-mode Stripe, PostHog).
 * `pnpm setup:local` fills them into a new `.env.local` and tops up an existing one.
 *
 * Source, per key: `.env.development` when it sets the key, else the process environment
 * (a cloud session's Variables, an exported shell variable) — so a machine without a
 * `.env.development` still gets them.
 *
 * Never overwrites: a key already set in `.env.local` keeps its value, so a deliberate local
 * choice survives. Only keys missing or blank locally are written. Values are never logged —
 * callers get the key names and where each came from.
 */
import { parseEnv } from 'node:util';

/** Set `key=value` in env-file content: replace its line if present, else append one. */
export function upsertEnvAssignment(content: string, key: string, value: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedKey}=.*$`, 'm');
  const line = `${key}=${/[\s#"'$]/.test(value) ? JSON.stringify(value) : value}`;
  if (pattern.test(content)) return content.replace(pattern, () => line);
  return content.endsWith('\n') ? `${content}${line}\n` : `${content}\n${line}\n`;
}

/** Where a filled credential came from. */
export type CredentialSource = '.env.development' | 'environment';

/**
 * Fill each of `keys` that is missing or blank in `localContent`, from `developmentContent`
 * when it sets the key, else from `environment`.
 *
 * @returns the new content and, per filled key, its source (empty when nothing changed)
 */
export function fillExternalCredentials(
  localContent: string,
  developmentContent: string,
  keys: readonly string[],
  environment: Readonly<Record<string, string | undefined>> = {},
): { content: string; filled: Array<{ key: string; source: CredentialSource }> } {
  const local = parseEnv(localContent);
  const development = parseEnv(developmentContent);
  let content = localContent;
  const filled: Array<{ key: string; source: CredentialSource }> = [];
  for (const key of keys) {
    if (local[key]) continue;
    const fromFile = development[key];
    const fromEnvironment = environment[key];
    const value = fromFile || fromEnvironment;
    if (!value) continue;
    content = upsertEnvAssignment(content, key, value);
    filled.push({ key, source: fromFile ? '.env.development' : 'environment' });
  }
  return { content, filled };
}

/** "KEY (source), …" for a log line — key names and sources only, never values. */
export function describeFilled(
  filled: ReadonlyArray<{ key: string; source: CredentialSource }>,
): string {
  return filled.map(({ key, source }) => `${key} (${source})`).join(', ');
}
