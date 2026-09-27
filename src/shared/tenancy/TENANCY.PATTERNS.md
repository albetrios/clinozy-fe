# `src/shared/tenancy/` — Patterns

The recurring idioms of the tenancy runtime. A new file in this area is expected
to follow these. Companion tiers:
[OVERVIEW](./TENANCY.OVERVIEW.md) · [FLOWS](./TENANCY.FLOWS.md) ·
[POLICIES](./TENANCY.POLICIES.md). Convention:
[`docs/reference/documentation-tiers.md`](../../../docs/reference/documentation-tiers.md).

## URL is the source of truth; the store is a derived cache

**Idiom:** inside `/organization/$organizationSlug/*` the route param is
canonical. `useOrganizationStore` is synced _from_ the route
(`syncOrganizationFromRoute`), never the other way around.
**Why:** one authority means back/forward, deep links, and multi-tab all agree
without reconciliation. The `/` resolver's redirect choice comes from me/context; a
subdomain only seeds a boot-time store fallback — never the in-app active org, which the
URL owns.
**Applies to:** anything that reads or changes the active org — read the param /
`me/context`, don't write the store as a side channel.

## Org identity is baked into every server-state key

**Idiom:** org-scoped TanStack Query keys carry the active org id —
`['organization', orgId, …]`, `['org', orgId, …]`, `['billing', 'org', orgId, …]`.
**Why:** two tenants then physically cannot share a cache entry, so a switch needs
no purge and switching _back_ is instant (`switch.ts` dropped its `removeQueries`).
**Applies to:** every hook that fetches org-scoped data — thread `orgId` into the key.

## Refetch on org change, never "once if empty"

**Idiom:** `ensurePermissionsFor` refetches permissions when the org changes.
**Why:** a lazy "fetch only if empty" leaks org A's permissions into org B.
**Applies to:** any per-org derived data cached across a switch.

## Behaviour is deployment-mode-driven, not flag-sniffed

**Idiom:** branch on `resolveDeploymentMode(flags)` → `personal-only` / `team-only`
/ `both` (see `deployment-mode.ts`, `organization-resolver.ts`).
**Why:** the three product shapes share one code path with one named discriminant
instead of scattered boolean checks.
**Applies to:** any routing/redirect decision that differs by deployment shape.

## Gate on the concrete server-provided id, not the capability flag

**Idiom:** `switchToPersonal` gates on `meContext.personalOrganizationId`, not the
"personal orgs enabled" flag.
**Why:** clinozy-be provisions the personal org best-effort, so a user can be
flag-on-but-org-missing; gating on the flag fires a switch that is _guaranteed_ to 404.
**Applies to:** any action whose success depends on a resource the server may not
have provisioned yet — gate on the resource's id.
