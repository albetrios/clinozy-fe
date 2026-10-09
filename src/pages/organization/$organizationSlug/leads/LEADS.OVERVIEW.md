# `pages/organization/$organizationSlug/leads` — Leads

Route: `/organization/$organizationSlug/leads`. Enquiries and their conversations, until they become patients (KICKOFF §6.3).

Gated like every clinic room: membership (`organization:read`) and the `clinic-leads`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7) — `lead:read` / `create` / `update` / `delete` once the room
leaves `FIXTURE_BACKED_CLINIC_MODULES`; the person's "Edit contact" needs `contact:update`.

The room reads clinozy-be (L-60, D150): `GET /app/leads` and its writes, the person
(`/app/contacts`), their stream (`/app/contacts/:contact_id/activities`) and the team
(`GET /app/memberships`).

## The list (L-33b)

The toolbar (`RoomToolbar`, layout `leads`) over the shared `DataTable`:

- **Views** Mine · Unreplied · All — Mine first and the default (kept out of the URL).
  Mine is `owner_membership_id=<my membership>` (`useMyMembershipId`), Unreplied adds
  `is_awaiting_reply=true` — the person's last message is newer than ours — with its count
  chip; both wait for the membership, and a caller off the team has none.
- **Search** a name, a number's digits, `#ID` or `C-12345`; **Filters** Status (one) ·
  Source · Ownership (`ownership` open, releasing today, held) · Team (one member, owner or
  involved — `team_membership_id`) · Created · Follow-up date (no "Not set" — the API has no
  such filter), applied on "Apply filter" to the URL; Leads keeps no saved views;
  **Columns** Lead (always shown) · Status · Source · Interests · Team · Updated.
- **Rows** (53px; the phone `wrap` layout below `md`): the person card on the name
  (bold while awaiting a reply; the row knows the primary number only), the
  status/source/interest pills, the owner and the hold dot (`held_until` within a day),
  the involved people, "Updated" — the person's latest activity — in words. A lead nobody
  holds offers "Open · Claim"; the owner's own expired hold reads "Open to team"; the team
  card offers "Claim <first>", or "Take over from <owner>" for a held lead (a reassign — a
  claim of a held lead is `409 lead_held`). No Undo (Q7). j/k walk the rows; 50 at a time
  with infinite scroll; the text turns to bars while a new query loads, and a failed page
  says so ("Couldn’t load this list …" + "Retry"), its rows kept.
- **Sort** from the headers through the URL (`sort=<column>:<direction>`); "Updated"
  (`activity` → `last_activity_at`) starts newest first.

## Dialog routes

A layout island over two URL-driven dialogs (D24, `S:23–25`), each a direct child whose
route renders nothing — this page reads the URL and opens the drawer over the list
(`useLeadsDialogRoute`), so a refresh or a shared link reopens it:

- `create/` — New lead (L-35), prefilled from `?name=&phone=`: the Contact step (the person
  search `GET /app/contacts?q=` — "Open lead" for someone with one, "Re-create lead" for a
  patient, "Use contact" — Quick start Walk-in / Instagram DM, "New contact" → the shared
  `ContactEditor`) and Lead details, locked until there is a person. Create sends the picked
  person's `contact_id` or the new one's fields; a 409 shows the server's words
  (`lead_open_exists` with "Open"). A created lead is picked out in the list; the drawer
  closes to the list without the prefill.
- `$leadId/` — the lead drawer (L-34b); show is edit. An unknown id or a removed lead stays
  on the list with "Lead not found · it may have been deleted" (`S:115`), the list's
  filters kept.
- `/leads/$leadId/edit` redirects to `/leads/$leadId` with the same search — a
  `app/routes/routeTree.tsx` route with no island (`S:25`).

The data is the shared leads domain on clinozy-be: `@/shared/api/clinic/leads-api.ts`, its
contracts and the hold (`@/shared/api/clinic/leads-hold.ts`, from `held_until`) beside it, the hooks in
`@/shared/hooks/useLeads/`; the person in `@/shared/api/clinic/contacts-api.ts` / `@/shared/hooks/useContacts/`;
the chat's stream in `@/shared/api/clinic/contact-activities-api.ts`; the team in `useTeamDirectory`. The rooms
still on fixtures keep the fixture leads (`leads-fixture-*.ts`, `useFixtureLeads`).

## Files

