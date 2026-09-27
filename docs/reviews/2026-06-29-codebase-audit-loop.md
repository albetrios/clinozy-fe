# Codebase Audit — rolling loop

Living audit log appended by a `/loop` review (every 10 min, rotating perspective).
**Analysis only — no code is changed by the loop.** Each item: Area · Severity ·
Current (file:line) · Suggestion · Pros (+) · Cons (−). Triage/assign as you go.

Severity scale: Critical > High > Medium > Low > Info.

---

## Iteration 1 — Security overview (2026-06-29)

### 1.1 OAuth start URL is navigated to without client-side origin validation

- **Area:** Auth / open-redirect (defense-in-depth)
- **Severity:** Low–Medium
- **Current:** `src/shared/forms/AuthForm/AuthForm.tsx:109` —
  `const url = await authApi.oauthStart(provider); window.location.assign(url);`.
  The full-page redirect trusts whatever URL the backend returns; there is no
  allowlist check on its origin before navigating.
- **Suggestion:** Validate `url`'s origin against the known IdP/provider origins
  (or at least assert `https:` + a configured allowlist) before `assign`. Reuse
  the spirit of `shared/auth/redirect-safety.ts`.
- **+** Closes an open-redirect/phishing vector if the backend is ever tricked or
  misconfigured; cheap, isolated check.
- **−** Backend is the OAuth broker and already controls this URL, so it's
  belt-and-suspenders; an allowlist needs maintenance as providers change.

### 1.2 `ChartStyle` injects CSS via `dangerouslySetInnerHTML`

- **Area:** XSS / CSS-injection surface
- **Severity:** Low
- **Current:** `src/shared/components/ui/chart.tsx:89` —
  `<style dangerouslySetInnerHTML={{ __html: css }} />` where `css` is built from
  `ChartConfig` color values (`buildThemeCss`). Safe today because configs are
  developer-defined, but the values are interpolated into CSS unescaped.
- **Suggestion:** Document/enforce that chart `config` colors are never sourced
  from API/user input; optionally validate color strings against a
  `^#[0-9a-fA-F]{3,8}$|^(hsl|oklch|rgb)\(` pattern before interpolation.
- **+** Prevents a future CSS-injection (`}</style><script>…`) if a config color
  ever becomes data-driven.
- **−** Vendored shadcn file (churn vs upstream); currently a theoretical risk.

### 1.3 PostHog persists to `localStorage+cookie`

- **Area:** Privacy / analytics
- **Severity:** Low
- **Current:** `src/app/analytics/posthog.ts:57` — `persistence: 'localStorage+cookie'`.
  Consent-gated at init, but confirm that **withdrawing** consent clears the
  PostHog `localStorage`/cookie state (not just stops new capture).
- **Suggestion:** On consent withdrawal call `posthog.opt_out_capturing()` +
  `posthog.reset()` (clears stored distinct_id) and verify the keys are gone.
- **+** Aligns with GDPR "withdraw as easily as give"; avoids stale identifiers.
- **−** None significant; small wiring in the consent flow.

### 1.4 `rel` inconsistency on external `target="_blank"` links

- **Area:** Best practice (tabnabbing)
- **Severity:** Info
- **Current:** `ConsentBanner.tsx:48` uses `rel="noreferrer"`;
  `BillingInvoicesTable.tsx:63` uses `rel="noopener noreferrer"`. Both are safe
  (`noreferrer` implies `noopener`), but the codebase is inconsistent.
- **Suggestion:** Standardize on `rel="noopener noreferrer"` for every external
  `_blank` link (lint rule or a small `ExternalLink` wrapper).
- **+** One obvious correct pattern; reviewers stop re-checking.
- **−** Pure consistency; no behavioural change.

### Verified OK (this pass)

- **Access token is memory-only** — no `localStorage`/`sessionStorage` token
  writes found; only an auto-google skip flag and a `safeRedirect`-validated
  returnTo path use `sessionStorage`. Matches `docs/reference/security-model.md`.
- **`QrCode` `dangerouslySetInnerHTML`** (`QrCode.tsx:95`) is locally-generated
  SVG from the otpauth URI, already documented with a `biome-ignore`. Accepted.

### ✅ Resolved (2026-06-29)

All four findings from this pass are fixed, each with a regression test:

- **1.1** — `isSafeExternalHttpsUrl` added to `shared/auth/redirect-safety.ts`;
  `AuthForm` now rejects a non-`https`/malformed OAuth URL before `assign()`.
  Test: `redirect-safety.test.ts`.
