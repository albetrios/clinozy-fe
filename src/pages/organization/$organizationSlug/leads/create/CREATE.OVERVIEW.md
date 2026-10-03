# `pages/organization/$organizationSlug/leads/create` — New lead

Route: `/organization/$organizationSlug/leads/create` — a URL-driven dialog over the
Leads list (KICKOFF §4, D24; `S:23`). The route renders nothing: the Leads page reads
the URL and opens the New lead drawer over the list, so a refresh or a shared link
reopens it. `?name=&phone=` prefill the drawer (⌘K "New lead", the contact card's
"+ Lead") — parsed by `validateLeadCreateSearch` in the parent's `../leads.search.ts`
(an invalid mobile is dropped; a valid one arrives E.164), and scrubbed from
telemetry (`SENSITIVE_QUERY_PARAMS`). Gated like the room — membership
(`organization:read`) and the `clinic-leads` module, then `requireOrgStatus`; in-room
Create is `useClinicAccess`. The drawer itself is built with its own ledger row (L-35).

## Files

| File                 | Responsibility                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewLeadPage`.                                         |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-leads`, title "New lead". |
| `NewLeadPage.tsx`    | Renders nothing — the dialog route's own UI. The drawer mounts on the Leads page.                   |

## Test ids

`new-lead-drawer` — the drawer the Leads page opens for this URL (L-35); the route renders
no element of its own (`tooling/validate/test-ids-allowlist.txt`).
