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
 * choice survives. Only keys missing or blank locally are written; one that no source sets is
 * reported as missing, for the developer to fill by hand. Values are never logged — callers
 * get the key names and where each came from.
 */
import { parse } from 'dotenv';

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

/** What {@link fillExternalCredentials} did, by key name. */
export interface ExternalCredentialsResult {
  /** The `.env.local` content with the filled keys written. */
  content: string;
  /** Keys written, each with its source. */
  filled: Array<{ key: string; source: CredentialSource }>;
  /** Keys blank locally that no source sets — left for the developer. */
  missing: string[];
}

/**
 * Fill each of `keys` that is missing or blank in `localContent`, from `developmentContent`
 * when it sets the key, else from `environment`.
 */
export function fillExternalCredentials(
  localContent: string,
  developmentContent: string,
  keys: readonly string[],
  environment: Readonly<Record<string, string | undefined>> = {},
): ExternalCredentialsResult {
  const local = parse(localContent);
  const development = parse(developmentContent);
  let content = localContent;
  const filled: ExternalCredentialsResult['filled'] = [];
  const missing: string[] = [];
  for (const key of keys) {
    if (local[key]) continue;
    const fromFile = development[key];
    const value = fromFile || environment[key];
    if (!value) {
      missing.push(key);
      continue;
    }
    content = upsertEnvAssignment(content, key, value);
    filled.push({ key, source: fromFile ? '.env.development' : 'environment' });
  }
  return { content, filled, missing };
}

/** "KEY (source), …" for a log line — key names and sources only, never values. */
export function describeFilled(
  filled: ReadonlyArray<{ key: string; source: CredentialSource }>,
): string {
  return filled.map(({ key, source }) => `${key} (${source})`).join(', ');
}
