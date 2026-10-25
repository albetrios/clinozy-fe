/**
 * Where each OAuth provider's sign-in page lives — the origin `oauthStart`'s
 * redirect opens. A provider missing here simply is not preconnected.
 */
const OAUTH_PROVIDER_ORIGINS: Readonly<Record<string, string>> = {
  google: 'https://accounts.google.com',
  github: 'https://github.com',
  apple: 'https://appleid.apple.com',
};

/** Origins this page has already asked the browser to connect to. */
const preconnected = new Set<string>();

/**
 * Open the connection to a provider's sign-in page the moment the visitor reaches
 * for it, so its DNS, TCP and TLS overlap our own `oauthStart` round trip instead of
 * following it.
 *
 * @remarks
 * Called on a press of the provider's button and again from the start itself (the
 * auto-Google path has no press); once per origin per page. Never earlier: a hint at
 * page load would contact the provider for every visitor, most of whom sign in with
 * email — the same reason no analytics host is preconnected before consent.
 * No `crossorigin`: the connection is for a top-level navigation, which sends
 * credentials, and an anonymous-mode socket would not be reused for it.
 */
export function preconnectOAuthProvider(provider: string): void {
  const origin = OAUTH_PROVIDER_ORIGINS[provider];
  if (!origin || preconnected.has(origin)) return;
  preconnected.add(origin);
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = origin;
  document.head.append(link);
}