- **1.2** — `lib/css-safe.ts` `isSafeCssColor` allowlist guards the chart
  `<style>` interpolation. Test: `css-safe.test.ts`.
- **1.3** — `purgeAnalyticsOnConsentRevoked()` (opt-out + `reset(true)`, no-op
  unless PostHog was active) wired to the `denied` consent decision.
  Test: `capture-consent-decision.test.ts`. (Note: no withdrawal UI exists yet —
  this is the correct behaviour for when a privacy toggle is added.)
- **1.4** — `ConsentBanner` external link standardized to
  `rel="noopener noreferrer"`. Test: `ConsentBanner.test.tsx`.

---

## Iteration 2 — RBAC & tenancy authorization (2026-06-29)

### 2.1 `requirePermission` reads store permissions without asserting the org matches the route

- **Area:** RBAC / tenancy isolation (latent coupling)
- **Severity:** Medium
- **Current:** `src/core/rbac/guards.ts:48` — `requirePermission` does
  `const { permissions } = useOrganizationStore.getState()` and checks
  `hasPermission({ role, permissions }, …)`. It does **not** assert that
  `store.organizationId` matches the org in the route. Correctness depends
  entirely on an earlier guard (`requireOrganizationContext` →
  `ensurePermissionsFor`) having synced the right org's permissions first.
- **Suggestion:** Pass the expected org id into the permission gate (or read it
  from gate context) and fail closed when `store.organizationId` differs —
  mirroring the FE-52 slug check already in `requireActiveOrganization`.
- **+** Removes a silent cross-tenant authorization risk if guards are ever
  reordered/omitted; makes the gate self-contained and unit-testable in isolation.
- **−** Slightly more plumbing (org id into the gate); duplicates a check the
  chain already guarantees today.

### 2.2 `ensurePermissionsFor` keeps stale permissions on a failed cross-org refetch

- **Area:** Tenancy / fail-closed
- **Severity:** Low–Medium
- **Current:** `src/shared/tenancy/organization-membership.ts:72` —
  `if (permissionsLoadedFor === organizationId && store.permissions.length > 0) return; store.setPermissions(await getMyPermissions()); permissionsLoadedFor = organizationId;`.
  On a cross-org navigation the previous org's `permissions` stay in the store
  until the `await` resolves; if `getMyPermissions()` **throws**, the store still
  holds the prior org's permissions and `permissionsLoadedFor` still points at it.
  (Happy path is safe — the chain awaits this before `requirePermission`.)
- **Suggestion:** When `organizationId` differs, clear `permissions` +
  `permissionsLoadedFor` _before_ the fetch, and only set `permissionsLoadedFor`
  after a successful `setPermissions` (already true) — so a failure leaves an
  empty (deny-all) set rather than another org's grants.
- **+** Guarantees fail-closed on a permission-fetch error; no cross-tenant grant
  survives a failed switch.
- **−** A transient empty-permissions flash could 403 a legitimate user mid-load
  (mitigated since the fetch error already surfaces an error boundary).

### 2.3 `super_admin` god-mode trusts the in-memory role

- **Area:** RBAC / client trust boundary (defense-in-depth)
- **Severity:** Low
- **Current:** `src/core/rbac/policies.ts:36` — `if (ctx.role === 'super_admin') return true;`.
  `role` comes from the in-memory auth store (set from the backend token). A
  tampered in-memory role would pass every **client-side** permission check.
- **Suggestion:** Keep it (UI gating is UX only; the backend re-checks), but
  document it as an explicit accepted risk in `security-model.md` and ensure no
  _destructive_ action relies on this client check alone without a server 403 path.
- **+** Confirms the client RBAC is non-authoritative by design; cheap to document.
- **−** None; purely a clarity/assurance note.

### 2.4 Empty-list asymmetry in `hasAllPermissions` / `hasAnyPermission`

- **Area:** RBAC API footgun
- **Severity:** Info
- **Current:** `src/core/rbac/policies.ts:46,59` — `hasAllPermissions([])` is
  vacuously `true`; `hasAnyPermission([])` is `false`. A component/route that
  computes a permission list dynamically and lands on `[]` could accidentally
  authorize via the `All` variant.
- **Suggestion:** Document the asymmetry at the call sites, or add a dev-time
  warning when an empty list is passed to `hasAllPermissions`.
