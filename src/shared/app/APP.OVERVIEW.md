# `src/shared/app/`

Cross-room clinic UI vocabulary for the launch's ten rooms (iteration
`launch-2026-09-30-jxmr`):

- `app.constants.ts` — the `app` i18n namespace's keys (section names and
  descriptions, roles; the lead statuses, sources and interests; the list error
  toast `lists.loadFailed`; the appointments domain — statuses,
  the popover's moves and reason lines, the guards, the card's next steps, the
  form's tiles and hints, the cancel reasons and the toasts `useAppointments`
  raises; the offerings domain — category,
  offer-kind and offer-state labels and the toasts `useOfferings` / `useOffers`
  raise; the contract's enum labels the rooms share — channels, check-in
  feels, review sources, payment modes, invoice types, task outcomes). An
  appointment's status has one label set (`appointments.statuses`) and one tone
  map (`APPOINTMENT_STATUS_TONES`) for every room, the chat column included.
  The namespace loads with the org shell, so a
  shared hook's toast reads it in any room — and so does the shared chat
  column, whose copy is the namespace's `chatColumn.*` (keys in
  `shared/components/ChatColumn/chat-column.constants.ts`). Room-only copy
  stays in each room's own namespace (`today`, `leads`, … `users`).
- `app-tones.ts` — each section's, role's and appointment status's tone, and
  a lead's status, source and interest tones (`LEAD_STATUS_TONES`,
  `LEAD_SOURCE_TONES`, `LEAD_INTEREST_TONES` — the contract's `Tone`), an
  offering category's and a photo album's (`OFFERING_CATEGORY_TONES`,
  `IMAGE_ALBUM_TONES`), and
  `TONE_CLASSES`: every tone's utilities as full literals (bg, ink, surface,
  fill, border, dot, halo, ring and a picked badge's `selected` / `selectedHover`
  — both in the tone's `-edge`, never its ink — tab hover, and a list row's
  active 55% and picked 70%) — never build `bg-tone-${tone}`; `toneForLabel`: the design's
  hash that gives an untoned label (a picker option, a tag) a stable tone.
- `app-section-icons.ts` — each section's icon.
- `task-rules.constants.ts` — the task rule catalogue's copy in the `tasks`
  namespace (`TASK_RULE_KEYS`: rule names, Rules-popover lines, automations,
  how-to steps, outcome labels and effect lines, Snooze options, "What’s next"
  When chips). Today's work-queue aside loads `tasks` beside `today`.
