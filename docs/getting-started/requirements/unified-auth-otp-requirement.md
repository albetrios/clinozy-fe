# Requirement: Unified auth (login + signup) — email OTP & phone OTP

Cross-repo requirement for **clinozy-be** and **clinozy-fe**. Copy sections into tickets as needed.

---

## Requirement

### What

One public auth entry (`/login`) where **sign-in and sign-up are the same UX**. The user enters email or phone → receives a 6-digit OTP → verifies. The backend decides whether the identifier is new or existing and responds uniformly on **send** (no account enumeration). On **verify**, existing users get a session; new users are **auto-provisioned** (account + personal org) and the FE routes to onboarding.

Rename legacy **magic-link** HTTP routes to **email-otp**. Add parallel **phone-otp** routes (today: no phone routes in clinozy-be; FE phone panel incorrectly calls email OTP with a phone string).

Removed legacy routes **`/register`**, **`/forgot-password`**, **`/reset-password`**, and **`/verify-email`** — unified auth is **`/login`** only.

### Where

| Repo           | Surface                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| **clinozy-be** | `auth.routes.ts`, email/phone OTP services, DTOs, mail/SMS outbox, `docs/routes.txt`, OpenAPI |
| **clinozy-fe** | `/login` (`AuthForm`), `API_ENDPOINTS`, `auth-api.ts`, integration tests, docs                |

### Unified login + signup — product rules

| Step                                 | User sees                            | Backend behavior                                                                         | FE after success                                                         |
| ------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Send OTP**                         | Same screen for “login” and “signup” | **Always `201`** + same message shape whether identifier exists or not                   | Show code entry step                                                     |
| **Verify OTP (known user)**          | Enter 6-digit code                   | Issue `access_token` + session (or `mfa_required`)                                       | OAuth/passkey → `/` resolver; email/phone **new** signup → `/onboarding` |
| **Verify OTP (unknown email/phone)** | Same code step                       | Auto-create passwordless user, verify identifier, provision personal org on first verify | `markSignupOnboardingPending()` → `/onboarding`                          |
| **OAuth / passkey**                  | Provider buttons on same `/login`    | Existing OAuth/WebAuthn flows; auto-signup when new                                      | `/callback` → `/` (no separate register)                                 |

**FE must not:**

- Branch UI on “do you have an account?”
- Expose removed legacy routes (`/register`, `/forgot-password`, `/reset-password`, `/verify-email`)
- Use URL tokens for email/phone OTP (`/callback` is OAuth-only)

**FE may:**

- Gate methods with per-switch `VITE_AUTH_*` env vars (see [environment-variables runbook](../../deployment/runbooks/environment-variables.md)). The monolithic `VITE_AUTH_OAUTH` flag is **removed** — use `VITE_AUTH_OAUTH_GOOGLE`, `VITE_AUTH_OAUTH_GITHUB`, and `VITE_AUTH_OAUTH_APPLE` instead. Auth surface is **env-only** on the FE (no `GET /auth/oauth/providers`).

---

## API families (do not merge)

### A. Sign-in / sign-up OTP (first factor)

| Channel   | Send (new)                         | Verify (new)                         | Send body         | Verify body       | Verify success         |
| --------- | ---------------------------------- | ------------------------------------ | ----------------- | ----------------- | ---------------------- |
| **Email** | `POST /api/v1/auth/email-otp/send` | `POST /api/v1/auth/email-otp/verify` | `{ email }`       | `{ email, code }` | Token or MFA challenge |
| **Phone** | `POST /api/v1/auth/phone-otp/send` | `POST /api/v1/auth/phone-otp/verify` | `{ phone }` E.164 | `{ phone, code }` | Token or MFA challenge |

**Replace (email — legacy names):**

| Current                        | New                           |
| ------------------------------ | ----------------------------- |
| `POST /auth/magic-link/send`   | `POST /auth/email-otp/send`   |
| `POST /auth/magic-link/verify` | `POST /auth/email-otp/verify` |

**Optional (1 release):** keep `/auth/magic-link/*` as aliases forwarding to email-otp handlers.

**Phone (net-new in clinozy-be):** mirror email-otp semantics (uniform send, auto-signup on verify, MFA branch, rate limits, CAPTCHA policy TBD for SMS cost).

### B. Verify-only (existing account, no login)

For users who already have an account but `is_email_verified === false` (password signup path, invite workflows).

| Route                                  | Auth   | Body              | Response                               |
| -------------------------------------- | ------ | ----------------- | -------------------------------------- |
| `POST /auth/email/verify`              | PUBLIC | `{ email, code }` | `201` + `{ message }` — **no session** |
| `POST /auth/email/resend-verification` | AUTH   | —                 | `201` + message                        |

Do **not** use family B endpoints on `/login` OTP verify step.

---

## Backend (clinozy-be) acceptance criteria

### Email OTP rename

- [ ] Register `/email-otp/send` and `/email-otp/verify` with OpenAPI tag **Email OTP** (not Magic Link).
- [ ] DTOs: `EmailOtpSendDto`, `EmailOtpVerifyDto` (same shapes as today’s magic-link DTOs).
- [ ] Events/mail: `auth.email_otp.requested`, template copy is **code only** (no magic link URL).
- [ ] Errors: `invalidOrExpiredEmailOtp` (alias old magic-link key one release).
- [ ] Regenerate `docs/routes.txt`, OpenAPI examples, route catalog.
- [ ] All existing magic-link tests updated or duplicated for email-otp paths.