- **+** Prevents an accidental "allow when no permissions required" path.
- **−** Marginal; no current caller passes a dynamic empty list.

### Verified OK (this pass)

- **Guard ordering is correct** — the `$organizationSlug` layout's `beforeLoad`
  runs `requireOrganizationContext` (which `await`s `ensurePermissionsFor`)
  before the child route's `requirePermission`, so the happy path has no stale
  permission window.
- **Default-deny gateway** — `gatewayFromPolicy` always pushes `requireSession`;
  a route that forgets a permission still fails closed (authenticated, not open).
- **`requireActiveOrganization` fails closed** on slug mismatch (FE-52).

### ✅ Resolved (2026-06-29)

All four findings fixed, each with a regression test:

- **2.1** — `requirePermission` takes `expectedOrgSlug`; `requirePermissionGate`
  binds it from `ctx.params.organizationSlug` and fails closed on a tenant
  mismatch. Tests: `guards.test.ts`, `require-permission.test.ts`.
- **2.2** — `ensurePermissionsFor` clears the prior org's grants before a
  cross-org refetch, so a failed switch leaves an empty deny-all set.
  Test: `organization-membership.test.ts`.
- **2.3** — documented as accepted risk #5 in `docs/reference/security-model.md`
  (client RBAC is non-authoritative; backend re-checks). super_admin behaviour
  is already test-locked in `policies.test.ts` / `guards.test.ts`.
- **2.4** — `hasAllPermissions([])` now emits a dev-only warning about the
  vacuous-true footgun. Test: `policies.test.ts`.

---

## Iteration 3 — HTTP client & auth-token resilience (2026-06-29)

### 3.1 429 auto-retry ignores `Retry-After` and pre-empts the RateLimitNotice

- **Area:** HTTP / rate-limit handling
- **Severity:** Medium
- **Current:** `src/core/http/fetch-client.ts:134` — `shouldRetry` returns `true`
  for **every** 429 (all methods), and `doOne` (`:238`) retries using
  `exponentialDelay(retryCount)` — the **server's `Retry-After` header is never
  read**. So the client retries up to `MAX_RETRIES` on its own clock (1s→2s→4s)
  before surfacing the error, likely re-hitting the limit, and delaying the
  `RateLimitNotice` UX that is meant to show 429s to the user.
- **Suggestion:** Either don't auto-retry 429 at all (surface immediately to
  `RateLimitNotice`), or honor `Retry-After` (capped) instead of exponential
  backoff. At minimum, cap 429 retries to 1.
- **+** Stops the client amplifying rate-limit pressure; users see the
  retry-after countdown sooner; respects server intent.
- **−** Read paths lose a transparent auto-recovery on transient 429s; needs the
  `Retry-After` parse (already available via `getRateLimitRetryAfterSeconds`).

### 3.2 Network-retry and status-retry are separate loops → retry budget can be exceeded

- **Area:** HTTP / resilience (load amplification)
- **Severity:** Low–Medium
- **Current:** `fetch-client.ts:187` — `attemptFetch` retries **network** errors
  on its own `retryCount` recursion; `doOne` (`:219`) retries **5xx/429** by
  calling `doOne(retryCount + 1)` → a fresh `attemptFetch`. The two loops both
  key off `retryCount` but are independent, so a request that mixes network +
  5xx failures can issue more than `MAX_RETRIES` attempts (worst case ≈
  `(MAX_RETRIES+1)²`).
- **Suggestion:** Track a single total-attempt counter (or a deadline budget)
  threaded through both paths so retries are globally bounded.
- **+** Predictable, bounded outbound load against a failing/slow backend.
- **−** Small refactor of the retry recursion; needs tests for the mixed
  network-then-5xx case.

### 3.3 Timeouts (`AbortError`) are retried like connection errors

- **Area:** HTTP / latency
- **Severity:** Low
- **Current:** `fetch-client.ts:197` — `err.name === 'AbortError'` (the
  `fetchWithTimeout` deadline) is classed as `isNetworkError` and retried for
  idempotent methods. A slow endpoint therefore burns `timeout × attempts` plus
  backoff before failing (compounded by 3.2).
- **Suggestion:** Distinguish a timeout from a connection error; retry timeouts
  fewer times (or not at all) and/or enforce an overall request deadline.
- **+** Faster, more predictable failure on a degraded endpoint; less piled
  latency for the user.
- **−** Loses a retry that occasionally recovers a one-off slow response.

