# Production readiness — go / no-go

**Status (2026-06):** The frontend **always calls HTTP** (Vite proxies `/api` → **clinozy-be** on `:3000`).
There is **no alternate API path** — one backend, one contract.

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

### A. Backend & infrastructure (owned by your team — not fixable in this repo)

- [ ] **Deploy clinozy-be** (or API with the same contract) and replace any remaining
      placeholder data (`dashboard.placeholder-data.ts`) with live endpoints.
      `pnpm contracts:drift` checks the committed route catalog — re-verify against the
      running server.
- [ ] **Confirm the auth contract:** HttpOnly refresh cookie (`SameSite=Lax`+), refresh-session
      rotation with reuse-detection, `X-Requested-With` rejection, CORS for the frontend origin.
- [ ] **Set production env / secrets** — `VITE_API_BASE_URL` (HTTPS),
      `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`/`HOST`, `VITE_CSP_REPORT_URI`,
      `VITE_PRIVACY_POLICY_URL`, and `config.js` runtime injection per environment.
- [ ] **Create the git remote + push** if not done — activates CI/CD, CodeQL, Dependabot,
      branch-protection rulesets (`pnpm github:sync`).
- [ ] **DNS / TLS / host.** Netlify config exists (`netlify.toml`, `_headers`);
      confirm HTTPS, security headers, and multi-tenant subdomains (if used).
- [ ] **SRI for `config.js`** — deploy entrypoint must hash the generated file and inject
      `integrity` (see security-model.md accepted-risk #3).

### B. Verify against a real environment

- [ ] Staging smoke against deployed clinozy-be + Netlify preview/production.
- [ ] Lighthouse budgets against real endpoints.
- [ ] Cross-browser E2E — suite is Chromium-only; validate Safari/Firefox if required.
- [ ] Real-failure observability: Sentry errors (PII scrubbed) and PostHog **after consent**.

### C. Legal / compliance / product

- [ ] **Privacy policy + terms** (`VITE_PRIVACY_POLICY_URL`; consent banner links when set).
- [ ] Confirm consent model fits your jurisdiction.
- [ ] **Dashboard placeholder** — replace `dashboard.placeholder-data.ts` widgets with real APIs before launch if dashboard is in scope.

### D. In-repo gaps closed in prior waves

- [x] **Cookie consent** — PostHog gated behind `ConsentBanner` + `useConsentStore`.
- [x] **robots.txt** — `Disallow: /` (auth-gated admin app).
- [x] **HTTP-only frontend** — always `apiClient` / `authFetch` → clinozy-be.
- [x] This document.

## Go / no-go

**No-go** until **Section A** is complete and **Section B** has been run green
against a deployed API. Sections C/D are launch-quality items; C is your
product/legal call.

When A + B are green, run the [path-to-production gate](path-to-production.md):
runbook → pre-launch checklist → release.
