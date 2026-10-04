# `src/shared/clinic/`

Cross-room clinic UI vocabulary for the launch's ten rooms (iteration
`launch-2026-09-30-jxmr`):

- `clinic.constants.ts` — the `clinic` i18n namespace's keys (section names and
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
- `clinic-tones.ts` — each section's, role's and appointment status's tone, and
  a lead's status, source and interest tones (`LEAD_STATUS_TONES`,
  `LEAD_SOURCE_TONES`, `LEAD_INTEREST_TONES` — the contract's `Tone`), an
  offering category's and a photo album's (`OFFERING_CATEGORY_TONES`,
  `IMAGE_ALBUM_TONES`), and
  `TONE_CLASSES`: every tone's utilities as full literals (bg, ink, surface,
  fill, border, dot, halo, ring, tab hover, and a list row's active 55% and
  picked 70%) — never build `bg-tone-${tone}`; `toneForLabel`: the design's
  hash that gives an untoned label (a picker option, a tag) a stable tone.
- `clinic-section-icons.ts` — each section's icon.
- `task-rules.constants.ts` — the task rule catalogue's copy in the `tasks`
  namespace (`TASK_RULE_KEYS`: rule names, Rules-popover lines, automations,
  how-to steps, outcome labels and effect lines, Snooze options, "What’s next"
  When chips). Today's work-queue aside loads `tasks` beside `today`.
- `task-rule-icons.ts` — each task rule's icon (Payment due and Recall: AMBER).
- `clinic-phone.ts` — a typed or pasted mobile as the contract stores it
  (`toClinicPhone`: E.164, a pasted 91 stripped), a stored one as the design
  shows it (`+91 98250 44120`) and the channel links (call, WhatsApp,
  Instagram) the person cards and the chat open.
- `clinic-phone-field.ts` — a drawer's mobile field: its ten digits as typed
  (`clinicPhoneDigits`) and shown (`formatClinicPhoneDigits`, `98250 44120`)
  behind the "+91" box (`CLINIC_PHONE_PREFIX`); apart from `clinic-phone.ts`,
  which the URL readers bring onto the entry chunk.
- `clinic-sections.ts` — the sections in nav order, the section a URL is in
  (`/visits/…` belongs to Today), and where a room the access in force can't
  view sends the member (first viewable after Today; Q-U11) — the org layout's
  `useRoomLanding` applies it on every access change, View-as and its Exit too.
- `clinic-referrer.ts` — the `from` allow-list a shared drawer route keeps its
  referring page with: `safeReferrer` on the drawer's side, `referrerFromPath`
  on the sender's (the page a drawer opens over, when it is an allowed one).
- `patient-file-sections.ts` — the patient file's eleven section slugs (its
  URL segments, `timeline` the Overview it lands on), the billing ones, the
  sections a member may open (Q-F1: billing alone for an Accountant) and the
  role-named gates — Rx Doctor / Admin, treatments Doctor / Therapist, the
  Private album Doctor / Admin, the Owner always passing (`S:35–40`, D22).
- `clinic-command-targets.ts` — where ⌘K's clinic rows go (`/leads/create`,
  `/appointments/create`, `/patients/create`, `/payments/receive`, `/tasks`,
  `/patients/$patientId`, `/leads/$leadId`, `/invoices/$invoiceId`) and
  `clinicCommandNavigation`, which fills in the record param and `from`. Several
  of those routes land with later ledger rows; the table names which.
- `appointment-display.ts` — how every booking surface names and paints a
  booking: the doctor's name (`staffName`), a service's tone
  (`serviceTone`, `APPOINTMENT_TYPE_TONES`) and the person's contact card
  (`appointmentContactCard`) — the Appointments room and the shared
  appointment form read the same rules.
- `clinic-branch.ts` — the branch a new record files under
  (`defaultBranchId`): the header's one open branch, else the main one — a
  new patient's home branch, a new booking's branch.
- `clinic-lead-status.ts` — the label a lead's status shows under: the stored
  status's (`CLINIC_KEYS.leads.statuses`), or "Re-targeted"
  (`CLINIC_KEYS.leads.retargeted`) for a re-target lead still New — the
  contract stores no such status.

Access itself — the fixture matrix, the resolver and the member's clinic roles —
is `src/shared/api/clinic/access-api.ts`, read through
`src/shared/hooks/useClinicAccess/` (narrowed by View-as, `useUIStore.previewRole` —
a contract role or a custom role's id, which the View-as pill names from the
clinozy-be roles and tones from the matrix).
A member's clinic roles are their staff profile's (`useMyStaffProfile`, by sign-in
email), else least privilege from their clinozy-be codes; the Users room and
"Change roles & access" always follow those codes (D17). The Users room's data —
members ⨝ staff profiles, roles ⨝ the matrix — is `src/shared/api/clinic/users-api.ts`,
read through `src/shared/hooks/useTeam/` and `src/shared/hooks/useClinicRoles/`;
`src/shared/hooks/useBranches/` says whether the clinic has several open branches.
Data contracts and fixtures live in `src/shared/api/clinic/`.
