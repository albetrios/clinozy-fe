# Routes and page islands — clinozy-fe

Claude Code loads this file when it works in `src/pages/`. It holds sections moved out of the root [`CLAUDE.md`](../../CLAUDE.md), which keeps a pointer to each; the root rules apply here too.

## Route Marker Convention (`<page>.route.tsx`)

Every directory under `src/pages/` that corresponds to a frontend URL path **must** contain a **`<page>.route.tsx`** file (page-prefixed, lowercase-dotted). This file is the boundary between routes.

**The rule in five lines (read this first):**

1. **`src/pages/` mirrors the URL tree 1:1.** `/login` → `pages/login/`; `/organization/acme/today` → `pages/organization/$organizationSlug/today/`. Children nest **directly** (no `sub-pages/` bucket); dynamic segments are `$param` folders — except a **param-only leaf**, which owns the param in its route path instead of a `$param/` folder (`accept-invite/` owns `/accept-invite/$invitationId` flat because the parent segment has no page of its own). Exceptions: `/` is a pure resolver route (redirect only, no island), and so is the retired `/dashboard` (a redirect to `/`); app-shell routes with no feature island — `/unauthorized` and the `$` 404 splat (`UnauthorizedPage`/`NotFoundPage`) — live in `src/app/routes/`, not `src/pages/`.
2. **Every page folder maintains the same 4 files** — `<page>.route.tsx`, `<page>.manifest.ts`, `<Page>Page.tsx` (or `Layout`), `<PAGE>.OVERVIEW.md` — plus 2 registrations: `routeTree.tsx` and `docs/reference/routes-and-ui.md`. In `$param` folders the prefix derives mechanically: strip `$`, kebab-case (`$organizationSlug/` → `organization-slug.route.tsx`, `ORGANIZATION_SLUG.OVERVIEW.md`).
3. **Page shells live in `shared/layouts/`** — AuthLayout via the pathless `auth-shell` route; AppLayout via the `pages/organization/$organizationSlug/` layout island (the org guard boundary). No grouping directories under `pages/`.
4. **Code used by 2+ page islands lives in `shared/`** (e.g. `shared/api/auth-api.ts`, `shared/tenancy/`).
5. **Settings is a global hash modal, not a route space** — `#settings/<scope>/<section>` opens `shared/components/SettingsModal/` over any page (see `agent-os/rules/fe-file-structure.mdc` → Settings hash modal). Full spec: `docs/reference/routing-and-tenancy.md`.

**Source of truth for what is live today:** [`src/app/routes/routeTree.tsx`](../../src/app/routes/routeTree.tsx) and [`docs/reference/routes-and-ui.md`](../../docs/reference/routes-and-ui.md). The tree below mixes **implemented** routes with **common examples** (same shapes as new features).

```text
src/pages/
├── login/                           ← /login (AuthLayout via pathless auth-shell)
│   ├── login.route.tsx
│   ├── login.manifest.ts                ← manifest
│   ├── LoginPage.tsx                ← top-level UI
│   ├── LOGIN.OVERVIEW.md
│   └── forms/LoginForm/             (folder-per-unit)
├── mfa/                             ← /mfa (AuthLayout via auth-shell)
├── callback/
│   └── callback.route.tsx           ← /callback (one URL for every OAuth provider)
├── onboarding/   accept-invite/
└── organization/
    ├── organization.route.tsx       ← /organization (picker)
    ├── organization.manifest.ts
    ├── OrganizationPickerPage.tsx
    └── $organizationSlug/             ← /organization/acme — org guard boundary
        ├── organization-slug.route.tsx     ($param folder → strip-$ kebab prefix)
        ├── organization-slug.manifest.ts       kind: 'layout', children: [suspended, today, …]
        ├── OrganizationLayout.tsx        mounts shared AppLayout
        ├── ORGANIZATION_SLUG.OVERVIEW.md
        ├── today/                   ← …/today — full island; the role home for most roles (D25)
        ├── suspended/               ← …/suspended — status-guard target
        └── patients/                ← (example) future islands nest directly: patients/$patientId/…
```

### Page Directory Shape (route island)

Every route uses a **route island** ([`agent-os/skills/fe-route-island/SKILL.md`](../../agent-os/skills/fe-route-island/SKILL.md), [`docs/reference/route-island-structure.md`](../../docs/reference/route-island-structure.md)). Layout parents nest children **directly** as `<segment>/` (or `$param/`). **`<page>.manifest.ts`** is the layout + leaf manifest; top-level UI is `<Page>Page.tsx` / `<Page>Layout.tsx` at island root; tests are colocated next to source (sub-units use folder-per-unit).

The full page directory shape — every mandatory and optional file and folder of an island, with what each holds — is in one place: **[`docs/reference/route-island-structure.md`](../../docs/reference/route-island-structure.md)** (procedure: [`agent-os/skills/fe-route-island/SKILL.md`](../../agent-os/skills/fe-route-island/SKILL.md)). Read it before adding or reshaping a page.

### `<page>.route.tsx` Contract

```tsx
// Every <page>.route.tsx must export Component (required).
// Optional exports: ErrorBoundary (only if wired in routeTree — rare).
// Do NOT export loader() for RBAC — routeTree beforeLoad + gatewayFromManifest
// are the single enforcement point (lazyRouteComponent loads Component only).

import { DashboardPage } from './DashboardPage.tsx';

export function Component() {
  return <DashboardPage />;
}
```

Protected routes register access in `routeTree.tsx`:

```tsx
beforeLoad: async ({ location, params, preload }) => {
  if (preload) return;
  await gatewayFromManifest(dashboardManifest)(toGateContext(location, params));
},
```

### Dialog vs Full Page Decision

- **Full page**: a new directory with `<page>.route.tsx`.
- **URL-driven dialog** (Create/Edit on resource pages): a direct child `<segment>/<segment>.route.tsx` that renders `null`; the parent list page reads URL and opens the matching dialog.
- **Action dialog** (no URL needed, e.g., delete confirm): inline `AlertDialog`, no `route.tsx`.
- Rule: Everything between two `<page>.route.tsx` files belongs to the parent.

### CRUD URL convention (resource pages)

| Action | URL                     | Renders              |
| ------ | ----------------------- | -------------------- |
| List   | `/<resource>`           | Page                 |
| Create | `/<resource>/create`    | Dialog over list     |
| Show   | `/<resource>/[id]`      | Page or dialog       |
| Edit   | `/<resource>/[id]/edit` | Dialog over list     |
| Delete | (no URL)                | Inline `AlertDialog` |
