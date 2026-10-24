import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

import { loadIdentity } from '../tooling/identity/identity.mjs';

/** Where a researcher looks first (RFC 9116 §3). */
export const SECURITY_TXT_PATH = '/.well-known/security.txt';

/** RFC 9116 asks for an `Expires` under a year away; every deploy renews it. */
const EXPIRES_IN_DAYS = 364;
const DAY_MS = 86_400_000;

/** What the file names: the manifest's mailbox and the repository's private reporting. */
interface SecurityTxtIdentity {
  productName: string;
  securityContact: string;
  repository: string;
}

/**
 * The app origin's `security.txt` (RFC 9116): the private report mailbox
 * (`project.securityContact`, as SECURITY.md gives it), GitHub private
 * vulnerability reporting, the policy, and an `Expires` 364 days from `now`.
 */
export function renderSecurityTxt(identity: SecurityTxtIdentity, now: Date): string {
  const github = `https://github.com/${identity.repository}`;
  const expires = new Date(now.getTime() + EXPIRES_IN_DAYS * DAY_MS);
  return [
    `# Report a security issue in ${identity.productName} privately, never in a public issue.`,
    `Contact: mailto:${identity.securityContact}`,
    `Contact: ${github}/security/advisories/new`,
    `Expires: ${expires.toISOString()}`,
    `Policy: ${github}/security/policy`,
    'Preferred-Languages: en',
    '',
  ].join('\n');
}

/**
 * Serves `/.well-known/security.txt` in dev and writes it into `dist/` at build, from
 * the identity manifest (`tooling/setup/setup.config.json`), so a fork names its own
 * mailbox and the date never goes stale between deploys.
 */
export function securityTxt(): Plugin {
  const identity = loadIdentity();
  return {
    name: 'security-txt',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== SECURITY_TXT_PATH) return next();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(renderSecurityTxt(identity, new Date()));
      });
    },
    closeBundle() {
      const directory = resolve(process.cwd(), 'dist', '.well-known');
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        resolve(directory, 'security.txt'),
        renderSecurityTxt(identity, new Date()),
      );
    },
  };
}
