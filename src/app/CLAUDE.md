# Routing — clinozy-fe

Claude Code loads this file when it works in `src/app/`. It holds sections moved out of the root [`CLAUDE.md`](../../CLAUDE.md), which keeps a pointer to each; the root rules apply here too.

## Routing

- All routes are lazy loaded via `route.tsx` files.
- Route config lives in `src/app/routes/routeTree.tsx`.
- Protected routes use TanStack Router `beforeLoad` guards in `routeTree.tsx` — the `$organizationSlug` shell runs `requireAuth → requireTeamDeployment → requireProvisionedWorkspace → resolveActiveOrg` (context sync from the URL); leaf routes then run `gatewayFromManifest` (session → module → permission) followed by `requireOrgStatus`; see `src/app/guards/GUARDS.OVERVIEW.md`.
- RBAC enforcement in `routeTree.tsx` `beforeLoad` via `gatewayFromManifest(manifest)` (+ tenancy guards).
- **Pending policy has two phases, not a list of routes.** `BOOT_PENDING_POLICY` (pending component at once, **no** 500ms minimum) until the first navigation resolves — the pending component holds the HTML splash, so every cold URL is one continuous screen — then `IN_APP_PENDING_POLICY` (keep the current screen ≤ 3s, 500ms minimum). No route sets `pendingMs`/`pendingMinMs`. **A workspace switch is the one exception to "keep the current screen"** — `WorkspaceSwitchOverlay` covers the viewport for the hop, because the screen underneath belongs to the workspace being left and is about to be wrong, not merely stale. Ordinary navigation keeps `RouteProgressBar` and nothing else. While `/auth/refresh` is in flight, `preloadBootRoutes()` warms the destination's chunks, steered by `hasSessionHint()` — a **hint that never authorizes**.
- **Settings lives in the hash, so two things follow.** (1) A same-route `navigate({ to: '.' })` must **state the hash** — the router resolves an omitted `hash` to none, which closes the modal (`hash: true` keeps it, `hash: ''` clears it on purpose; ESLint rejects neither). Stripe's return params are cleared through `stripeReturnCleanupNavigation()`. (2) The modal decides nothing — and canonicalizes nothing — until it has **both** answers: me/context _and_ the permission set (`useAccessResolved()`); an empty **unresolved** list is "not known yet", never "not allowed". Spec: `docs/reference/routing-and-tenancy.md` §7.
- Every manifest-backed route sets `head: manifestHead(manifest)` (`lib/routes/page-head.ts`) — app-shell routes without a manifest (`/unauthorized`, the `$` 404 splat) use inline `composePageTitle`; the document
  title comes from `manifest.title` as `` `<title> · <PRODUCT_NAME>` `` (`APP_TITLE = PRODUCT_NAME`); the root-mounted
  `RouteAnnouncer` announces it to screen readers on SPA navigations.
