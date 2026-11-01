# Production readiness — go / no-go

**Status (2026-10-17): No-go for paying clinics.** The app runs in production
(`clinozy-fe.netlify.app`, deployed by GitHub Actions on a release), and every clinic room is
wired to clinozy-be — except the messaging column, which still reads in-memory sample data.
The backend's side of the same list lives in clinozy-be's
`docs/deployment/launch-checklist.md`.

This is the single source of truth for "can we ship?". It complements the
step-by-step [pre-launch checklist](deployment-and-pre-launch.md#pre-launch-checklist)
and the [path-to-production gate](path-to-production.md).

## What's already production-grade

The frontend **shell** is solid:

- Reactive auth layer (in-memory token, single-flight refresh + Web Locks,
  refresh-rotation safety, cross-tab logout, idle + absolute session caps).
- Security: CSP (header + meta + Trusted Types report-only), CSRF header,
  redirect safety, password breach/strength checks, telemetry URL scrubbing,
  reset/verify token containment. See [security-model.md](../reference/security-model.md).
- Quality gates: biome, eslint, tsc, knip, tsdoc budget, token validator,
  structure validator, **SonarQube clean**, colocated unit tests + coverage ratchet,
  E2E (Chromium), patch-coverage, contract-drift, SBOM, gitleaks/semgrep/CodeQL.
- Accessibility: skip links, route announcer, form-error association, focus via
  Radix. Per-route error boundaries, offline support, new-deployment reload.
- Cookie consent gating for analytics.

## Blockers — work to do before launch

### A. Backend & infrastructure

- [x] **clinozy-be deployed** — Railway, production released from a tagged release with a manual
      approval (clinozy-be `release-deploy.yml`).
- [ ] **Messaging delivered.** The chat column reads and writes each contact's stream on
      clinozy-be (`contact-activities-api.ts`); the fixture world under
      `src/shared/api/app/fixtures/` is test support only and `pnpm build:check` fails a build
      that carries it. Messages wait `queued` until clinozy-be's WhatsApp Cloud API client
      delivers them; `REPLACE_WITH_API` marks the remaining spots under `src/shared/api/app`.
- [ ] **Settle the open backend requests** — clinozy-be issue #34 (120 requests: 79 covered,
      40 partial, 1 conflict — the Tasks "Everyone" view).
- [ ] **Confirm the auth contract** (not re-verified 2026-10-17): HttpOnly refresh cookie
      (`SameSite=Lax`+), refresh-session rotation with reuse-detection, `X-Requested-With`
      rejection, CORS for the frontend origin.
- [ ] **Production env / secrets** (not re-verified 2026-10-17) — `VITE_API_BASE_URL` (HTTPS),
      `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`/`HOST`, `VITE_CSP_REPORT_URI`,
      `VITE_PRIVACY_POLICY_URL`, and `config.js` runtime injection per environment.
- [x] **Git remote + CI/CD** — `albetrios/clinozy-fe`; rulesets as code (`pnpm github:sync`).
- [ ] **Custom domain, DNS / TLS.** Only `*.netlify.app` is configured; `netlify.toml` and
      `_headers` carry the security headers.
- [ ] **SRI for `config.js`** — deploy entrypoint must hash the generated file and inject
      `integrity` (see security-model.md accepted-risk #3).

### B. Verify against a real environment

- [ ] Staging smoke against deployed clinozy-be + Netlify preview/production.
- [ ] Lighthouse budgets against real endpoints.
- [ ] Cross-browser E2E — the main suite is Chromium-only (2 cross-browser specs exist);
      validate Safari/Firefox on the screens clinics use most.
- [ ] Real-failure observability: Sentry errors (PII scrubbed) and PostHog **after consent**.
      Product analytics track sign-in and setup (26 events) but no clinic action yet
      (booking, invoice, payment).

### C. Legal / compliance / product

- [ ] **Privacy policy + terms.** Privacy is an external link (`VITE_PRIVACY_POLICY_URL`);
      there is no terms page.
- [ ] **India's DPDP Act** — core duties (notice, consent, security safeguards, breach
      notification, retention) apply from 2027-05-13. Patient consent fields exist; the
      notices and the clinic data-processing agreement do not.
- [ ] **Billing in ₹.** The billing settings are Stripe-based and the plans are priced in USD;
      the owner chose Razorpay in ₹ (2026-10-17), so these screens change with the backend.
- [ ] **Printed invoices and prescriptions** are English-only (Standing deviation of the
      launch iteration).

### D. In-repo gaps closed

- [x] **Cookie consent** — PostHog and Sentry replay / profiling gated behind `ConsentBanner` + `useConsentStore` (claude.com's model: Customize · Reject all · Accept all, Necessary / Analytics); the answer is this browser's, kept in a one-year first-party cookie with its policy version, never cleared by signing out, Global Privacy Control honored, changed from "Privacy choices" or Settings › Account › Privacy; signed-in answers go to the account as a receipt.
- [x] **robots.txt** — `Disallow: /` (auth-gated admin app). A marketing site needs its own host.
- [x] **HTTP-only frontend** — always `apiClient` / `authFetch` → clinozy-be.
- [x] **404 without a console error** (2026-10-17) — the root route hands the router its lazy
      `NotFoundPage` itself, so an unknown or inaccessible clinic slug no longer suspends it
      cold through `use()`.
- [x] This document.

## Go / no-go

**No-go** until **Section A** is complete and **Section B** has been run green
against a deployed API. Section C is required before charging clinics: the legal items are
your product/legal call, and billing in ₹ needs the backend change first.

When A + B are green, run the [path-to-production gate](path-to-production.md):
runbook → pre-launch checklist → release.
