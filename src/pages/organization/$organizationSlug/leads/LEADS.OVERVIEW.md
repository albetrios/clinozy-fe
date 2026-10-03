# `pages/organization/$organizationSlug/leads` — Leads

Route: `/organization/$organizationSlug/leads`. Enquiries and their conversations, until they become patients (KICKOFF §6.3).

Gated like every clinic room: membership (`organization:read`) and the `clinic-leads`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7). The list screen is built in its own ledger row (L-33b).

## Dialog routes

A layout island over two URL-driven dialogs (D24, `S:23–25`), each a direct child whose
route renders nothing — this page reads the URL and opens the drawer over the list
(`useLeadsDialogRoute`), so a refresh or a shared link reopens it:

- `create/` — New lead (L-35), prefilled from `?name=&phone=`.
- `$leadId/` — the lead drawer (L-34b); show is edit. An unknown id, a removed lead or a
  contact thread's id stays on the list with "Lead not found · it may have been deleted"
  (`S:115`), the list's filters kept.
- `/leads/$leadId/edit` redirects to `/leads/$leadId` with the same search — a
  `app/routes/routeTree.tsx` route with no island (`S:25`).

The data is the shared leads domain: `@/shared/api/clinic/leads-api.ts` (fixture world,
`REPLACE_WITH_API`), its contracts and hold rules beside it, and the hooks in
`@/shared/hooks/useLeads/`.

## Files

| File                         | Responsibility                                                                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leads.route.tsx`            | Route marker — exports `Component` rendering `LeadsPage`.                                                                                                                               |
| `leads.manifest.ts`          | Manifest — `kind: 'layout'` over `create` and `$leadId`, permission `organization:read`, module `clinic-leads`, nav section `leads`.                                                    |
| `leads.search.ts`            | URL schemas (`validateSearch`): the list's `view`, `q`, `status`, `source`, `hold`, `owner`, `created`, `followUp`, `sort`; the New lead prefill; `leadListParamsOf` for the list read. |
| `leads.constants.ts`         | `LEADS_NS` / `LEADS_KEYS` (the `leads` namespace).                                                                                                                                      |
| `LeadsPage.tsx`              | Room page — reads the dialog routes, hosts their `Outlet`. Owns `data-testid="leads-page"`.                                                                                             |
| `hooks/useLeadsDialogRoute/` | Which dialog the URL opens: none, New lead with its prefill, or the lead (resolved by `useDialogRouteRecord`).                                                                          |
| `__tests__/integration/`     | The dialog routes end to end on the page; `__tests__/integration/leads-test-router.tsx` mirrors the family's routes for the tests.                                                      |
| `create/`, `$leadId/`        | The dialog-route islands — see their overviews.                                                                                                                                         |

## Test ids

`leads-page`; the drawers the dialog routes open: `new-lead-drawer` (L-35), `lead-drawer`
(L-34b).
