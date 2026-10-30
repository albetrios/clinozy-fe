# KICKOFF — feat-lead-follows-bookings-2026-10-30-ytqj (clinozy-fe)

## 1. Header

| Field                 | Value                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Iteration             | `feat-lead-follows-bookings-2026-10-30-ytqj` — the frontend's part; the contract is clinozy-be's same-named plan (`plans/routes-final.md`, final 2026-10-30) |
| Mode                  | initial — Baseline `none`                                                                                                                                    |
| Sources               | `intake-files/BRIEF.md` (Intake mode `brief`, from scratch, Intake hash `5bae0977a19a` — byte-identical to clinozy-be's)                                     |
| Branch                | `feat/lead-follows-bookings` — from `7febaec` (the first slice, D9)                                                                                          |
| Date                  | 2026-10-30                                                                                                                                                   |
| Evidence notation     | `BRIEF.md:<line>`; clinozy-be `routes-final.md` §n / LFn / AFn; decisions `Dn`                                                                               |
| Planned by / built by | `fe-iteration-planning` / `fe-kickoff-iteration` (rows through their skills below)                                                                           |

## 2. Locked decisions

| #                                                   | Decision                                                                                                                  | Date       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [D1](plans/decisions.md)                            | A booking step on the lead: Appointment scheduled while booked, Clinic visited at check-in, back to Follow-up on a cancel | 2026-10-28 |
| [D2](plans/decisions.md)                            | A check-in wins back a lead closed Lost / Not interested within 90 days (the server's)                                    | 2026-10-30 |
| [D3](plans/decisions.md)                            | A walk-in keeps another booking; a heads-up after Start visit                                                             | 2026-10-30 |
| [D6](plans/decisions.md)                            | Completed steps: a light tint of their own colour with a ✓; the current step strongest                                    | 2026-10-30 |
| [D11](plans/decisions.md)                           | The close date is read-only output, shown on a closed lead                                                                | 2026-10-30 |
| [D16](plans/decisions.md)–[D18](plans/decisions.md) | The backend's route review is final — this plan builds against it                                                         | 2026-10-30 |
| [D19](plans/decisions.md)–[D22](plans/decisions.md) | AMBER: the shared next-booking helper, the heads-up toast, the exact track look, the close date in Info                   | 2026-10-30 |

## 3. Foundation (before any screen)

- **Theme preset** — n/a: no preset or token change; the track uses the existing tone tokens (`TONE_CLASSES`, `bg-tone-<tone>/<n>`), both themes.
- **Shell** — n/a: no shell change.
- **Stores** — n/a: no new store; server state stays in TanStack Query.
- **Icons** — n/a: `Check`, `Calendar` exist in `@/shared/icons/index.ts`.

## 4. Route / island map

No route or island is added.

| Screen                                  | Island                                                   | Access                                   | Kind              | What changes                                                                                                              |
| --------------------------------------- | -------------------------------------------------------- | ---------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Lead drawer (`leads`, `/leads/$leadId`) | `src/pages/organization/$organizationSlug/leads/`        | org-scoped · Leads › View (Edit to move) | URL-driven dialog | Progress: five steps, Book, the booking still to happen, the locks, the done look (D21), a phone list; Info: Closed (D22) |
| Leads list (`leads`)                    | same                                                     | Leads › View                             | page              | the Status filter's order (pipeline)                                                                                      |
| Today — walk-in (`today`)               | `…/today/` (via the command menu's person → Start visit) | Appointments › Create                    | page              | the heads-up after a walk-in (D20)                                                                                        |
| Patient file — Start visit (`patients`) | `…/patients/$patientId/`                                 | Appointments › Create                    | page              | the same heads-up (one hook)                                                                                              |

## 5. State management map

| Screen      | Server state                                                                                                                                     | Client state                                                                                                                        | URL state | Form state                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------- |
| Lead drawer | `useLead*` (leads), `usePersonAppointments(contactId)` for the booking still to happen; every appointment write invalidates the leads (as built) | the drawer's draft (`useLeadDraft`, rebased on a server move — built) and the open booking form / cancel confirm (`useLeadBooking`) | `$leadId` | the booking form's own (shared `AppointmentForm`) |
| Start visit | `useStartVisit` → after a walk-in, the person's bookings read once (`fetchPersonAppointments`)                                                   | none                                                                                                                                | none      | none                                              |

## 6. Per-screen build notes

**Lead drawer › Progress** (skills: `shadcn` → `frontend-design` → `web-design-guidelines` → `fe-test-generation` → `fe-e2e-testids` → `fe-i18n-constants`):

- Five tiles `lead-drawer-step-<status>`; step 4 "Book" opens the booking form on the person (built — verify, D9).
- **Done look (D21):** done — `bg-tone-<tone>/40`, the tone's ink, the solid ✓ disc in the tone's dot colour, full bar;
  current — the tone's surface with a 2px inset ring in its dot colour, semibold; next — `bg-card`, muted ink, dashed
  number, empty bar. The `transition-colors` stays (150 ms, as built). Contrast checked in both themes at Close.
- The booking still to happen row, the locks and the phone list (from 28rem) — built — verify.
- **Info › Closed (D22):** a fact "Closed" with `clock.moment(closedAt)` on a closed lead; none while open.

**Start visit heads-up (D20)** (skills: `fe-resilient-interactions` → `fe-http-forms-errors` → `fe-test-generation`):

- `startVisit` reports what it did (`open` · `checked_in` · `walk_in`); after a `walk_in`, the person's bookings are read
  once; when one is still to happen on a **later** day (the shared next-booking helper, D19), an info toast
  "Also booked · <day> · <time>" with **Open** → the booking's drawer in Appointments. A failed read shows nothing (the
  walk-in already succeeded).

**Contract** (skill: `fe-resource-crud`): `closed_at` in the lead wire and `LeadRecord.closedAt`; `pnpm api:types` from
clinozy-be's OpenAPI once its R2 lands.

## 7. Deviations

- n/a — a brief has no prototype; project rules hold (semantic tone tokens only, shadcn `Button`, i18n keys, icons from the
  registry). Baseline `none`: no Standing deviations apply.

## 8. Verification

- `brief` → the `BRIEF.md` acceptance criteria for the screens (BRIEF.md:139–147: A13 the heads-up, A14–A18) — each with a
  test, and screenshots at **375px and 1440px** of the drawer (open lead, booked, after a cancel, closed) and the heads-up.
- The static gates: `pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure && pnpm validate:testids && pnpm type-check && pnpm lint`; `pnpm sync:check`; `pnpm api:types:check`, `pnpm app:schema:check`.
- Colocated Vitest per unit, and the full `pnpm test`.
- Close: `AS-BUILT.md` with its Standing deviations; `pnpm iteration:status … done`; `frozen` in the last commit.

## 9. The route — the ordered ledger

| #   | Work item                                                                                                                                                                                               | Kind    | Depends on    | Skill/driver                                                                               | Acceptance                                                                                          | Assignee | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------- | ------ |
| F1  | The first slice — five steps, Book, the booking still to happen, the locks, the phone list, the label / tone / filter order, the draft rebase (`7febaec`) — verified against the brief and routes-final | verify  | —             | `fe-kickoff-iteration` (verify)                                                            | A14–A16; its tests green                                                                            | Claude   | open   |
| F2  | The done look (D6, D21)                                                                                                                                                                                 | styling | F1            | `frontend-design` → `web-design-guidelines` → `fe-theme-axis-audit` → `fe-test-generation` | A17; the track tests; screenshots light + dark, 375 + 1440                                          | Claude   | open   |
| F3  | The close date — the wire, `LeadRecord.closedAt`, regenerated API types, Info's "Closed" (D11, D22)                                                                                                     | screen  | clinozy-be R2 | `fe-resource-crud` → `fe-locale-formatting` → `fe-test-generation`                         | `closedAt` parsed; Info shows it on a closed lead only                                              | Claude   | open   |
| F4  | Start visit's heads-up (D3, D19, D20) — the shared next-booking helper (promoted)                                                                                                                       | screen  | F1            | `fe-component-promotion` → `fe-resilient-interactions` → `fe-test-generation`              | A13 (the frontend's half): a walk-in with a later booking shows the toast with Open; none otherwise | Claude   | open   |
| F5  | Copy and docs — every new string in the 11 locales; LEADS.OVERVIEW, the Today and patient-file overviews; `docs/reference/routes-and-ui.md`                                                             | copy    | F2–F4         | `fe-i18n-constants` → `fe-documentation-maintenance`                                       | A18; `pnpm sync:check`                                                                              | Claude   | open   |
| F6  | Gates and acceptance — the static gates, `pnpm test`, the screenshots, `plans/acceptance` rows A13–A18 with evidence                                                                                    | gate    | F1–F5         | `fe-kickoff-iteration` › Close                                                             | every gate green; A13–A18 evidenced                                                                 | Claude   | open   |