### Phone OTP (new)

- [ ] `POST /phone-otp/send` — `{ phone }` validated E.164; uniform `201` (no enumeration).
- [ ] `POST /phone-otp/verify` — `{ phone, code }`; same first-factor result as email-otp (token | MFA).
- [ ] Auto-signup unknown phone (or link phone to existing user — **product decision:** recommend auto-signup like email).
- [ ] SMS outbox/event handler (parallel to email OTP mail handler).
- [ ] Per-phone send cooldown + verify attempt cap (mirror email OTP).
- [ ] Rate limits on public routes (stricter than email if SMS cost requires).
- [ ] Tests: unit + integration + e2e (`phone-otp-flow.e2e.test.ts`).

### Unified signup behavior (both channels)

- [ ] Send never reveals whether identifier exists.
- [ ] Verify for new identifier creates user + issues session (email/phone verified inline).
- [ ] First verify provisions personal org (existing magic-link behavior).
- [ ] MFA-enabled users receive `mfa_required` + `mfa_session_token` instead of token.

### Internal renames (follow-up or same PR)

- [ ] `AUTH_METHOD_TYPE.MAGIC_LINK` → `EMAIL_OTP` (DB compat layer if needed).
- [ ] Redis key prefixes `MAGIC_LINK_*` → `EMAIL_OTP_*` (or dual-read during transition).

---

## Frontend (clinozy-fe) acceptance criteria

### Already done

- [x] Single `/login` with `AuthForm` (email OTP default panel).
- [x] Removed legacy routes: `/register`, `/forgot-password`, `/reset-password`, `/verify-email`.
- [x] Removed phone panel from FE (`AuthPhonePanel` deleted; no `VITE_AUTH_PHONE`).
- [x] Client API: `emailOtpSend` / `emailOtpVerify` (paths still legacy until BE ships rename).
- [x] Email verify step → onboarding for new signups.
- [x] Env: per-method `VITE_AUTH_*` switches (`VITE_AUTH_EMAIL`, `VITE_AUTH_OAUTH_GOOGLE|GITHUB|APPLE`, `VITE_AUTH_PASSKEY`, …) — see [credentials-and-env.md](../../integrations/credentials-and-env.md)

### After BE email-otp rename

- [ ] Update `API_ENDPOINTS.AUTH.EMAIL_OTP_SEND|VERIFY` to `/auth/email-otp/send|verify`.
- [ ] `pnpm contracts:drift` passes against updated `clinozy-be/docs/routes.txt`.
- [ ] Integration tests use `tests/utils/auth-api-paths.ts`.

### Phone OTP (out of FE scope)

Phone sign-in is **not** exposed in clinozy-fe. If clinozy-be ships `phone-otp` routes later, reintroduce UI behind a new product decision — do not reuse the removed `AuthPhonePanel` without a fresh requirement.

### Docs

- [x] [unified-auth-flows.md](../../reference/unified-auth-flows.md) kept in sync.
- [x] [routes-and-ui.md](../../reference/routes-and-ui.md) route table updated.

---

## FE constants (target state)

```ts
// src/core/config/constants.ts — API_ENDPOINTS.AUTH
EMAIL_OTP_SEND: '/auth/email-otp/send',
EMAIL_OTP_VERIFY: '/auth/email-otp/verify',
PHONE_OTP_SEND: '/auth/phone-otp/send',
PHONE_OTP_VERIFY: '/auth/phone-otp/verify',
VERIFY_EMAIL: '/auth/email/verify',           // family B — verify only
RESEND_VERIFICATION: '/auth/email/resend-verification',
```

---

## Cross-repo rollout order

1. **clinozy-be:** email-otp rename (+ optional magic-link aliases) → regenerate catalog.
2. **clinozy-fe:** flip email OTP paths → contract drift + integration e2e.
3. **clinozy-be:** _(optional future)_ phone-otp routes + SMS pipeline — no FE UI until a new requirement.
4. **Both:** remove deprecated magic-link aliases; legacy `/verify-email` route removed (OTP via `/login` + banner).

---

## Verification

```bash
# clinozy-be
pnpm routes:catalog
pnpm test -- email-otp phone-otp magic-link

# clinozy-fe (../clinozy-be present)
pnpm contracts:drift
pnpm vitest run src/shared/forms/AuthForm src/shared/api/auth-api.test.ts
# Requires clinozy-be on :3000
pnpm test:e2e -- tests/e2e/auth-api.e2e.test.ts
```

---

## Constraints

- No magic-link URLs in email/SMS templates for OTP auth.
- No account enumeration on send (email or phone).
- Login and signup share one UX — backend owns new-vs-returning logic.
- Family A (OTP verify → session) ≠ family B (`/auth/email/verify` → message only).
- FE `/callback` remains OAuth-only.

## Out of scope

- Email/password login and `/auth/signup` password route (separate; register UI deprecated).
- MFA enroll flows (unchanged).
