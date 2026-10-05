# `pages/organization/$organizationSlug/patients/$patientId/timeline` — Overview

Route: `/organization/$organizationSlug/patients/$patientId/timeline` — a section of the
patient file (KICKOFF §6.6, D26; H:769–779, H:4840–4864, H:4980–4999). It renders in the file
layout's content column through the family's section frame (`../shared/components/PatientSection/`)
with no header (H:4943; its title stays for screen readers). The default section (D19), built in
L-46: on the canvas, the **bento** of the patient's records — one column, two from 640px of the
content column, three from 1100px (container variants on the scrolling column, its padding inside;
row dense), Clinical, Photos and Team notes two columns wide — then the **activity timeline**. The
**visit flow** takes its place on `?visit=open` while the patient has an open visit (L-49, D18).

- **Cards.** Each card's head has its tone tile, its title and count, its own actions, "New …"
  (the file's Add-to-record item, for a member who may — `../shared/hooks/usePatientFileActions/`)
  and "Open <card>" (its section, when viewable). Clinical: the four lists as chips. Visits:
  "Reschedule" the next visit (its tile) or "Book", the last three completed visits. Photos:
  "Upload", eight thumbnails opening Photos on their album. Packages: each package's sessions as
  segments, "Next · 8 Oct" / "Session 2 overdue" / "All sessions done", "Use session"
  (`../shared/hooks/usePackageSession/`). Prescriptions: the latest Rx, four medicines, its
  advice. Treatments: the last three, each opening its edit drawer. Billing (billing view only):
  Due (masked with the file, its eye) and Paid, the last three invoices opening the Invoice
  drawer (`invoices/$invoiceId/edit` with `from`, or the view), "Collect payment" while
  something is owed. Reports: the last three. Team notes: the composer and the last three notes.
- **Smart note** (Clinical, for a member who edits the patient): the words it knows (H:3702,
  English only) become Complaints, Diagnosis and Suggested chips in one patient write; the Rx
  catalogue's medicines it names open New prescription with a line each
  (`prescriptions/create?medicines=`, AMBER A-F5) — never an Rx saved silently, the Rx gate
  deciding. "Nothing recognised yet" otherwise.
- **Activity timeline** (H:4840–4864, AMBER A-F7): every record — visits, prescriptions,
  treatments, invoices and payments (billing view only), photos, notes — newest first under
  their days ("Today", "3 days ago", "In 2 days", else the date), a day's photos as one row with
  their thumbnails, money masked with the file; the filter chips show their counts (a chip of
  none hides); each row opens its record. A merged activity feed is a backend request.
- **Visit flow** (KICKOFF §6.6 Visit flow, D18; H:758–768, H:4871–4898): on
  `?visit=open` — set by the file bar's "Start visit" (the open visit, else a new one, today's
  booking checked in) and its "Visit in progress · Resume" — one column up to 880px: "Visit in
  progress", Pause (back to the Overview, the visit open) and "✓ Complete visit" (the visit
  done, its follow-up from the Rx, "Visit completed · …"), then five open step cards, the first
  unfinished one current: **Check-in & safety** (three ticking checks, optimistic), **Prescription**
  (one-tap kits saving an Rx, "Write prescription"), **Treatment** ("⚡ Repeat" the last session,
  "New treatment" — both wait for the checks: "Finish check-in first"), **Invoice** (the visit's
  lines and total, "Create invoice from visit", "Custom invoice") and **Collect & share**
  (collect the oldest due in a tap, share the Rx, invoice and photos on WhatsApp). Each step is
  done by its record on the patient's open Visit, and those records move the visit on — Today's
  card changes lane (L-64). "Write prescription" and "New treatment" keep the flow open behind
  their drawer (`?visit=open`) and close back to it — the Rx there is "Approve · print · send to
  pharmacy", tied to the visit's booking; opened from Today's "Open session" or "Checkout"
  (`from=today`), Pause and "Complete visit" go back to Today. Each action shows only for a
  member who may take it; money follows the file's mask. Without an open visit the param is dropped and the Overview stays — a link
  never starts a visit.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                                               | Responsibility                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `timeline.route.tsx`                               | Route marker — exports `Component` rendering `PatientTimelinePage`.                                    |
| `timeline.manifest.ts`                             | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Overview". |
| `timeline.constants.ts`                            | `TIMELINE_KEYS` (the file's own words reused where they are the same), the cards and tones, test ids.  |
| `PatientTimelinePage.tsx`                          | The section: no header, the bento, then the activity timeline — or the visit flow on `?visit=open`.    |
| `components/OverviewBento/OverviewBento.tsx`       | The grid and what each card opens, adds and does.                                                      |
| `components/OverviewBento/bento-card.tsx`          | A card's frame — head, "New …", "Open" — its rows, outline actions and empty line.                     |
| `components/OverviewBento/bento-clinical.tsx`      | Clinical: the smart note and the four lists.                                                           |
| `components/OverviewBento/bento-care.tsx`          | Visits, Packages, Prescriptions, Treatments.                                                           |
| `components/OverviewBento/bento-files.tsx`         | Photos, Billing, Reports, Team notes.                                                                  |
| `components/OverviewBento/smart-note.ts`           | The smart note's dictionary and reader.                                                                |
| `components/OverviewBento/use-smart-note.ts`       | The smart note's text and "Add".                                                                       |
| `components/ActivityTimeline/ActivityTimeline.tsx` | The card: the filter chips, the day headings, the rows.                                                |
| `components/ActivityTimeline/activity-feed.ts`     | The kinds, chips and tones; rows (newest first, a day's photos joined) and counts.                     |
| `components/ActivityTimeline/use-activity-feed.ts` | The patient's records as activity entries, in the viewer's words, each with what opens it.             |
| `components/VisitFlow/VisitFlow.tsx`               | The visit flow: its head (Pause, Complete visit) and the five step cards with their status lines.      |
| `components/VisitFlow/flow-steps.tsx`              | Each step's controls: the checks, the kits, Repeat / New treatment, the invoice, collect and share.    |
| `components/VisitFlow/use-visit-flow.ts`           | The flow's writes and links, each left out for a member who can't, toasting in the flow's words.       |
| `components/VisitFlow/visit-flow.ts`               | The step states, the remembered settings, the Invoice step's lines and the step button classes.        |
| `components/VisitFlow/visit-flow.constants.ts`     | `VISIT_FLOW_KEYS` (`patient-file` › `visitFlow.*`), the steps, test ids.                               |

## Test ids

`patient-section-timeline` — the section's root; `overview-bento`, `overview-card-<card>` (its
`-open`, `-new`, `-row`, `-empty`; Visits `-book`; Photos `-upload`, `-thumb`; Packages `-use`;
Prescriptions `-latest`; Billing `-eye`, `-collect`), `overview-smart-note` · `-add`,
`overview-note-input` · `overview-note-post`, `overview-activity`,
`overview-activity-filter-<kind>`, `overview-activity-row` (`docs/reference/e2e-testids-inventory.md`
› Patient file Overview); the flow's `visit-flow`, `visit-flow-pause` · `-complete`,
`visit-flow-step-<step>`, `visit-flow-check-<check>`, `visit-flow-kit`, `visit-flow-write-rx`,
`visit-flow-repeat`, `visit-flow-new-treatment`, `visit-flow-create-invoice` · `-custom-invoice`,
`visit-flow-collect-<mode>`, `visit-flow-share` (› Patient file visit flow).
