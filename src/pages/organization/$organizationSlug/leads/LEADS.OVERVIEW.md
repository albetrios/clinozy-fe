# `pages/organization/$organizationSlug/leads` — Leads

Route: `/organization/$organizationSlug/leads`. Enquiries and their conversations, until they become patients (KICKOFF §6.3).

Gated like every clinic room: membership (`organization:read`) and the `clinic-leads`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7).

## The list (L-33b)

The toolbar (`RoomToolbar`, layout `leads`) over the shared `DataTable`:

- **Views** Mine · Unreplied · All — Mine first and the default (kept out of the URL);
  Unreplied carries the viewer's unread count. "Mine" is the signed-in member as
  `useLeadViewer` reads them, and the list waits for them.
- **Search** name, phone, `#ID`; **Filters** Status · Source · Ownership (the hold:
  open, releasing today, held) · Team (a people picker — owner or involved) · Created ·
  Follow-up date, applied on "Apply filter" to the URL; Leads keeps no saved views;
  **Columns** Lead (always shown) · Status · Source · Interests · Team · Updated.
- **Rows** (53px; the phone `wrap` layout below `md`): the person card on the name
  (bold while unread), the status/source/interest pills, the owner with presence and
  the hold dot, the involved people, "Updated" in words. An open lead's row offers
  "Open to team · Claim" (or "Join" when the owner is gone) — the claim lands with
  Undo; the open lead's row stays marked. j/k walk the rows; 50 at a time with
  infinite scroll; the text turns to bars while a new query loads, and a failed page
  says so ("Couldn’t load this list …" + "Retry"), its rows kept.
- **Sort** from the headers through the URL (`sort=<column>:<direction>`); "Updated"
  starts newest first.

## Dialog routes

A layout island over two URL-driven dialogs (D24, `S:23–25`), each a direct child whose
route renders nothing — this page reads the URL and opens the drawer over the list
(`useLeadsDialogRoute`), so a refresh or a shared link reopens it:

- `create/` — New lead (L-35), prefilled from `?name=&phone=`: the Contact step (search,
  Quick start, "New contact" → the shared `ContactEditor`) and Lead details, locked until
  there is a contact. A created lead is picked out in the list; the drawer closes to the
  list without the prefill.
- `$leadId/` — the lead drawer (L-34b); show is edit. An unknown id, a removed lead or a
  contact thread's id stays on the list with "Lead not found · it may have been deleted"
  (`S:115`), the list's filters kept.
- `/leads/$leadId/edit` redirects to `/leads/$leadId` with the same search — a
  `app/routes/routeTree.tsx` route with no island (`S:25`).

The data is the shared leads domain: `@/shared/api/clinic/leads-api.ts` (fixture world,
`REPLACE_WITH_API`), its contracts and hold rules beside it, and the hooks in
`@/shared/hooks/useLeads/`.

## Files

| File                         | Responsibility                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leads.route.tsx`            | Route marker — exports `Component` rendering `LeadsPage`.                                                                                                                                                                                                                                                                                                                          |
| `leads.manifest.ts`          | Manifest — `kind: 'layout'` over `create` and `$leadId`, permission `organization:read`, module `clinic-leads`, nav section `leads`.                                                                                                                                                                                                                                               |
| `leads.search.ts`            | URL schemas (`validateSearch`): the list's `view`, `q`, `status`, `source`, `hold`, `owner`, `created`, `followUp`, `sort`; the New lead prefill.                                                                                                                                                                                                                                  |
| `leads.constants.ts`         | `LEADS_NS` / `LEADS_KEYS` (the `leads` namespace).                                                                                                                                                                                                                                                                                                                                 |
| `LeadsPage.tsx`              | Room page — the toolbar over the list; claims, opens (marking read) and starts New lead; reads the dialog routes and hosts their `Outlet`. Owns `data-testid="leads-page"`.                                                                                                                                                                                                        |
| `components/LeadFields/`     | A lead's pills (status, source, interests "+N"), the source icons and order, the people (`staffPerson`, the team card) and the person card's data (`leadContactCardData`).                                                                                                                                                                                                         |
| `components/LeadsTable/`     | The list's columns (`useLeadsTable`), cells (person, team with the hold dot, "Updated"), the claim pill and the table itself — the shared `DataTable`.                                                                                                                                                                                                                             |
| `components/LeadsToolbar/`   | Views, search, Filters (`components/LeadsToolbar/leads-filter-fields.ts`), Columns and "New lead".                                                                                                                                                                                                                                                                                 |
| `components/LeadDrawer/`     | The lead drawer (L-34b): the two panes and their widths (`components/LeadDrawer/lead-drawer-widths.ts`), the chat's resize handle, the details pane (header, strip with "Edit contact", cards, footer, remove confirm) and the phone bar. The composer's "Book an appointment" stacks the shared appointment form over it (`leadBookingPrefill`, L-38) — the URL stays the lead's. |
| `components/NewLeadDrawer/`  | New lead (L-35): the form and its rules (`components/NewLeadDrawer/new-lead-form.ts` — presets, picks, "Change", what Create sends), the Contact step with the search, and the drawer on the shared record drawer.                                                                                                                                                                 |
| `components/LeadFormFields/` | The drawer's fields, shared with New lead (L-35): source and interest chips, the progress track, "Assigned & involved" with its people popover and the assign rules (`components/LeadFormFields/lead-assign.ts`), the person's strip.                                                                                                                                              |
| `hooks/useLeadDraft/`        | The drawer's draft — source, interests, status — its dirty check, save and discard.                                                                                                                                                                                                                                                                                                |
| `hooks/useLeadsList/`        | The URL's view, search, filters and sort read against the viewer (`hooks/useLeadsList/lead-list-params.ts`, kept off the entry chunk); the list, the team, the Unreplied count; the URL writes.                                                                                                                                                                                    |
| `hooks/useLeadsDialogRoute/` | Which dialog the URL opens: none, New lead with its prefill, or the lead (resolved by `useDialogRouteRecord`).                                                                                                                                                                                                                                                                     |
| `__tests__/integration/`     | The list and the dialog routes end to end on the page; `__tests__/integration/leads-test-router.tsx` mirrors the family's routes, `__tests__/integration/leads-test-data.ts` builds staff and leads.                                                                                                                                                                               |
| `create/`, `$leadId/`        | The dialog-route islands — see their overviews.                                                                                                                                                                                                                                                                                                                                    |

## Test ids

`leads-page`; `leads-empty`, `leads-claim`, `leads-hold-dot`; the drawer's `lead-drawer-chat`, `lead-drawer-save`, `lead-drawer-remove`, `lead-drawer-people`, `lead-drawer-resize`; New lead's `new-lead-search`, `new-lead-preset-<id>`, `new-lead-hit-<kind>-<seq>`, `new-lead-no-match`, `new-lead-new-contact`, `new-lead-change` (and the shared `contact-editor-…`); the shared toolbar's and
table's under the `leads` table id (`leads-toolbar`, `leads-tab-<view>`, `leads-search`,
`leads-filters-trigger`, `leads-columns-trigger`, `leads-new-lead`, `leads-fab`,
`leads-table-row` …); the drawers the dialog routes open: `new-lead-drawer` (L-35),
`lead-drawer` (L-34b).
