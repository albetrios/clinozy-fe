# Paste this to Claude Design — remaining screens

For the screens outside the main app shell: auth, onboarding, errors.

**These are content lists, not layouts.** You decide the composition, spacing,
and visual treatment in your style — match the app shell you already designed.

---

Design the screens below in the same visual language as the app you've already
designed. I'm giving you **what's on each screen**, not how to arrange it —
layout, hierarchy, and treatment are yours.

Return one markdown file per screen, same template as before, but **brief**:
regions, copy, states, icons. Skip anything that doesn't apply.

## Shared

These screens sit outside the main navigation — no sidebar, no org switcher.
Signed-out screens should still carry the brand mark and a light/dark treatment.

## 1. Sign in / sign up — one screen

**This app is passwordless, and one route serves both sign-in and sign-up.** No
password field, no "forgot password", no separate register screen — do not
design them.

Methods, in presentation order:

1. Continue with Google
2. Continue with GitHub
3. Continue with Apple
4. Continue with a passkey
5. Email one-time code — open by default, below the providers

Providers are individually toggleable, so design for any subset being absent.

Two panels on this one route: **email entry**, then **code verification** (where
the providers and welcome copy are hidden — just "check your email", a 6-digit
input, resend, and change-email).

Also present: an invisible bot-check (no UI unless it challenges).

States: idle · sending · code sent · verifying · invalid code · expired code ·
resend cooldown · rate-limited · provider error.

## 2. Two-factor

Shown after a successful first factor.

- 6-digit authenticator code
- Fallback: use a recovery code instead
- Option to trust this device

States: idle · verifying · wrong code · too many attempts.

## 3. Returning from a social provider

A brief transitional screen while the sign-in completes. Success continues
automatically; failure needs a message and a way back to sign in.

## 4. Accept an invitation

Someone was invited to a workspace and opened the link.

- Shows who invited them and which workspace
- Accept / decline
- If not signed in, they sign in or create an account first

States: loading · valid · already accepted · expired · wrong account.

## 5. First-run setup

After a first sign-up, before reaching the app. A short guided sequence —
profile basics, then workspace basics. Should feel skippable-ish and show
progress.

## 6. Choose a workspace

For someone who belongs to more than one. A list to pick from, plus a way to
create a new one. Include a search affordance if the list can be long.

## 7. No access

Signed in, but not allowed to see the thing they asked for. Needs an
explanation, and a way back to somewhere they can access.

## 8. Not found

The URL doesn't exist. Same treatment family as **No access**.

## 9. Public pages

A minimal frame for signed-out content (terms, privacy, status). Brand mark,
the content, a slim footer.

---

## Please keep in mind

- **Copy matters** — give the exact wording for headings, buttons, helper text,
  and every error. Don't leave placeholders.
- **Every state** — each screen needs its loading, error, and empty variants.
- **Both modes** — light and dark.
- **Mobile** — say what changes; these are often opened on a phone from a link.
- **Icon names**, not descriptions.
