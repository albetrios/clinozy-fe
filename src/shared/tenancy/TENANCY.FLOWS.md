# `src/shared/tenancy/` — Flows

The runtime sequences that span several tenancy modules. Companion tiers:
[OVERVIEW](./TENANCY.OVERVIEW.md) · [PATTERNS](./TENANCY.PATTERNS.md) ·
[POLICIES](./TENANCY.POLICIES.md).

## `/` root resolution

Where a bare `/` lands, decided from the JWT-backed session context.

1. `resolveRootRedirect()` → `ensureSessionContext()` (cache-first read of
   `me/context`: onboarding flag + deployment flags + active org; refetches only
   on a cold boot).
2. `resolveRootTarget(ctx, { pendingInvitations })` (`resolveRootTargetWithInvitations` reads the
   invitations in every clinic deployment — never in `personal-only` — and a failed read counts as
   none):
   - **Invited with no clinic (D84):** pending invitations, a team deployment and no active team
     org → `/organization`, the picker, which lists them with Accept / Decline. Checked _before_
     onboarding: team-only onboarding creates a clinic, and an invitee must not get a second,
     empty one. After an accept the clinic is active, so the next decision is onboarding (its
     profile steps only — the workspace step is skipped for someone who belongs to a clinic) or
     the clinic's home.
   - **Onboarding first, every mode:** `needsOnboarding(ctx)` (i.e.
     `!user.onboarding_completed`) → `/onboarding`. This is checked _before_ any
     active-org routing, so a personal deployment's auto-provisioned org does not
     short-circuit a fresh user past the wizard.
   - **Invited member of a clinic (feat-choose-default-clinic):** an active TEAM and pending
     invitations → `/organization`, where they accept or decline them and star the clinic that
     opens at sign-in. Only `/` decides this; `workspaceRedirectForTeamEntry` never holds a
     clinic's URL up for an invitation. One clinic and nothing pending → straight in.
   - Then the active org: a TEAM with a slug (outside a `personal-only`
     deployment) → its home, `/organization/$slug` (`organizationHome(slug)`),
     which sends the member on to their role home (D25: Today for most roles) —
     or to the picker when they cannot read that org. Everything else — no active
     org, a PERSONAL active org, a `personal-only` deployment — → `/organization`
     (the picker): personal workspaces have no clinic (D44), and the picker's list
     and "Create organization" lead into one.
   - **Which org is active after a sign-in** is decided by clinozy-be, not here: the login
     token names the clinic the person pinned (Settings › Account › "Clinic at sign-in", or the
     account menu's "Opens at sign-in" — `useSignInClinic`, `PATCH /users/me/settings`), else
     the clinic they last switched to (each `/auth/switch-to-organization` remembers it), else
     their newest clinic, and the personal workspace only when they have no clinic. So a returning member's `/` goes straight to their clinic's home; nothing is
     stored in the browser (`feat-default-clinic-at-login`).
3. Resolver returns the redirect. The retired `/dashboard` URL redirects to `/`, so
   it resolves the same way.

Entry point: `organization-resolver.ts` · Ends at: a redirect target, never an island.

## Organization switch

Re-mints the global access token and re-points every derived surface at the new org.

1. `switchToOrganization(orgId)` → `liveSwitch('/auth/switch-to-organization', …)`.
2. `liveSwitch` bumps `switchGeneration`, POSTs, and **discards** the response if a
   newer switch superseded it in flight (stale generation → return `undefined`).
3. On the winning switch: `setAccessToken` + `scheduleTokenRefresh` +
   `applyActiveOrg` (updates `me/context` cache: active org, permissions, role).
4. `deriveOrgContext(result)` syncs the store, which also moves the organization
   list's `isActive` (derived from the store on read, never cached); an analytics
   `organizationSwitched` event fires.

Entry points: `switch.ts` (`switchToOrganization` / `switchToPersonal`) ·
Guard: monotonic `switchGeneration` · Ends at: new token + derived context.

## Switch to personal (404-safe)

1. `switchToPersonal()` reads cached `me/context`; if `personalOrganizationId` is
   falsy → return `undefined` (no request — the switch would 404).
2. Otherwise `liveSwitch('/auth/switch-to-personal', {})` → same token + context
   application as an org switch.

Entry point: `switch.ts` · Guard: `personalOrganizationId` present.
