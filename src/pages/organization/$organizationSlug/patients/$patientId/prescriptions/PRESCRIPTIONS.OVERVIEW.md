# `pages/organization/$organizationSlug/patients/$patientId/prescriptions` — Prescriptions

Route: `/organization/$organizationSlug/patients/$patientId/prescriptions` — a section of the
patient file (KICKOFF §6.6, D26; H:4753; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the section's table (L-43b) on the family's `../shared/components/PatientSectionTable/` — the shared data table with selection and Export, folded columns on a tablet, rows with the key column on a phone, the footer count and "All … loaded", or the section's empty state, or the read's failure with Retry: ID · Date · Medicines (the names over their directions) · Notes (hidden) · Doctor · Status (Draft · Approved) · Updated (hidden; when only — the API names no author, G4) — the directions read the days too (change-prescription-writing D8); a row opens Edit prescription; Print, Preview, Copy prescription, Sell medicines (an approved one), Edit and Delete (a draft; "Delete this prescription?", Undo). Its URL-driven dialogs (L-45; `S:35–37`) render nothing — the section
reads the URL (`../shared/hooks/usePatientRecordRoute/`) and opens them over itself: `create/` and
`$prescriptionId/edit/` the Prescription drawer, `$prescriptionId/` the print preview; `create/`
takes `?medicines=` — the names the Overview's smart note recognised, each a line of the new Rx
(AMBER A-F5). The drawer is also reached from ⌘K ("Write prescription", a patient finder) and
the Patients room's row action (feat-prescription-composer).

## The composer (feat-prescription-composer)

- **Straight to medicines.** New and Edit open on step 2; a new one puts the cursor in the quick
  line (its suggestions stay closed until typing). No doctor → step 1.
- **The Rx Pad** (`components/PrescriptionDrawer/rx-pad.ts` reads, `components/PrescriptionDrawer/rx-pad-panel.tsx` draws): many lines of the quick line's
  shorthand at once — bullets, numbering and "Tab." / "Cap." / … stripped — with a live preview
  (found · added as typed · skipped, the pills, stock, an allergy mark) and "Add N medicines"
  (⌘/Ctrl ↵). It never saves.
- **The Rx sidekick** (`components/PrescriptionDrawer/rx-sidekick.tsx`; `components/PrescriptionDrawer/use-rx-composer.tsx` holds it): the patient's
  allergies (`components/PrescriptionDrawer/rx-allergy.ts` — word stems and five drug families; the file's `allergies`, `null`
  = not visible → no guard), since last Rx (`components/PrescriptionDrawer/rx-since-last.ts` — New · Changed · Unchanged ·
  Stopped with Continue), and what the patient reads (`components/PrescriptionDrawer/rx-plain.ts`, `components/PrescriptionDrawer/use-rx-plain.ts`). From
  `xl` a 320px column (the drawer grows to `min(1360, 100vw − 56)`); below, a folded card.
- **The allergy guard**: a band under the header (`components/PrescriptionDrawer/rx-allergy-band.tsx`) on every tier, and the
  warning under each matching row (`components/PrescriptionDrawer/rx-row-allergy.tsx`, in `ItemsField`'s `rowFooter`) with
  Remove and Keep — no dialog. A save with a warning not yet answered opens Medicines, brings the warning into view
  and focuses Keep (change-prescription-writing D7); Keep is one tap, it never blocks.

## The medicine rows (change-prescription-writing … change-prescription-one-line)

- **Store or outside** (`components/PrescriptionDrawer/rx-medicine-cell.tsx`): the trigger names the medicine and its
  source — the store's stock (sage), out of stock (blush), or Outside (slate, a name written as text, `medicine_id`
  none). The list groups "In your medical store" and "Outside medicines"; a new name is an outside medicine; the
  list's footer switches the line store ↔ outside. On a touch screen the picker is 44px high, like the line's
  segments and quantity stepper (change-prescription-touch-picker); the shared picker keeps its sizes elsewhere.
- **One line per medicine, one click, no dropdown** (change-prescription-compact-line, change-prescription-one-line;
  `components/PrescriptionDrawer/rx-item-cells.tsx`): every everyday choice is a small segment on a tray (a `muted`
  track, the lit segment in its tone and raised — 24px with a mouse, 44px high on touch); a second click clears it.
  Each line is numbered and reads Medicine · **Dose · M A N** (the taps read as the dose, `1 0 1`; SOS) · **Days**
  (3 · 5 · 7 · 10 · 14 · 30 and a number box) · **Meal · Where** (a tablet's Before · After, a skin medicine's Face ·
  Scalp — `rxIsSkinLine` — then **More**) · Qty. More is a popover with the rarer choices: every Meal or When timing,
  every place, ×2 and the note; once one is set its words show on More, lit ("Neck +1"). The note shows as one quiet
  line under its medicine only when there is one. Days and Meal · Where are columns while the table is at least
  870px wide with a mouse (1090px on touch, `useElementWidth`), else both lead the line under the medicine
  (`ItemsField`'s `rowDetail`). The medicine column takes only the room the others leave. "All medicines · Days"
  above the lines sets one course on every line. Each tray is an ARIA toolbar — one Tab stop, the arrow keys within
  (mirrored right to left). The line's tracks are CSS variables the table sets per pointer.
- **The drawer's own stylesheet** (`components/PrescriptionDrawer/prescription-drawer.css`, fix-prescription-css-budget):
  the tracks, the segments' sizes, every touch size and the Rx Pad's heights live here, imported by the drawer, so
  they load with the prescriptions island instead of the 36 kB first-paint stylesheet. A size only this drawer draws
  goes there, not into a new Tailwind utility; `components/PrescriptionDrawer/prescription-drawer-css.test.ts` pins the touch sizes.
- **Days**: a line's own `days` (the form's — the wire keeps them first in `remarks`, "7 days · …", split on open and
  joined on save, `components/PrescriptionDrawer/rx-form.ts` `rxSplitDays` / `rxRemarksOf`); the quantity follows
  days × doses a day.
- **Earlier prescriptions** (the sidekick): the patient's other prescriptions one at a time with ‹ ›, each line in plain
  words with + Add (or "In this Rx"), Add all, and the advice.

## Data — clinozy-be (api-integration §5.4)

- `GET /app/patients/:patient_id/prescriptions` (every page, `sort=prescription_date`, newest
  first), `GET …/:patient_prescription_id`, `POST`, `PATCH` (a draft, with `expected_updated_at`),
  `POST …/approve`, `DELETE` (a draft, with the confirm's reason) and `POST …/restore` (Undo) —
  `src/shared/api/app/prescriptions-api.ts`, its shapes in
  `src/shared/api/app/prescriptions-contracts.ts`, the hooks in
  `src/shared/hooks/usePrescriptions/`.
- **Draft until approved (Q19).** A member holding `patient_prescription:update` saves with
  "Save & approve" (the write, then `…/approve`); anyone else who writes (`…:create`) saves a
  draft. An approved prescription is final — read-only, no Delete — and only an approved one
  sells (a sale fills an approved Rx). Delete is `…:delete`. View-as previews by the role gate.
- **Kits:** the member's own (`GET /app/prescription-kits`) in Quick fill; a kit copies its lines.
- **Medicines:** `medicine_name` is free text. The drawer suggests the store's medicines
  (`GET /app/medicines`, `medicine:read`) with their stock, and the names the patient's own
  prescriptions carry with the patient's last line of each. No MRP until the rupee formatter
  (F10); no "Often prescribed" and no clinic-wide last dose (G4); the quick-create drafts go.
- **Print:** the browser prints the record as read (`components/RxPrintPreview/use-rx-sheet.tsx`):
  the patient from the file, the doctor from the team, the clinic from `GET /tenancy/organization`
  and the patient's home branch's phone and GSTIN from `GET /app/branches/:branch_id`
  (`branch:read` only). No server PDF, no share (§6 #26).

Gated by the file layout (membership, the `app-patients` module, the org status, the section's
`patient_prescription:read`); in-room access is `usePrescriptionAccess`. Registered in
`src/app/routes/routeTree.tsx` through the file's one lazy module (`../patient-id.sections.ts`).

## Files

| File                                                     | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prescriptions.route.tsx`                                | Route marker — exports `Component` rendering `PatientPrescriptionsPage`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `prescriptions.manifest.ts`                              | Manifest — `kind: 'layout'` (children `create`, `$prescriptionId`), permission `organization:read`, module `app-patients`, title "Prescriptions".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `prescriptions.constants.ts`                             | The drawer's and preview's copy keys, the status and kit tones, and root test ids.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `PatientPrescriptionsPage.tsx`                           | The section, and the dialog its URL names: the drawer once the history, the medicines, the kits and the default doctor are read; the preview once the sheet's clinic is.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `hooks/usePrescriptionsTable/`                           | The columns (1100px): Date the primary, Medicines the phone key, Status a pill; Notes and Updated hidden; the people fold to nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `hooks/usePrescriptionRowActions/`                       | A row's actions behind their gates: Print (the A4 sheet straight to the printer), Preview, Copy prescription (today's draft), Sell medicines (an approved one — New sale on the Rx and its patient, `?prescription=&customer=`, the section behind it), Edit and Delete (a draft).                                                                                                                                                                                                                                                                                                                                                                                  |
| `components/PrescriptionDrawer/`                         | The 1040px drawer (1360 with the sidekick from `xl`), opening on Medicines: "Prescription" (Date, Doctor — the team) → "Medicines" (the quick line + Browse + Pad on the shared `QuickLine`, the Rx parser `components/PrescriptionDrawer/rx-quick-line.ts`, the Pad `components/PrescriptionDrawer/rx-pad.ts`, the medicines table) → "Clinical notes"; the allergy band, each matching row's warning and the sidekick (the composer above); Quick fill Print / Repeat last / the member's kits; "Save & approve" or a draft's save, the server's field errors on their rows, Reload on a stale save; "Save & sell" (New sale on the approved Rx and its patient). |
| `components/RxPrintPreview/`                             | The print preview: an 820px panel holding the shared A4 sheet (`PrescriptionPrint`), fitted to its width; "Print / Save PDF" — and `components/RxPrintPreview/use-rx-sheet.tsx`, the sheet's parts and the print.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `create/` · `$prescriptionId/` · `$prescriptionId/edit/` | The dialog routes (each renders nothing).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `__tests__/integration/`                                 | `__tests__/integration/prescription-doubles.ts` (records and an in-memory stand-in for the prescriptions API) and `__tests__/integration/prescriptions-test-router.tsx` (the section with its dialog routes) for this island's suites.                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Test ids

`patient-section-prescriptions` — the section's root; `patient-prescriptions-table`, its rows and `patient-prescriptions-row-action-<id>`; `rx-drawer`, `rx-drawer-approved` (an approved one's note), `rx-drawer-quick-fill-kit-<kit id>`, `rx-drawer-allergy-band`, `rx-items-allergy`, `rx-pad-toggle` / `rx-pad`, `rx-sidekick`, `rx-print-preview` and their parts
(`docs/reference/e2e-testids-inventory.md` › Patient file records).
