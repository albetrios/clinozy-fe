import { afterEach, describe, expect, it, vi } from 'vitest';

/** A fresh module: what it has preconnected is per page load. */
async function freshModule() {
  vi.resetModules();
  return import('./oauth-preconnect.ts');
}

const hints = () => [
  ...document.head.querySelectorAll<HTMLLinkElement>('link[rel="preconnect"]'),
];

describe('preconnectOAuthProvider', () => {
  afterEach(() => {
    for (const link of hints()) link.remove();
  });

  it('connects to the provider’s sign-in page, once', async () => {
    const { preconnectOAuthProvider } = await freshModule();

    preconnectOAuthProvider('google');
    preconnectOAuthProvider('google');

    expect(hints().map((link) => link.href)).toEqual(['https://accounts.google.com/']);
  });

  it('opens a credentialed socket — the redirect is a top-level navigation', async () => {
    const { preconnectOAuthProvider } = await freshModule();
    preconnectOAuthProvider('github');

    expect(hints()[0]?.hasAttribute('crossorigin')).toBe(false);
  });

  it('does nothing for a provider it does not know', async () => {
    const { preconnectOAuthProvider } = await freshModule();
    preconnectOAuthProvider('unknown');

    expect(hints()).toEqual([]);
  });
});
