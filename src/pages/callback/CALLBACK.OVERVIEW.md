# `pages/callback` — OAuth callback

Route: `/callback/$provider` (e.g. `/callback/google`, `/callback/github`).
Provider-specific redirect target for OAuth and future third-party sign-in —
each provider registers its own URL, so the path itself names the provider that
is returning; one island still serves every provider, so adding one never
touches this page. Outside the `auth-shell` route: it renders the boot loader
(`FullPageSpinner` — the splash's mark and wordmark, already the launch's look),
not the sign-in canvas.

## Files

| File                   | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `callback.route.tsx`   | Route marker — exports `Component` rendering `CallbackPage`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `callback.manifest.ts` | Page manifest — `kind: 'leaf'`, path `/callback/$provider`, no permission required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `callback.search.ts`   | Search schema — optional `code`/`state` (provider redirect) and `error` (provider denial).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `CallbackPage.tsx`     | Takes the exchange `main.tsx` started at boot (`takeOAuthCallbackSignIn`, `shared/auth/oauth-callback-sign-in.ts`), or — when the boot did not start one — forwards `code`+`state` itself (`completeOAuthSignIn`: `authApi.oauthCallback` for the provider named by the `$provider` param, validated by `parseOAuthProviderParam` in the route guard, then `establishSession()`); `MfaRequiredError` hands off to `/mfa`. Without `code`+`state`, falls back to `silentRefresh()` — only when this browser holds a session hint (`hasSessionHint()`); with none there is nothing to restore, so it fails to `/login` without asking the server. On failure routes back to `/login`. Owns `data-testid="callback-page"`. |

## Backend contract

The provider redirects the browser here with `code`+`state`. The page forwards
both to clinozy-be's `GET /auth/oauth/:provider/callback` (an XHR that carries the
`oauth_nonce` cookie set at start), and the backend consumes the CSRF state,
exchanges the code, sets the refresh-session cookie on that response, and
returns the access token (or the MFA-required branch). Register
`https://<app-origin>/callback/<provider>` (e.g. `…/callback/google`) as the
redirect URI when configuring each provider on the backend
(`OAUTH_<PROVIDER>_REDIRECT_URI`) and in the provider's console.

## Speed: the hand-off starts at boot

Measured on a cold load before this, the page sent the code only once its own
chunk and translations had loaded (~1.4s on the dev server), under a splash that
also waited out its 2,050ms wordmark beat. Now:

- **The exchange starts at boot.** `main.tsx` calls `startOAuthCallbackSignIn()`
  before the auth bootstrap, so the code is exchanged beside the app's own download;
  the boot warms this page's chunk and the signed-in shell it lands on
  (`preloadBootRoutes({ signingIn })`). The bootstrap waits for that sign-in instead
  of refreshing beside it (`src/shared/auth/AUTH.OVERVIEW.md`).
- **The splash is at rest.** `public/splash-init.js` marks the load
  `APP_SPLASH_STATIC`: every frame at its end state from the first paint, and the
  exit waits only for the sign-in to land somewhere.
- **The provider's page is preconnected** on the press of its button
  (`shared/forms/AuthForm/oauth-preconnect.ts`), so its DNS and TLS overlap
  `oauthStart`'s round trip.

## Browser history

A sign-in must not leave entries of ours behind the landing page, so Back from
a fresh sign-in leaves the app instead of walking back through the flow:

- `AuthForm` hands off to the provider with `window.location.replace`, not
  `assign` — the `/login` entry becomes the provider's navigation.
- This page moves on with `navigate({ …, replace: true })`, and the `/`
  resolver's redirect replaces too (TanStack Router follows every `beforeLoad`
  redirect with `replace: true`).

When the provider completes on HTTP redirects — a returning user with one
signed-in account — the whole sign-in collapses into the landing entry. A
provider page the user actually clicks through (an account chooser, a
first-time consent) is the provider's own entry; no page code can remove
another origin's history entry. clinozy-be keeps that page rare by not forcing a
prompt: it sends neither `prompt=consent` nor `access_type=offline`.

Everything after the landing pushes, so Back moves between organizations as
usual — including after creating one.
