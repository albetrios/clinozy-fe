# `pages/organization/$organizationSlug/leads/create` — New lead

Route: `/organization/$organizationSlug/leads/create` — a URL-driven dialog over the
Leads list (KICKOFF §4, D24; `S:23`). The route renders nothing: the Leads page reads
the URL and opens the New lead drawer over the list, so a refresh or a shared link
reopens it. `?name=&phone=` prefill the drawer (⌘K "New lead", the contact card's
"+ Lead") — parsed by `validateLeadCreateSearch` in the parent's `../leads.dialog-search.ts`
(an invalid mobile is dropped; a valid one arrives E.164), and scrubbed from
telemetry (`SENSITIVE_QUERY_PARAMS`). Gated like the room — membership
(`organization:read`) and the `clinic-leads` module, then `requireOrgStatus`; in-room
Create is `useClinicAccess`. The drawer is `NewLeadDrawer`
(`../components/NewLeadDrawer/`, L-35): a 640px record drawer — Contact (search, Quick start,
"New contact" → the shared `ContactEditor`) and Lead details, locked until there is a contact; with
a prefill or a picked person, the person's strip with "Change" and Lead details alone. "Create lead"
checks for a name and a 10-digit mobile; a mobile already on an open lead toasts with "Open". The
new lead is picked out in the list; the drawer closes to `/leads` without the prefill.

## Files

| File                 | Responsibility                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewLeadPage`.                                         |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-leads`, title "New lead". |
| `NewLeadPage.tsx`    | Renders nothing — the dialog route's own UI. The drawer mounts on the Leads page.                   |

## Test ids

`new-lead-drawer` — the drawer the Leads page opens for this URL (L-35); the route renders
no element of its own (`tooling/validate/test-ids-allowlist.txt`). Its parts: the record drawer's
(`new-lead-drawer-save` …) and `new-lead-search`, `new-lead-preset-<id>`, `new-lead-hit-<kind>-<seq>`,
`new-lead-no-match`, `new-lead-new-contact`, `new-lead-change` (`../leads.constants.ts`).
