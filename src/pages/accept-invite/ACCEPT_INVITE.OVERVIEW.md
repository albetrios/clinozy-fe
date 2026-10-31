# `pages/accept-invite` — Membership invitation acceptance

Route: `/accept-invite/$invitationId`. Reached from an invite email link, and
**auth-required** (`requireAuth` in the route's `beforeLoad`, INV-4): the recipient is
usually not signed in yet, so a guest goes to sign-in first with `/accept-invite/<id>` as the
post-login redirect — never the token: it waits in this tab (`sessionStorage`,
`shared/tenancy/invite-token-stash.ts`) and the page reads it back on return (E-5). The error
card below is a signed-in state; a guest never sees it.

## Files

| File                        | Responsibility                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accept-invite.route.tsx`   | Route marker — exports `Component` rendering `AcceptInvitePage`.                                                                                                                                                                                                                                                                                          |
| `accept-invite.manifest.ts` | Page manifest (`path: '/accept-invite/$invitationId'`, `testId`, `kind: leaf`, no permission).                                                                                                                                                                                                                                                            |
| `AcceptInvitePage.tsx`      | Calls `acceptInvitationAndOpenClinic(invitationId, token)` (`shared/tenancy/accept-invitation.ts` — the accept, then the switch and session refresh), and redirects to the org home (the member's role home). Shows loading / partial / error states, retries a failed accept single-flight, and renders the status card inside a `SectionErrorBoundary`. |

## Flow

1. Read `invitationId` from the route params and the single-use `?token=` — or, back from
   signing in, the token stashed for this invitation.
2. No session yet → stash the token, then `/login` carrying this page (no token) as the redirect.
3. Accept the invitation (server resolves the org + role). The token is optional since
   clinozy-be launch D84: the signed-in owner of the invited, verified email accepts without it,
   so a link missing its token still works; a token that is sent must match.
4. Switch to the organization and refresh the session, then land on its home (the role home).
   Someone who has not finished onboarding meets its profile steps on the way — never the
   create-a-clinic step, because they now belong to a clinic (D84).
5. If that follow-up fails, the membership still stands: report the error, warn the user
   (`partial` state + `notify.warning`), and hand off to `/` — the resolver — never to
   `/login` (INV-1). See `agent-os/rules/fe-resilient-interactions.mdc` section 6.

## Gotcha — the `aliveRef` is set on every mount

The accept is a chain of long awaits, and `aliveRef` stops a finished chain from navigating
or setting state after the user has left (INV-2). Its effect **sets it to `true` as well as
clearing it**: a ref survives React's Strict Mode remount (dev, and therefore every E2E
run), so a cleanup that only ever writes `false` left the page permanently "gone" to itself
— the accept finished and the card sat on "Accepting your invitation…" forever. Production
has no double mount, which is how it went unnoticed. The regression test uses plain
`render` inside `<StrictMode>`; `renderWithProviders` mounts through the router after the
first commit and never double-mounts.

## Test ids

| Test id                    | Surface                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `accept-invite-page`       | Page container.                                              |
| `accept-invite-loading`    | Spinner while the accept is in flight.                       |
| `accept-invite-success`    | Check icon — shown for both `success` and `partial`.         |
| `accept-invite-error`      | Error icon on the problem card.                              |
| `accept-invite-retry`      | Try again — single-flight; a double-click sends one accept.  |
| `accept-invite-login`      | Go to sign in.                                               |
| `accept-invite-card-error` | `SectionErrorBoundary` fallback when the status card throws. |
