import type { Plugin } from 'vite';

import { wordmarkParts } from '../src/lib/brand-wordmark.ts';
import {
  PRODUCT_DESCRIPTION,
  PRODUCT_NAME,
  PRODUCT_NAMESPACE,
  PRODUCT_THEME_COLOR,
} from '../src/lib/product-identity.ts';

/** Escape a product-identity string for HTML text. */
function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * The boot splash's wordmark (`splash.md:19`; H:518): the name in lower case, its
 * first "o" a ring (r 7.6, stroke 4.2 on a 20-unit grid) around a centre dot
 * (r 3). The same drawing as `ProductWordmark`, from the same split
 * ({@link wordmarkParts}); `index.html` colours it through the classes.
 */
export function productWordmarkHtml(name: string): string {
  const { head, ring, tail } = wordmarkParts(name);
  if (!ring) return escapeHtml(head);
  return (
    `${escapeHtml(head)}<svg class="app-splash-ring" viewBox="0 0 20 20" aria-hidden="true">` +
    '<circle class="app-splash-ring-line" cx="10" cy="10" r="7.6" fill="none" stroke-width="4.2" />' +
    '<circle class="app-splash-ring-dot" cx="10" cy="10" r="3" />' +
    `</svg>${escapeHtml(tail)}`
  );
}

/**
 * Identity tokens substituted in `index.html`. Deliberately `{{…}}` rather than
 * Vite's `%VAR%` html-env syntax so they can never collide with an env key.
 */
const TOKENS: Record<string, string> = {
  '{{PRODUCT_NAME}}': PRODUCT_NAME,
  '{{PRODUCT_DESCRIPTION}}': PRODUCT_DESCRIPTION,
  '{{PRODUCT_THEME_COLOR}}': PRODUCT_THEME_COLOR,
  '{{PRODUCT_WORDMARK}}': productWordmarkHtml(PRODUCT_NAME),
  // The storage namespace: `public/splash-init.js` reads the session hint's key
  // off `<html data-session-hint-key>` before the first paint.
  '{{PRODUCT_NAMESPACE}}': PRODUCT_NAMESPACE,
};

/** Any `{{PRODUCT_*}}` token left after substitution is a typo, not a value. */
const UNRESOLVED = /\{\{PRODUCT_[A-Z_]+\}\}/;

/**
 * Substitutes product identity into `index.html` — document title, meta
 * description, `theme-color`, and the boot splash's label and wordmark.
 *
 * These strings used to be hardcoded, which made them the most-missed spots
 * in a rebrand (the splash brand in particular is markup, not config). Sourcing
 * them from `src/lib/product-identity.ts` — itself generated from
 * `tooling/setup/setup.config.json` — removes them from the rename surface
 * entirely, so `pnpm rebrand` never has to touch HTML.
 *
 * Runs `pre` so the substituted markup is what every later html transform (and
 * the CSP plugin's placeholder pass) sees.
 */
export function productIdentityHtml(): Plugin {
  return {
    name: 'product-identity-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const out = Object.entries(TOKENS).reduce(
          (acc, [token, value]) => acc.replaceAll(token, value),
          html,
        );
        const leftover = UNRESOLVED.exec(out);
        if (leftover) {
          throw new Error(
            `product-identity-html: unknown token ${leftover[0]} in index.html — ` +
              `known tokens are ${Object.keys(TOKENS).join(', ')}.`,
          );
        }
        return out;
      },
    },
  };
}