- `task-rules.constants.ts` also keys the words the Tasks room and Today's work
  queue share: `TASK_DUE_KEYS` (a due label, worded by
  `src/shared/hooks/useTaskDueLabel/`) and `TASK_QUEUE_KEYS` (Mine · Everyone,
  "Anyone", To do's empty line).
- `task-targets.ts` — where a task's link goes (`TaskTarget`): an outcome's
  follow-on screen (`taskFollowOnTarget`: a new booking, a rebooking, a move,
  the person's record) and its navigation with the room kept behind
  (`taskTargetNavigation`, `from=tasks` / `from=today`).
- `task-rule-icons.ts` — each task rule's icon (the rules the design did not draw take
  their section's: Payment due, Settle credits, Medical rep visits).
- `visit-redirect.ts` — where a visit's work happens: the patient's own page
  with the visit flow open (`patientVisitTarget`: `timeline?visit=open&from=today`,
  Today's "Open session" and "Checkout") and an old Visit link's redirect
  (`visitRedirect`: there is no Visit resource, so its id is read as a booking's —
  `GET /app/appointments/:appointment_id` — and lands on that booking's patient's
  page; an id the server doesn't know (a 404, or a 400 for an id that is not a
  booking's) or a person with no patient file goes to Today with "Visit not
  found"; any other failure is thrown for the route's error boundary; L-64).
- `app-phone.ts` — a typed or pasted mobile as the contract stores it
  (`toAppPhone`: E.164, a pasted 91 stripped), a stored one as the design
  shows it (`+91 98250 44120`) and the channel links (call, WhatsApp,
  Instagram) the person cards and the chat open.
- `app-phone-field.ts` — a drawer's mobile field: its ten digits as typed
  (`appPhoneDigits`) and shown (`formatAppPhoneDigits`, `98250 44120`)
  behind the "+91" box (`APP_PHONE_PREFIX`); apart from `app-phone.ts`,
  which the URL readers bring onto the entry chunk.
- `app-sections.ts` — the sections in nav order, the section a URL is in,
  and where a room the access in force can't
  view sends the member (first viewable after Today; Q-U11) — the org layout's
  `useRoomLanding` applies it on every access change, View-as and its Exit too.
- `app-referrer.ts` — the `from` allow-list a shared drawer route keeps its
  referring page with: `safeReferrer` on the drawer's side, `referrerFromPath`
  on the sender's (the page a drawer opens over, when it is an allowed one),
  `referrerHref` the href of an org-relative path (where a drawer goes back to);
  `visitFlowReferrer` — the patient's visit flow, the one referrer with a query
  (`timeline?visit=open[&from=today]`, `VISIT_REFERRER`). It also holds the
  cross-room drawers (A-P1): `CROSS_ROOM_ROUTES` (the Invoice drawer, Receive
  payment, the appointment drawers, New sale), `crossRoomNavigation` — the
  referring page's URL (the visit flow's query included) with the drawer named
  under `CROSS_ROOM_PARAM`, masked as the drawer's own route — and
  `crossRoomDialogOf`, its reader. `useAppNavigate` opens such a drawer from
  the page; the drawer route hands a deep link over the same way
  (`handOverToReferrer`, `src/app/routes/dialog-routes.ts`); the app's
  `CrossRoomDialogs` gates and renders it over the page, and the rooms'
  dialog-route hooks read it through `useCrossRoomDialog`.
- `patient-file-sections.ts` — the patient file's eleven section slugs (its
  URL segments, `timeline` the Overview it lands on), the billing ones, the
  sections a member may open (Q-F1: billing alone for an Accountant; each care
  section's own read code beside Patients view — `patient:clinical_record:read`,
  `patient_prescription:read`, `patient_treatment:read`) and the file's gates
  (`passesPatientFileGate`): the signed-in member by their own code —
  `patient_prescription:create`, `patient_treatment:create`,
  `patient:private_album:read` — a View-as preview by the role-named gates (Rx
  Doctor / Admin, treatments Doctor / Therapist, the Private album Doctor /
  Admin, the Owner always passing; `S:35–40`, D22).
- `app-command-targets.ts` — where ⌘K's clinic rows go (`/leads/create`,
  `/appointments/create`, `/patients/create`, `/payments/receive`, `/tasks`,
  `/patients/$patientId`, `/leads/$leadId`, `/invoices/$invoiceId`) — and
  Today's "Dispense" (`/medical/sales/create`) — and
  `appCommandNavigation`, which fills in the record param and `from`. Several
  of those routes land with later ledger rows; the table names which.
- `appointment-display.ts` — how every booking surface paints a booking: a
  service's tone (`serviceTone`, `APPOINTMENT_TYPE_TONES`) and the person's contact card
  (`appointmentContactCard`) — the Appointments room and the shared
  appointment form read the same rules.
- `app-branch.ts` — the branch a new record files under
  (`defaultBranchId`): the header's one open branch, else the main one — a
  new patient's home branch, a new booking's branch.
- `app-lead-status.ts` — the label a lead's status shows under: the stored
  status's (`APP_KEYS.leads.statuses`), or "Re-targeted"
  (`APP_KEYS.leads.retargeted`) for a re-target lead still New — the
  contract stores no such status.
- `app-starter-services.ts` — the clinic setup's starter services (feat-clinic-setup D18): each
  specialty's rows (category, minutes, price in rupees, GST, sessions · validity), the
  Consultation "Go live" creates, pinned to `plans/decisions.md` › Starter services by a drift test.
- `pin-directory/` — India Post's PIN directory bundled with the app
  (`lookupPin`: a six-digit PIN → district, state and its offices' areas, or
  `null`), split into one lazy chunk per PIN prefix so only the typed PIN's part
  ever loads, never on first paint; generated by
  `tooling/data/build-pin-directory.mjs` (iteration
  `feat-clinic-setup-2026-10-13-sltd`, D27). Source, licence and loading rules:
  `pin-directory/PIN_DIRECTORY.OVERVIEW.md`.

Access itself — the fixture matrix, the resolver and the member's clinic roles —
is `src/shared/api/app/access-api.ts`, read through
`src/shared/hooks/useAppAccess/` (narrowed by View-as, `useUIStore.previewRole` —
a contract role or a custom role's id, which the View-as pill names from the
clinozy-be roles and tones from the matrix).
A member's clinic roles are their staff profile's (`useMyStaffProfile`, by sign-in
email), else least privilege from their clinozy-be codes; the Users room and
"Change roles & access" always follow those codes (D17). The Users room's data —
members ⨝ staff profiles, roles ⨝ the matrix — is `src/shared/api/app/users-api.ts`,
read through `src/shared/hooks/useTeam/` and `src/shared/hooks/useAppRoles/`;
`src/shared/hooks/useBranches/` says whether the clinic has several open branches.
Data contracts and fixtures live in `src/shared/api/app/`.
