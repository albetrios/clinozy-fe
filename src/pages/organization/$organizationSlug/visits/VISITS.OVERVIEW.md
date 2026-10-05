# `pages/organization/$organizationSlug/visits` — Visit sheet

Route: `/organization/$organizationSlug/visits/$visitId` — the Visit sheet (KICKOFF §6.13, D18,
D29; `iterations/launch-2026-09-30-jxmr/intake-files/today.md` › Forms, Popups, Multi-step).
The island owns the param (no page of its own at `/visits`). `?tab=` picks the tab — `consult`,
`treatment`, `checkout`; absent is History (`visits.search.ts`).

Gated like Today (module `clinic-today`, `organization:read`, then `requireOrgStatus`) in
`src/app/routes/routeTree.tsx`; each tab's own access is `canUseVisitTab`
(`@/shared/clinic/visit-access.ts`): History needs Patients view, Consult & Rx is the doctor's,
Treatment the doctor's or the therapist's, Checkout needs Payments create. A tab the member can't
use is hidden; with none, the page goes back to Today with the permission toast. An unknown
`visitId` goes back to Today with "Visit not found · it may have been deleted".

## The sheet

A fixed, opaque, full-viewport layer above the shell (`components/VisitSheet/`, a Radix dialog
with no overlay and no animation): focus moves to the name; Esc, "Close · Esc" and the 12px
"Close visit" strip at the inline start go to Today; "Full profile" opens the patient file's
Overview. The butter header band (name, meta, kind pill, the package / due / consent / stage
chips), the tab row bound to `?tab=` with the save label ("All changes saved 10:42", "Saving…",
"Not saved · your changes are kept") at its inline end, then the open tab:

- **History** (`components/VisitHistory/`) — the patient's activity from the same reads as the
  file's Overview timeline, filtered All · Clinical · Money · Messages · Audit; "Next for this
  visit" jumps to the tabs the member may use.
- **Consult & Rx** (`components/VisitConsult/`) — Relevant history, the consult note, the Rx
  lines (copy the last Rx, "Add" the clinic's most prescribed, review each, set a dose where
  none is known) and "Approve · print · send to pharmacy": one write, the A4 print, the sheet
  closes and the card moves to Treatment or Checkout.
- **Treatment** (`components/VisitTreatment/`) — the session against the package and the last
  session's settings, the areas, "Complete session <k> of <m>" (one write; the sheet stays) and
  "Reverse with reason"; the photo comparison with "Capture today" through the upload tray.
- **Checkout** (`components/VisitCheckout/`) — "1 · Bill" (the visit's lines and totals, Create
  bill) and "2 · Payment" (mode, amount, balance, Receive — single-flight, not optimistic; the
  sheet closes once the server confirms).

The drafts — the consult note, the Rx lines and their review marks, the settings and areas —
live in `store/useVisitDraftStore/` (memory only, keyed by visit, never persisted) until the
write that uses them. `hooks/useVisitSave/` runs each tab's write and gives the tab row its
state. Below `md` the sheet scrolls as one page and every tab's columns stack (D29); the four
tabs keep the tab row's width — the save label drops to its own line under them — and
`hooks/useTabStripScroll/` fades the strip's edge where more tabs wait (a long locale) and keeps
the open tab in view.

The data is the shared Visit model: `@/shared/api/clinic/visits-api.ts`,
`@/shared/api/clinic/visits-contracts.ts` and `@/shared/hooks/useVisits/` (plan-only,
`REPLACE_WITH_API`) — the same one Today moves and the patient file's flow writes.

## Files

| File                         | Responsibility                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `visits.route.tsx`           | Route marker — exports `Component` rendering `VisitPage`.                                                                 |
| `visits.manifest.ts`         | Manifest — `kind: 'leaf'`, module `clinic-today`, permission `organization:read`.                                         |
| `visits.search.ts`           | `?tab=` — the route keeps the raw value and the sheet parses it, so the reader loads with the sheet, not the entry chunk. |
| `visits.constants.ts`        | `VISIT_NS` (Today's namespace), `VISIT_KEYS`, `VISIT_TEST_IDS`, the tabs and filters.                                     |
| `VisitPage.tsx`              | The visit read, the tabs the member may use, the not-found and refusal ways back.                                         |
| `visits.bill.ts`             | Checkout's lines and totals from the money module; the amount field's rupees.                                             |
| `visits.rx.ts`               | The Rx draft lines: copied, added, dosed, Approve's readiness.                                                            |
| `visits.person.ts`           | The masked number and the consent marks of the header band.                                                               |
| `components/VisitSheet/`     | The dialog, the header band, the tab row and the save label.                                                              |
| `components/VisitHistory/`   | History and "Next for this visit".                                                                                        |
| `components/VisitConsult/`   | Relevant history, the consult note, the Rx lines and Approve.                                                             |
| `components/VisitTreatment/` | The session, its settings and areas, Complete / Reverse, the photo comparison.                                            |
| `components/VisitCheckout/`  | The bill and the payment.                                                                                                 |
| `hooks/useVisitSave/`        | The tabs' writes and their outcomes (refusal toast, "Couldn't save" with Retry).                                          |
| `hooks/useTabStripScroll/`   | The tab strip's edge hints (which end hides tabs) and the open tab kept in view.                                          |
| `store/useVisitDraftStore/`  | The sheet's drafts, per visit, in memory.                                                                                 |

## Test ids

`visit-page`, `visit-close-strip`, `visit-name`, `visit-meta`, `visit-chip` (`data-chip`),
`visit-full-profile`, `visit-close`, `visit-tab-<tab>`, `visit-saved`, `visit-needs-patient`;
History `visit-history`, `visit-history-filter-<filter>`, `visit-history-row`, `visit-next-<tab>`;
Consult `visit-consult`, `visit-complaint`, `visit-findings`, `visit-diagnosis`, `visit-plan`,
`visit-copy-rx`, `visit-rx-line`, `visit-rx-review`, `visit-rx-remove`, `visit-rx-dose`,
`visit-rx-add`, `visit-approve`, `visit-rx-approved`; Treatment `visit-treatment`,
`visit-setting-<key>`, `visit-area`, `visit-complete-session`, `visit-session-recorded`,
`visit-reverse-session`, `visit-photo`, `visit-capture`; Checkout `visit-checkout`,
`visit-bill-line`, `visit-create-bill`, `visit-bill-made`, `visit-mode-<mode>`, `visit-amount`,
`visit-receive`, `visit-complete` (`docs/reference/e2e-testids-inventory.md` › Visit sheet).
