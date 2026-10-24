# `pages/login` — Unified auth entry

Route: `/login`. **Single public entry for both sign-in and sign-up.** Users never pick
“login vs register”; the backend treats send uniformly and auto-signs up on first OTP verify
for unknown email.

**Email OTP** is open by default below OAuth and passkey. Alternate methods: Google, GitHub, passkey.

New passwordless users → `/onboarding` → app.

**Docs:** [unified-auth-flows.md](../../../docs/reference/unified-auth-flows.md) ·
[unified-auth-otp-requirement.md](../../../docs/getting-started/requirements/unified-auth-otp-requirement.md)

## Files

| File                     | Responsibility                                            |
| ------------------------ | --------------------------------------------------------- |
| `login.route.tsx`        | Route marker — exports `Component` rendering `LoginPage`. |
| `LoginPage.tsx`          | Thin wrapper around shared `<AuthForm />`.                |
| `shared/forms/AuthForm/` | Unified auth UI — default email OTP + provider buttons.   |

The frame is `AuthLayout` (`shared/layouts/AuthLayout/AuthLayout.tsx`). From `xl` it is a
split screen: a **stage** on the signed-out canvas — the logo, a hero (who Clinozy is for and
the promise), three reasons, and the **journey dial** — and the form docked in its own
full-height panel at the inline end, with the language picker and theme toggle at its top and
"Privacy choices" at its foot. The dial
(`src/shared/layouts/AuthLayout/components/AuthShowcase/`) draws one patient's day: seven
tone-coded stops on a ring, the logo's green thread stepping from stop to stop, the stop it is
on named in the centre, and three moments from a clinic day lifting as the thread passes
their stop — one 15.4s clock for all of it, still under reduced motion. Below `xl` the order
is hero → the form's 360px card → dial → reasons, so the card stays above the fold. The
showcase is static copy (`auth` › `showcase.*`, 11 locales); the split's grid and the dial's
motion ship as CSS with the lazy auth chunk
(`src/shared/layouts/AuthLayout/auth-layout.css`,
`src/shared/layouts/AuthLayout/components/AuthShowcase/auth-showcase.css`), never
on the first paint.

## Flow

1. **Email (default):** email → Continue → 6-character code (letters and digits) → verify → onboarding (new) or app (returning)
   - On the **verify** step, OAuth/passkey and the full welcome copy are hidden — focused “Check your email” + code entry only.
   - **Local-dev autofill:** when clinozy-be runs with `TEST_MODE` on, `send-code` echoes
     `debug_verification_code` and the verify step **prefills** it (fills, never
     auto-submits). Field presence is the gate — no client flag; the echo never
     exists in production (clinozy-be `.refine()`-forbids `TEST_MODE` there).
2. **OAuth / passkey:** `/callback` → `silentRefresh()` → post-auth resolver (onboarding, the clinic home, or the picker)

### The hand-off is one-way (LOGIN-5, LOGIN-7)

Once a code is accepted this screen is leaving, and it must never appear to go
backwards while the destination loads.

- `pending` stays set through the navigation, so the verify button holds its
  spinner instead of inviting a second submit with a spent code (LOGIN-5).
- The auth shell's form slot is **never re-keyed on the location**. `useLocation()`
  reports the _pending_ path — set the moment `navigate()` is called, before the
  destination's guards, chunk and translations load — so a `key` off it threw the
  login subtree away and remounted it at step one, mid-hand-off (LOGIN-7). The slot
  replays its fade on the same element and keys off `resolvedLocation` instead: see
  `shared/layouts/AuthLayout/AuthLayout.shared.tsx` and
  `lib/animations/useReplayedAnimation.ts`.
- Guards on the way out read `me/context` **cache-first** (`ensureSessionContext`,
  `ensurePermissionsFor`), so the screen is not held open for a redundant fetch.

### The first paint is the login screen's own frame

A cold load with no session hint lands here, so it never shows the boot splash:
`public/splash-init.js` paints `#app-boot-frame` — the canvas and the logo where
the header draws it — and this screen paints over it (`APP_BOOT_FRAME`,
`lib/app-splash.ts`). Offline, the splash stays, for its notice and Retry.

## Login + signup rules (product)

| Step         | FE                         | BE                                                            |
| ------------ | -------------------------- | ------------------------------------------------------------- |
| Send OTP     | Same UI for everyone       | `201` + uniform body — no “account exists” leak               |
| Verify OTP   | Same code UI               | Known user → session; unknown → auto-create account + session |
| After verify | New signup → `/onboarding` | Personal org provisioned on first verify (BE)                 |

## Test IDs

- `auth-form`, `auth-email-panel`, `auth-email-verify-panel`
- `auth-email`, `auth-email-submit`, `auth-email-code`, `auth-email-verify`
- `auth-email-resend`, `auth-email-change`
- `auth-continue-google`, `auth-continue-github`, `auth-continue-passkey`