| File                         | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leads.route.tsx`            | Route marker — exports `Component` rendering `LeadsPage`.                                                                                                                                                                                                                                                                                                                                                               |
| `leads.manifest.ts`          | Manifest — `kind: 'layout'` over `create` and `$leadId`, permission `organization:read`, module `clinic-leads`, nav section `leads`.                                                                                                                                                                                                                                                                                    |
| `leads.search.ts`            | URL schemas (`validateSearch`): the list's `view`, `q`, `status`, `source`, `hold`, `member`, `created`, `followUp`, `sort`.                                                                                                                                                                                                                                                                                            |
| `leads.dialog-search.ts`     | New lead's prefill — its route keeps the raw values, `useLeadsDialogRoute` parses them; loads with the room.                                                                                                                                                                                                                                                                                                            |
| `leads.constants.ts`         | `LEADS_NS` / `LEADS_KEYS` (the `leads` namespace).                                                                                                                                                                                                                                                                                                                                                                      |
| `LeadsPage.tsx`              | Room page — the toolbar over the list; claims, takes over, opens and starts New lead; reads the dialog routes and hosts their `Outlet`. Owns `data-testid="leads-page"`.                                                                                                                                                                                                                                                |
| `components/LeadFields/`     | A lead's pills (status, source, interests "+N"), the source icons and order, the team (`memberPerson`, the team card) and the person card's data (`leadContactCardData`).                                                                                                                                                                                                                                               |
| `components/LeadsTable/`     | The list's columns (`useLeadsTable`), cells (person, team with the hold dot, "Updated"), the claim pill and the table itself — the shared `DataTable`.                                                                                                                                                                                                                                                                  |
| `components/LeadsToolbar/`   | Views, search, Filters (`components/LeadsToolbar/leads-filter-fields.ts`), Columns and "New lead".                                                                                                                                                                                                                                                                                                                      |
| `components/LeadDrawer/`     | The lead drawer (L-34b) on the record drawer: its width and the chat column's (`components/LeadDrawer/lead-drawer-widths.ts`), the chat's resize handle, the title's chips, the body (strip with "Edit contact", cards) and the remove confirm; on a phone the record drawer's Details · Chat panes. The chat is the person's stream (`{ kind: 'contact' }`); "Book an appointment" returns with the Appointments room. |
| `components/NewLeadDrawer/`  | New lead (L-35): the form and its rules (`components/NewLeadDrawer/new-lead-form.ts` — presets, picks, "Change", what Create sends), the Contact step with the search, and the drawer on the shared record drawer.                                                                                                                                                                                                      |
| `components/LeadFormFields/` | The drawer's fields, shared with New lead (L-35): source and interest chips, the progress track, "Assigned & involved" with its people popover (anyone with Edit assigns anyone), the person's strip.                                                                                                                                                                                                                   |
| `hooks/useLeadDraft/`        | The drawer's draft — source, interests, status — its dirty check, save and discard.                                                                                                                                                                                                                                                                                                                                     |
| `hooks/useLeadsList/`        | The URL's view, search, filters and sort read against the viewer (`hooks/useLeadsList/lead-list-params.ts`, kept off the entry chunk); the list, the team, the Unreplied count; the URL writes.                                                                                                                                                                                                                         |
| `hooks/useLeadsDialogRoute/` | Which dialog the URL opens: none, New lead with its prefill, or the lead (resolved by `useDialogRouteRecord`).                                                                                                                                                                                                                                                                                                          |
| `__tests__/integration/`     | The list and the dialog routes end to end on the page; `__tests__/integration/leads-test-router.tsx` mirrors the family's routes, `__tests__/integration/leads-test-data.ts` builds members, leads and contacts.                                                                                                                                                                                                        |
| `create/`, `$leadId/`        | The dialog-route islands — see their overviews.                                                                                                                                                                                                                                                                                                                                                                         |

## Test ids

`leads-page`; `leads-empty`, `leads-claim`, `leads-hold-dot`; the drawer's `lead-drawer-chat`, `lead-drawer-save`, `lead-drawer-remove`, `lead-drawer-people`, `lead-drawer-resize`; New lead's `new-lead-search`, `new-lead-preset-<id>`, `new-lead-hit-<contact number>`, `new-lead-no-match`, `new-lead-new-contact`, `new-lead-change` (and the shared `contact-editor-…`); the shared toolbar's and
table's under the `leads` table id (`leads-toolbar`, `leads-tab-<view>`, `leads-search`,
`leads-filters-trigger`, `leads-columns-trigger`, `leads-new-lead`, `leads-fab`,
`leads-table-row` …); the drawers the dialog routes open: `new-lead-drawer` (L-35),
`lead-drawer` (L-34b).