### 3.4 Response envelope is cast, not validated, at the HTTP boundary

- **Area:** Input validation / type-safety (HTTP layer)
- **Severity:** Low
- **Current:** `fetch-client.ts:57,276` — `isEnvelope` only checks that a `data`
  key exists; the payload is then returned as `parsed.data as T` — an unchecked
  cast. Runtime correctness depends entirely on each caller doing `schema.parse`
  (some do, some don't).
- **Suggestion:** Keep per-endpoint Zod `parse` on security/integrity-critical
  reads (the documented convention) and add a lint/CI note; optionally accept an
  optional schema in the client for opt-in validation.
- **+** Closes the gap where a drifted server shape silently flows in as the
  wrong TS type.
- **−** Per-endpoint Zod has a (small) runtime cost; a generic client schema hook
  adds API surface.

### Verified OK (this pass)

- **401 refresh is loop-safe** — single-flight `refreshAccessToken` + one replay;
  a second 401 after a fresh token → `forceLogout` (`:226`), never a refresh loop.
- **Idempotency-Key is minted once per logical request** (`:185`) and reused
  across retries + the post-refresh replay, so the server can de-dupe writes.
- **Timeout handle is cleared in `finally`** (`:99`) — no dangling timer.
- **POST/PATCH are not retried on 5xx** (not in `IDEMPOTENT_METHODS`) — safe
  default even though the idempotency key would technically allow it.

### ✅ Resolved (2026-06-29)

3.1–3.3 fixed by unifying the retry path in `fetch-client.ts` (one `run` loop
with a single attempt budget; success-body parsing extracted to `parseJsonBody`).
Each with a regression test in `fetch-client.test.ts`:

- **3.1** — `nextRetryDelay` honors `Retry-After` for a 429, at most once and
  only within `HTTP.MAX_RETRY_AFTER_MS` (5s); otherwise surfaces to
  `RateLimitNotice` immediately. Tests: 429 with/without/over-cap Retry-After.
- **3.2** — connection-error and bad-status retries now share one `attempt`
  counter, so total attempts are bounded by `MAX_RETRIES + 1`. Test: mixed
  connection + 5xx failures stay within budget.
- **3.3** — `classifyFetchError` distinguishes `timeout` (AbortError) from
  `connection`; timeouts are no longer retried. Test: AbortError → single call.
- **3.4** — left as a convention note (per-endpoint Zod `parse` stays the guard);
  no code change.

---

## Iteration 4 — React purity & state correctness (2026-06-29)

### 4.1 Data-table URL state is seed-once → back/forward doesn't restore the view

- **Area:** React state / URL as source-of-truth
- **Severity:** Low–Medium
- **Current:** `src/shared/hooks/useDataTableUrlState/useDataTableUrlState.ts:55`
  — `initialSorting` is memoized on `[enabled]` only (URL `search.sort`
  deliberately excluded), and `initialPageIndex/Size` (`:70`) feed TanStack
  Table's `initialState`, which the table reads **once** at mount. So a deep
  link works, but an in-session URL change (browser back/forward, or another
  control editing `?sort=`/`?page=`) does **not** update the table — the table
  becomes the source of truth after mount and the URL only flows one way out.
- **Suggestion:** Either make the table controlled (drive `state` from the URL
  each render, not just `initialState`), or add a keyed remount / effect that
  re-syncs table state when the relevant search params change.
- **+** Back/forward and shared in-app links restore the exact table view;
  removes the seed-vs-source ambiguity.
- **−** Controlled tables are more wiring and re-render on each URL patch; risk of
  a write→URL→read loop if not de-duped.

### 4.2 `new Date()` is called during render

- **Area:** React purity
- **Severity:** Low
- **Current:** `DashboardHero.tsx:64`
  (`new Date().toLocaleDateString(...)`) and
  `AppLayout/variants/AppLayoutSidebar.tsx:113`
  (`new Date().getFullYear()`) read the clock **in render** — impure, recomputed
  on every render, and not reactive (won't roll over at midnight without an
  unrelated re-render).
- **Suggestion:** Compute once (module-level for the year, `useMemo` for the
  date) or, if a live date is wanted, a small `useNow`-style hook.
- **+** Pure render; the React Compiler can memoize the subtree; no surprise
  recompute.
- **−** Trivial gain; a midnight-accurate date needs an explicit timer anyway.

### 4.3 Stripe return params are read imperatively in a mount effect, not via the router

- **Area:** React state / effects
- **Severity:** Low
- **Current:** `AccountBillingPanel.tsx:99` and
  `BillingPaymentMethods/BillingPaymentMethods.tsx:76` read Stripe redirect
  params from `window.location` inside a `[]` effect and `setState`
  (the two `react-hooks/set-state-in-effect` suppressions). They consume-once via
  `clearStripeBillingReturnParams()`, but bypass the router's typed `search`.
- **Suggestion:** Read the return params from the route's `validateSearch`
  schema (typed, testable) and derive the panel state from it, clearing via a
  `navigate({ search })` instead of imperative URL mutation.
- **+** Removes the imperative `window.location` read + the effect-setState
  pattern; one source of truth for URL state; unit-testable without globals.
- **−** Needs the billing route search schema to model the Stripe return params;
  a bit more route plumbing.

### 4.4 `initialFilters` recomputes on every search change but is consumed once

- **Area:** React / dead work
- **Severity:** Info
- **Current:** `useDataTableUrlState.ts:61` — `initialFilters` is memoized on
  `[enabled, search.q, search.role]`, so it recomputes whenever those params
  change, yet TanStack Table only reads `initialState` at mount. The
  recomputation has no effect after mount (and misleadingly _looks_ like it
  re-syncs, unlike the deliberately-frozen `initialSorting`).
- **Suggestion:** Memoize on `[enabled]` for consistency with `initialSorting`
  (and resolve 4.1 if real re-sync is wanted).
- **+** Removes confusing dead recomputation; consistent seeding story.
- **−** None; purely a clarity fix.

### Verified OK (this pass)

- **`RateLimitNotice` reset-on-prop** uses the render-time "adjust state on prop
  change" pattern (fixed earlier), not a `setState`-in-effect cascade.
- **`react-hooks/incompatible-library` suppressions** on `MembersTable` /
  `InvitationsTable` are legitimate — TanStack Table returns intentionally
  non-memoizable callbacks; not a bug.
- **`new Date().toISOString()` in `RecoveryCodesPanel`** is inside a
  download-builder invoked from a click handler, not render — correct.

### Partly resolved (2026-06-29)

- **4.2 — FIXED.** `DashboardHero` reads the date once via `useMemo([])`;
  `AppLayoutSidebar` hoists the copyright year to a module constant
  (`CURRENT_YEAR`). No more `new Date()` in render.
- **4.1 — DRAFTED then REVERTED.** A render-time reset keyed on a URL search
  signature was implemented, but it could not be reliably regression-tested under
  the jsdom + memory-router harness (`router.navigate` updated
  `router.state.location.search`, yet `useSearch({ strict: false })` did not
  re-render the table in-test). Rather than ship a behaviour-changing fix that
  can't be verified, it was reverted. **Still open** — revisit with a fully
  controlled table (drive `state` from the URL each render) plus a router-mocked
  unit test, or an e2e back/forward test.
- **4.3, 4.4 — OPEN.** Left as documented findings (no code change this pass).

---

## Iteration 5 — Scalability & data-layer (high-signal pass) (2026-06-29)

### 5.1 Every list endpoint fetches the whole collection; tables page/sort/filter client-side

- **Area:** Scalability / data layer
- **Severity:** High
- **Current:** `src/shared/api/organization-api.ts:112` — `listMembers(): Promise<Member[]>`
  does `GET /memberships` with **no `page`/`size`/`sort`/`q`** params and returns
  the entire array; same shape for `listInvitations` (`:187`), `listRoles`
  (`:239`), `listApiKeys` (`:295`), `listSessions`, `listWebhooks`. The hooks
  (`useMembers`, …) `useQuery` the full array, and `MembersTable` /
  `InvitationsTable` use TanStack's **client-side** `getPaginationRowModel` +
  `getFilteredRowModel` + `getSortedRowModel`. So the whole dataset is downloaded,
  Zod-parsed, held in memory, and paged/sorted/filtered in the browser — even
  though the HTTP client already surfaces `meta.pagination` (cursor) that nothing
  consumes, and `useDataTableUrlState` writes `page/size/sort/q` to the URL that
  the server never sees.
- **Suggestion:** Move to **server-driven** pagination/sort/filter: pass the URL
  params to the API, consume `meta.pagination` (cursor) via `useInfiniteQuery` or
  manual paging, and switch the tables to `manualPagination/manualSorting/
manualFiltering`. The URL state plumbing already exists — wire it through.
- **+** Payload, memory, parse time, and interaction latency become **bounded**
  (one page) regardless of org size; first render is fast; the URL params and the
  `meta.pagination` contract become real; mutations refetch one page, not 50k rows.
- **−** Requires paged/sorted/filtered list endpoints on the backend; more query
  state; loses "instant" client-side sort/filter on small sets (mitigate with a
  small-N fast path).
- **Edge case / scale trigger:** An org with thousands–tens-of-thousands of
  members/invitations. One request downloads the entire set, Zod-parses the whole
  array on the response path, and the browser sorts/filters/paginates it in
  memory — all **O(n)**. **Worse:** each optimistic mutation calls
  `invalidateQueries`, which **re-downloads and re-parses the entire collection**,
  so every add/remove/role-change triggers a full-list refetch storm at scale.

### 5.2 The whole-collection Zod `.parse` runs synchronously on the response path

- **Area:** Performance / robustness
- **Severity:** Medium
- **Current:** `organization-api.ts:113` —
  `z.array(membershipWire).parse(res.data).map(toMember)` validates and maps the
  **entire** array synchronously before the promise resolves. Combined with 5.1
  (fetch-all), this is O(n) main-thread work, and `.parse` is **all-or-nothing**:
  one malformed row rejects the whole list (a member page fails to render because
  of a single bad record).
- **Suggestion:** With server pagination (5.1) each parse is page-bounded. Beyond
  that, consider `safeParse` per page with telemetry on drift, and per-row
  tolerance (drop + log a bad row rather than fail the page) for resilience.
- **+** Bounded validation cost; one corrupt row no longer blanks the table.
- **−** `safeParse` + per-row tolerance changes error semantics and needs a
  documented policy (when to drop vs surface).
- **Edge case / scale trigger:** Large list response → multi-millisecond
  synchronous parse/map blocking interaction; or a single shape-drifted row from
  the backend taking down the entire list view.

### Verified OK (this pass)

- **Cursor pagination contract exists** end-to-end in the HTTP client
  (`meta.pagination`: `next`, `has_more`, `estimated_total`) and is surfaced on
  `HttpResponse.meta` — the plumbing for 5.1 is already there, just unused.

### Status (2026-06-29)

- **5.2 — FIXED.** New `lib/parse-list-tolerant.ts` parses list rows with
  per-row `safeParse`: valid rows render, malformed rows are dropped and
  `console.warn`-ed (captured by Sentry's `captureConsoleIntegration`). Wired
  into all 7 list fetchers (`listMembers/Invitations/Roles/ApiKeys/Sessions/
Webhooks/Notifications`). One bad record no longer blanks a whole table.
  Test: `parse-list-tolerant.test.ts`.
- **5.1 — FIXED (cursor-follow), with a documented ceiling.** Read the backend
  contract from `../clinozy-be`: every org list uses `cursorPaginationSchema`
  (`?after=<opaque cursor>&limit=<=100`, **default 25**) and is `.strict()` with
  **no server-side sort/filter**. So the FE was **silently truncating to the
  first 25 rows** (a real correctness bug, not just scale). New
  `shared/api/fetch-all-pages.ts` follows `meta.pagination.next` until
  `has_more` is false (limit=100, 50-page safety cap, tolerant parse). Wired into
  `listMembers/Roles/ApiKeys` (organization-api), `listWebhooks`,
  `listNotifications`. Test: `fetch-all-pages.test.ts`. The client tables stay
  exactly as-is (the backend can't take over sort/filter), so the O(n)-in-browser
  ceiling remains a **backend limitation** (no server sort/filter) — true
  windowed pagination would require adding those server-side. **Not changed:**
  `listInvitations` (no list route/DTO found in clinozy-be — needs verification
  before paging), `listMyOrganizations` (different mapper, small N), `sessions`
  (returns all, not cursor-paged).

---

## Iteration 6 — Tenancy cache isolation & concurrency (high-signal) (2026-06-29)

### 6.1 Org-scoped query keys omit the org id → cross-tenant cache collision on switch

- **Area:** Robustness / multi-tenant data integrity
- **Severity:** High (arguably Critical — another tenant's data renders in the UI)
- **Current:** `src/shared/api/organization-query-keys.ts:12` —
  `members: () => ['organization', 'members']` (same for `invitations`, `roles`,
  `apiKeys`); `useWebhooks.ts:9` — `['org', 'webhooks']`; `billing-query-keys.ts:6`
  — `['billing']`. **None include the active organization id.** Meanwhile
  `switchToOrganization` (`src/shared/tenancy/switch.ts:64`) swaps the active-org
  token + store but does **not** clear these caches, the global default
  `staleTime` is **5 minutes** (`constants.ts:42`), and the only `queryClient.clear()`
  is on **logout** (`shared/auth/service.ts:50`). Org-scoped data queries are
  invalidated **only by their own mutations**, never on switch.
- **Effect:** After switching from org A → org B (URL nav → `switchToOrganization`),
  org B's members/roles/api-keys/webhooks tables read the cache key
  `['organization','members']`, find **org A's rows still marked fresh**
  (staleTime not elapsed), and render them with **no refetch** — showing one
  tenant's data under another for up to 5 minutes.
- **Suggestion:** Make the keys org-scoped — `members(orgId)` →
  `['organization', orgId, 'members']` (thread the active org id from
  `useOrganizationStore`); OR, minimally, `queryClient.removeQueries({ queryKey:
['organization'] })` (+ `['org']`, `['billing']`) inside `switchToOrganization`.
- **+** Eliminates cross-tenant leakage; org-keyed caches also make switching
  _back_ to org A instant (its own fresh entry) instead of a refetch.
- **−** Org-keyed keys touch every call site + invalidation; the `removeQueries`
  shortcut is one line but drops all org cache on every switch (extra refetches).
- **Edge case / scale trigger:** Any user who belongs to ≥2 orgs and switches
  between them within the 5-minute stale window — the more orgs/tenants per user,
  the more often it bites. Most dangerous for members/api-keys (sensitive rows).

### Verified OK (this pass)

- **Logout** fully clears the cache (`queryClient.clear()`), so cross-tenant
  bleed cannot survive a re-login.
- **Within a single org**, mutations correctly invalidate their list
  (`useMembers` `onSettled` → `invalidateQueries(orgQueryKeys.members())`).
- **User-scoped** lists (`sessions`, `passkeys`, notifications) are not org-keyed
  and are correctly unaffected by org switching.

### ✅ Resolved (2026-06-29)

- **6.1 — FIXED at the switch chokepoint.** `switch.ts` now calls
  `clearActiveOrgQueryCache()` in both `switchToOrganization` and
  `switchToPersonal`, doing `queryClient.removeQueries` for `['organization']`,
  `['org']`, and `['billing']` whenever the active org changes. Uses
  `removeQueries` (not `invalidate`) so the previous tenant's rows are **deleted**
  — the new org refetches from scratch instead of briefly rendering stale
  cross-tenant data. Every active-org change funnels through these two functions,
  so isolation is guaranteed regardless of the un-org-keyed keys. Tests in
  `switch.test.ts` seed members/api-keys/webhooks/billing caches and assert they
  are gone after a switch (and that `me-context` survives). A further structural
  enhancement (org-id IN the keys, for instant switch-back) is noted but not
  required for correctness.

---

## Iteration 7 — Converged (2026-06-29)

**No remaining Critical/High findings; further passes are diminishing returns.**

This pass swept robustness + performance + a11y + maintainability and found them
well-handled — only low-severity nitpicks remain:

- **Error handling:** every settings panel uses `QueryBoundary` _or_ inline
  `isError`, under a section-level `SectionErrorBoundary`, with global
  `QueryCache.onError` / `MutationCache.onError` — failures are contained.
- **Effect/listener/timer cleanup:** `idle-timeout`, `useThemeStore`,
  `version/check`, `InvisibleTurnstile` all use `AbortController` signals,
  `clearInterval`, or one-shot singletons — no leaks.
- **Global store subscriptions** (Sentry/PostHog/icon-registry) are init-guarded
  app-lifetime singletons, not per-render accumulation.
- **A11y:** the custom Appearance/Language dialogs are correctly non-modal
  popovers (`role="dialog"`, `aria-modal="false"`, labelled, Esc/outside-click).
- Residual nitpicks (e.g. `AppearancePanel.tsx` ~955 lines could be split) are
  below the Critical/High bar this loop targets.

The Critical/High issues this loop surfaced (5.1 list truncation, 5.2 brittle
parse, 6.1 cross-tenant cache) are **fixed with tests**. Recurring audit loop
stopped here. Re-run a targeted pass after major feature work.

---
