# `pages/organization/$organizationSlug/leads` — Leads

Route: `/organization/$organizationSlug/leads`. Enquiries and their conversations, until they become patients (KICKOFF §6.3).

Gated like every clinic room: membership (`organization:read`) and the `clinic-leads`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7). The island was scaffolded with the route
plumbing (L-12a); its screen is built in its own ledger row.

## Files

| File                 | Responsibility                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `leads.route.tsx`    | Route marker — exports `Component` rendering `LeadsPage`.                                              |
| `leads.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-leads`, nav section `leads`. |
| `leads.constants.ts` | `LEADS_NS` / `LEADS_KEYS` (the `leads` namespace).                                                     |
| `LeadsPage.tsx`      | Room page. Owns `data-testid="leads-page"`.                                                            |
