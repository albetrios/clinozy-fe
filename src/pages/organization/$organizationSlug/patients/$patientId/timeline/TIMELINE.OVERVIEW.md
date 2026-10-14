# `pages/organization/$organizationSlug/patients/$patientId/timeline` — Overview

Route: `/organization/$organizationSlug/patients/$patientId/timeline` — a section of the
patient file (KICKOFF §6.6, D26; H:769–779, H:4840–4864, H:4980–4999). It renders in the file
layout's content column through the family's section frame (`../shared/components/PatientSection/`)
with no header (H:4943; its title stays for screen readers). The default section (D19), built in
L-46: on the canvas, the patient's records on clinozy-be in **fixed rows**, every card in a row one
height (change-patient-overview-photos D9; container variants on the scrolling column, its
padding inside) — Clinical the full width; **Care** (Visits · Treatments · Packages ·
Prescriptions) one column, two from 560px of the content column, four from 1180px; Photos (two
thirds) and Reports (one third) from 900px; Billing and Team notes side by side from 640px; a row
closes up around the cards the member reads — then the **activity timeline**, the person's own
activity. The
**visit flow** takes its place on `?visit=open` while the patient has an open visit (L-49, D18).

- **Cards.** Each card's head has its tone tile, its title and count (the server's — a list's
  length, or `estimated_total` where the card reads one page), its own actions, "New …" (the
  file's Add-to-record item, for a member who may — `../shared/hooks/usePatientFileActions/`)
  and "Open <card>" (its section, when viewable). A card shows only for a member whose codes
  read it — its section's (`viewable`), `contact_activity:read` for Team notes — so no read is
  refused; each says in place while it loads (bars), when its read failed (Retry) and when it
  holds nothing — a dashed slot in its section's tone filling the card, with its 32px tile and
  its line, and the card's add on it ("Book", "New prescription", …) for a member who may
  (D10). Clinical: the four lists as panels — dot, name, count, the chips wrapping to two lines,
  "Nothing added yet" (the patient's clinical notes, `../shared/hooks/useClinicalLists/`). Visits: "Reschedule" the next visit (its tile — the
  file's read, its service, no length) or "Book", the person's last three completed bookings
  (`usePersonAppointments`). Photos: "Upload", the newest eight (one page of `…/images`), each
  the photo itself (`file_url`, D86) named for the reader, opening Photos on their album; for a
  member who uploads, an "Add photos" tile first, files dropped on the card and images pasted on
  the Overview filed in General (`../shared/hooks/usePhotoDrop/`, `../shared/hooks/usePhotoPaste/`),
  and the empty card one drop zone. Packages: each
  package's sessions as segments and its state as the server keeps it — "All sessions done",
  "Expired", "Valid till …" / "No expiry"; no "Next · 8 Oct", "Session 2 overdue" (the API
  dates no package's next session — G4) or "Use session" (§6 #20). Prescriptions: the latest
  Rx, four of its medicines, its advice. Treatments: the last three sessions done (a reversed
  one stays in Treatments), each opening its edit drawer. Reports: the newest three (one
  page). Team notes: the composer and the newest three notes — the person's `note` entries
  (§6 #3). **Billing** (billing view): "New invoice" (`payment:create`), Due — masked with the
  file, its "Show amounts" eye — and Paid, the server's over every invoice of hers
  (`GET /app/invoices?patient_id=&limit=1` → `meta.due_total` / `meta.paid_total`, never summed
  here; the count beside the title is its `estimated_total`), her newest three invoices (the
  Invoices section's first page) with the server's status, each opening Edit invoice
  (`payment:update`, never a sale's or a settled one's) or its preview over the file, and
  "Collect payment" (`payment:create`) while she owes (`components/OverviewBento/bento-billing.tsx`).
- **Smart note** (Clinical, for a member who edits the patient): the words it knows — the UI
  language's (`components/OverviewBento/smart-note-words/`, the prototype's keys, H:3702, in all
  11 locales, loaded per locale on first use), then English, which every locale still reads —
  become Complaints, Diagnosis and Suggested chips, one clinical note each (api-integration
  §5.4); case and accents fold, a short word must stand alone, Chinese, Japanese and Korean
  match anywhere. The Rx catalogue's medicines it names open New prescription with a line each
  (`prescriptions/create?medicines=`, AMBER A-F5) — never an Rx saved silently, the Rx gate
  deciding. "Nothing recognised yet" otherwise; words that cannot load say so, with a Retry.
  The placeholder's example is the locale's own (`timeline.clinical.smartExample`).
- **Activity timeline** (H:4840–4864, AMBER A-F7; §6 #2): no feed of its own — the person's
  activity on clinozy-be (`GET /app/contacts/:contact_id/activities`, `contact_activity:read`),
  the server's record events (`system`, in the server's words) and the team's notes, newest
  first under their days ("Today", "Yesterday", "Sat", else the date), 20 a page with "Load
  more". The conversation (messages, calls) is the Activity column's, so it is not repeated
  here. The design's kind tabs stay only where the stream filters: All · Clinical (`group`) ·
  Billing (`group=money`, billing view only — "All" leaves money out without it) · Notes
  (`type=note`); no tab carries a count (the server counts no group). Each row opens its
  record where the file has a route for it (the Rx and treatment drawers, the photo viewer, the
  report), else its record's section, for a member who may; a task's event opens nothing.
  Rupee amounts in the server's lines follow the file's mask (Q-F4). The server leaves out
  entries linked to records the member may not read (M10).
- **Visit flow** (KICKOFF §6.6 Visit flow, D18; H:758–768, H:4871–4898): on `?visit=open` while
  the patient has an open visit — on clinozy-be a visit is their booking checked in today, there is
  no Visit resource (`@/shared/hooks/useVisits/`). The file bar's "Start visit" checks in today's
  booking, else books a walk-in (their usual doctor, else the signed-in member), and opens the
  flow; its "Visit in progress · Resume" pill returns to it. One column up to 880px: "Visit in
  progress" (or paused), Pause (`…/pause`, back to the Overview, the visit open), Resume
  (`…/resume`) and "✓ Complete visit" (`…/complete` — "Visit completed · …", naming a package
  session used and the Rx's follow-up when there was one) — the booking's own routes — then five
  open step cards, the first unfinished one current: **Check-in & safety** (three ticking checks,
  each a `safety_check` clinical note at the visit; optimistic, an untick deletes the note with
  reason `not_needed`), **Prescription** (the member's one-tap kits saving an Rx at the visit,
  approved for an approver — Q19 — and "Write prescription") and **Treatment** ("⚡ Repeat" the
  last session, on its package while it has a session left, and "New treatment" — both wait for
  the checks: "Finish check-in first"), **Invoice** and **Collect** (D156). A step is done by its record at the visit (the Rx and the
  session carry its booking); a step whose read failed shows Retry. Once an Rx or a session is
  written the client moves the visit's stage on (`…/stage`, Q8: an Rx to Treatment while a session
  is due, else to Checkout; a session to Checkout) — Today's card changes lane (L-64). "Write
  prescription" and "New treatment" keep the flow open behind their drawer (`?visit=open`) and
  close back to it — the Rx there is "Approve · print · send to pharmacy"; its "Save & sell" opens
  New sale in Medical on the Rx and its patient, with the flow as its way back
  (`from=patients/<id>/timeline?visit=open`).
  "Complete visit" leaves the flow; opened from Today's "Open session" or "Checkout"
  (`from=today`), Pause and that exit go back to Today. **Invoice** reads the patient's invoices of
  the visit's day (`GET /app/invoices?patient_id=&invoice_date_from/_to=`) and finds the visit's —
  the one whose lines bill a session recorded at it (`patient_treatment_ids`; invoices carry no
  `appointment_id`, PAY-G12): "#7 · ₹ ••••" once made, else "2 items ready" (the sessions still to
  bill), "Covered by package · nothing to bill" or "Nothing to bill yet"; "Create invoice from
  visit" opens the Invoice drawer over the flow on `?appointment=` — its lines the visit's
  sessions still to bill, one per offering, priced by the server — ("Nothing to bill" when there
  are none) and "Custom invoice" on the patient alone, both until the visit has its invoice.
  **Collect** says what that invoice owes and "Collect ₹X" opens Receive payment against it over
  the flow (`?patient=&invoice=`); "Nothing due" once paid or covered, "Invoice the visit first"
  before. Both need `payment:read` with the treatments' read, their controls `payment:create`;
  amounts follow the file's mask; the WhatsApp share goes (§6 #26). Each step shows only for a member
  who reads its records, each action only for one who may take it. Without an open visit the
  param is dropped and the Overview stays — a link never starts a visit.

Gated by the file layout (membership, the `app-patients` module, the org status); in-room
access is `useAppAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                                               | Responsibility                                                                                                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeline.route.tsx`                               | Route marker — exports `Component` rendering `PatientTimelinePage`.                                                                                                                                                                         |
| `timeline.manifest.ts`                             | Manifest — `kind: 'leaf'`, permission `organization:read`, module `app-patients`, title "Overview".                                                                                                                                         |
| `timeline.constants.ts`                            | `TIMELINE_KEYS` (the file's own words reused where they are the same), the cards and tones, test ids.                                                                                                                                       |
| `PatientTimelinePage.tsx`                          | The section: no header, the bento, then the activity timeline — or the visit flow on `?visit=open`.                                                                                                                                         |
| `components/OverviewBento/OverviewBento.tsx`       | The rows and what each card opens, adds and does.                                                                                                                                                                                           |
| `components/OverviewBento/bento-card.tsx`          | A card's frame — head, "New …", "Open" — its rows, outline actions and its read in place (bars, Retry, the empty slot).                                                                                                                     |
| `components/OverviewBento/bento-read.ts`           | A query's flags as a card reads them (`BentoRead`).                                                                                                                                                                                         |
| `components/OverviewBento/bento-clinical.tsx`      | Clinical: the smart note and the four lists.                                                                                                                                                                                                |
| `components/OverviewBento/bento-care.tsx`          | Visits, Packages, Prescriptions, Treatments.                                                                                                                                                                                                |
| `components/OverviewBento/bento-files.tsx`         | Photos, Reports, Team notes.                                                                                                                                                                                                                |
| `components/OverviewBento/smart-note.ts`           | The smart note's keys, per-locale loaders, fold and reader.                                                                                                                                                                                 |
| `components/OverviewBento/smart-note-words/`       | One dictionary per locale (English the prototype's; the rest machine-translated, for native review).                                                                                                                                        |
| `components/OverviewBento/use-smart-note.ts`       | The smart note's text and "Add".                                                                                                                                                                                                            |
| `components/ActivityTimeline/ActivityTimeline.tsx` | The card on the person's stream: the view tabs, the day headings, the rows and what each opens, "Load more".                                                                                                                                |
| `components/ActivityTimeline/activity-timeline.ts` | The views and the stream filter each asks for, a row's tile by its record, the money mask, the day rows.                                                                                                                                    |
| `components/VisitFlow/VisitFlow.tsx`               | The visit flow: its head (Pause, Resume, Complete visit) and the five step cards with their status lines (amounts masked with the file).                                                                                                    |
| `components/VisitFlow/flow-steps.tsx`              | Each step's controls: the checks, the kits, Repeat / New treatment, Create invoice from visit / Custom invoice, Collect; a failed read's Retry.                                                                                             |
| `components/VisitFlow/use-visit-flow.ts`           | The flow's reads (the visit's checks, its Rx and session, the last session, the package, the kits, the patient's invoices of the visit's day) and its writes and links, each left out for a member who can't, toasting in the flow's words. |
| `components/VisitFlow/visit-flow.ts`               | The step states, the remembered settings, the package a repeat spends, the repeated session, the visit's bill (`visitBill`) and the step button classes.                                                                                    |
| `components/VisitFlow/visit-flow.constants.ts`     | `VISIT_FLOW_KEYS` (`patient-file` › `visitFlow.*`), the steps, test ids.                                                                                                                                                                    |

## Test ids

`patient-section-timeline` — the section's root; `overview-bento`, `overview-row-<care|files|money>`,
`overview-card-<card>` (its `-open`, `-new`, `-row`, `-empty`; Visits `-book`; Photos `-upload`,
`-thumb`, `-add`; Prescriptions `-latest`), `overview-clinical-<field>`, `overview-smart-note` · `-add`, `overview-note-input` · `overview-note-post`,
`overview-activity`, `overview-activity-filters`, `overview-activity-filter-<view>` (`all` ·
`clinical` · `money` · `notes`), `overview-activity-row` (`data-kind`: the record's kind, else
`note` / `system`), `overview-activity-more` (`docs/reference/e2e-testids-inventory.md`
› Patient file Overview); the flow's `visit-flow`, `visit-flow-pause` · `-resume` · `-complete`,
`visit-flow-step-<step>` (`checks` · `rx` · `treatment` · `invoice` · `collect`), `visit-flow-retry-<step>`,
`visit-flow-check-<check>`, `visit-flow-kit`, `visit-flow-write-rx`, `visit-flow-repeat`,
`visit-flow-new-treatment`, `visit-flow-create-invoice`, `visit-flow-custom-invoice`,
`visit-flow-collect` (› Patient file visit flow).
