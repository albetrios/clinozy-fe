# `pages/onboarding` — Post-signup onboarding wizard

Route: `/onboarding`. Where **every** freshly authenticated user lands once, in any
deployment mode — gated by the backend `user.onboarding_completed` flag, not by
whether the user has a workspace (personal deployments auto-provision an org yet
still onboard). The `/onboarding` `beforeLoad` in `app/routes/routeTree.tsx` wires
`requireAuth` + `requireOnboardingWorkspace` (`app/guards/route-guards.ts`); the `/`
resolver redirects here via `resolveRootRedirect`
(`shared/tenancy/organization-resolver.ts`). That guard also **claims the persisted
wizard for the signed-in user** (`useOnboardingStore.claimForUser`) before this page
renders, wiping progress a different user left on the same browser — the page itself no
longer does it, so no previous user's name or workspace paints for a frame (ONB-4). Only
the wizard steps differ per mode.

The wizard is **Welcome → Your name → Clinic name → Done** — four steps at most, about
thirty seconds (clinic-setup D4). It asks nothing about the team and **sends no
invitations**: inviting is the setup guide's (`#setup`, with real roles and the main
branch), and "How did you hear about us?" is the setup drawer's "You're live" step. Team
size and use case are no longer asked anywhere.

## Files

| File                      | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onboarding.route.tsx`    | Route marker — exports `Component` rendering `OnboardingPage`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `onboarding.manifest.ts`  | Page manifest — `testId` + document title, written out locally (pinned to `onboarding.constants.ts` by its test) so the key table stays off the entry chunk.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `onboarding.constants.ts` | i18n keys, test ids and motion timings for this island.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `OnboardingPage.tsx`      | Multi-step wizard (welcome → profile → workspace → done; steps derived per mode by `onboarding-flow.ts` — the clinic-name step only in team-only mode for someone who belongs to no clinic yet; someone who already belongs to one, an invitee who accepted, gets Welcome → Your name → Done and the finish creates nothing, D84). Reads/writes progress from `@/shared/store/useOnboardingStore/` so a refresh resumes mid-flow. On finish it creates the org (team-only), marks onboarding complete (`POST /users/me/onboarding/complete`) **before** refreshing `me/context`, activates the workspace, and navigates **directly** to the resolved workspace. No invitation is sent. |

Step UIs live in `components/` (folder-per-unit): `WelcomeStep` (the pitch — names creating
the organization only when that step follows), `ProfileStep` ("Your name": **first name + last
name** — maps 1:1 to clinozy-be `first_name` / `last_name`), `WorkspaceStep` ("Clinic name": org
name + live `{{productDomain}}/<slug>` preview, work-email-domain prefill), `DoneStep` (a drawer
step's peek tiles: the name, and the clinic name when it was asked), plus `StepIndicator` (the
drawer's 24px step circles — four at most).

The wizard sits in the public layout's signed-out canvas as one 480px `PublicCard`,
built like a drawer (L-65): the step circles and the step's heading, the body, then
the footer with its hairline — outline "Back", the primary at the end.

`WorkspaceStep`'s slug is validated **at that step**, against the same schema
`createOrganization` uses (`isValidWorkspaceSlug` in `onboarding-flow.ts`): an uppercase
or spaced slug blocks Continue instead of passing it and only blowing up two steps later
at Finish, as a generic error (ONB-6). An empty slug stays valid — the backend derives one.

## Finish flow (idempotent + best-effort)

`finish()` is safe to retry. The created org id is stashed in the store the moment creation
succeeds, so a retry after a partial failure **reuses** it instead of creating a duplicate.
The profile (first + last name) is persisted **best-effort** (`authApi.updateProfile`, a
warning toast naming Settings when it fails) and a PostHog `onboarding_completed` event fires
with no properties — neither ever blocks entry to the workspace. No invitation and no role is
created here.

The stored org id is re-checked against the user's real organizations before it is
trusted — a persisted id from an earlier session can name an org the user no longer
belongs to, and navigating to its slug 404s. That check reads the organization list
**through the query cache** (`readMyOrganizations`, `staleTime` 10s) under
`myOrganizationsQueryKey`, so the stale-created-org effect and the finish path share one
response, in the one cache the picker, the switcher and Settings read (ONB-10). A
`staleTime` rather than `ensureQueryData`, because answering "does this org still exist"
from an arbitrarily old cache entry would drop a real organization and create a duplicate.
An org created inside that window marks the cached list stale on the spot, so a retry
re-reads it from the server and is never told the org it just made does not exist.

Two latches keep a repeat click from re-running the writes. `finishingRef` is the
synchronous twin of `submitting`: `disabled` only lands a render later, so a double-click
would otherwise fire `finish()` twice before the button greys out. `finishedContextRef`
covers the longer window after that — `finishingRef` clears the moment the post-finish
navigation _starts_, while the destination's guard chain is still on the network and the
wizard is still mounted and clickable. Once a finish has succeeded, that ref holds the
context it resolved and a further click **replays the navigation** rather than re-sending
the profile PATCH, `completeOnboarding`, the org switch and the analytics event. It is a
mount-scoped ref, not the store's persisted `completed` flag, which
would permanently dead-end a user whose store says done while the guard still routes them
here. `useReleaseFinishLatchOnReturn` disarms it once the router settles back on
`/onboarding` — the bounce case, where the destination refused us and a still-armed latch
would leave the wizard un-finishable.

After activating the workspace (`switchToOrganization` for a created team, or
`switchToPersonal` when a personal workspace exists), `finish()` navigates **directly** to the
resolved target via `resolveRootTarget(post-switch context)` — no bounce through the `/`
resolver (which would re-fetch `me/context` and add a second redirect, flashing `/login` /
`/onboarding` in between). The personal switch is gated on the concrete `personalOrganizationId`
so a personal-enabled-but-unprovisioned user never fires a 404-ing `switch-to-personal`
(clinozy-be self-heals the missing personal org; the FE stays defensive). Modes: **team-only**
creates + lands on the clinic's home (the role home: Today for the owner); **personal-only** /
**personal-and-team** land on the `/organization` picker — a personal workspace has no clinic
(D44); a genuinely workspace-less state defers to `/` rather than self-looping.

## State

Wizard progress (current step, the name and the clinic name, `createdOrganizationId` +
`createdOrganizationSlug`, and the `forUserId` owner the route guard stamps) lives in
`useOnboardingStore` (Zustand, persisted to `localStorage`) so a refresh resumes mid-flow.
Its persisted shape is **version 1**: progress saved by the six-step wizard (version 0) is
migrated on load — a step past Questions moves back one (Invite lands on Done) and the
removed steps' answers are dropped. Server writes (create org, profile, onboarding complete)
go through the normal API layer, not the store.
