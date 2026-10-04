# `pages/organization/$organizationSlug/leads/$leadId` — Lead drawer

Route: `/organization/$organizationSlug/leads/$leadId` — a URL-driven dialog over the
Leads list (KICKOFF §4, D24; `S:24`). Show **is** edit: the drawer holds a draft and
saves it. The route renders nothing: the Leads page reads the id, resolves the lead
through `useDialogRouteRecord` and opens the lead drawer over the list, so a refresh or
a shared link reopens it. An unknown id, a removed lead or a contact thread's id leaves
the list in place, without a drawer, and toasts "Lead not found · it may have been
deleted" (`S:115`, `S:261`). `/leads/$leadId/edit` is a redirect to this route,
registered in `app/routes/routeTree.tsx` with no island (`S:25`). Gated like the room —
membership (`organization:read`) and the `clinic-leads` module, then
`requireOrgStatus`. The drawer is `pages/organization/$organizationSlug/leads/components/LeadDrawer/` (L-34b), mounted by the Leads
page over the list. The person's contact card offers "Edit contact": the shared
`ContactEditor` (L-35) over the drawer, its "Done" saved on the lead at once
("Contact updated · applies everywhere").

## Files

| File                  | Responsibility                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `lead-id.route.tsx`   | Route marker — exports `Component` rendering `LeadPage`.                                        |
| `lead-id.manifest.ts` | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-leads`, title "Lead". |
| `LeadPage.tsx`        | Renders nothing — the dialog route's own UI. The drawer mounts on the Leads page.               |

## Test ids

`lead-drawer` — the drawer the Leads page opens for this URL (L-34b); the route renders no
element of its own (`tooling/validate/test-ids-allowlist.txt`).
