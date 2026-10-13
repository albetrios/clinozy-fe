# KICKOFF — change-empty-states-2026-10-13-ssai

> The plan and the ordered ledger for a standalone iteration (Baseline `none`) from a complete,
> self-contained drop. Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Iteration         | `change-empty-states-2026-10-13-ssai`                                                                        |
| Mode              | initial — Baseline `none` ([D2](plans/decisions.md)); not related to any earlier iteration                   |
| Intake mode       | full — 7 files received ([D3](plans/decisions.md))                                                           |
| Intake hash       | `04c40ad0cbd8` (gate passed 2026-10-13)                                                                      |
| Schema-routes     | `dc1fa4c9a7bc` — no entity, API route or frontend route changes                                              |
| Sources           | `intake-files/` (PRD, screen spec, preset, shell, prototype) and the current code                            |
| Date              | 2026-10-13                                                                                                   |
| Evidence notation | `<file>:<line>` in `intake-files/`, `src/…:<line>` in the code today                                         |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration`                                                  |
| Builds with       | `frontend-design`, `fe-i18n-constants`, `fe-test-generation`, `fe-theme-axis-audit`, `web-design-guidelines` |
| Repositories      | clinozy-fe only ([D4](plans/decisions.md))                                                                   |

## 2. Locked decisions

1. Type `change`, topic `empty-states`, branch `feat/colorful-empty-states` — [D1](plans/decisions.md).
2. Baseline `none`, Intake mode `full` with a self-contained drop — [D2](plans/decisions.md), [D3](plans/decisions.md).
3. Frontend only — [D4](plans/decisions.md).
4. Empties inside a populated screen take the compact look — [D5](plans/decisions.md).
5. "More colorful" = tone-colored ring, gradient tile, three-tone dots, existing tokens only — [D6](plans/decisions.md).
6. "In center" = `my-auto` in a column that owns the remaining height — [D7](plans/decisions.md).
7. Calendars, search-result empties, dialog lines and the organization picker stay as they are — [D8](plans/decisions.md), [D9](plans/decisions.md).
8. Colorful tones already set by the launch stay; grey ones (`stone`, `slate`) are re-toned — [D10](plans/decisions.md).
9. New strings ship in all eleven locales (AMBER: a native read) — [D11](plans/decisions.md).
10. Approved on the user's request to build and push; the PR waits for their confirmation — [D12](plans/decisions.md).

## 3. Foundation (before any screen)

### 3.1 Theme

n/a — no preset, token or contrast change. The art uses the existing tone tokens
(`--color-tone-<tone>`, `-foreground`, `-border`, `-dot`; `src/index.css:240–282`, dark `:590–640`)
through literal Tailwind classes, so Tailwind sees each (`preset.md:5–9`). The art is decorative
(`aria-hidden`) — no contrast floor; the title and line keep their text tokens. Every corner is a
named radius step; every full circle is a dot or ring carrying `data-slot="pill"`
(`validate:theme-axis`).

### 3.2 Shell

n/a — the shell does not change (`shell.md:3`). Only where an empty state sits inside it (§6).

### 3.3 Stores

n/a — none.

### 3.4 Icons

Add to `src/shared/icons/index.ts` (the one icon surface): `Armchair`, `ArrowLeftRight`, `Briefcase`,
`Factory`, `History`, `Hourglass`, `KeyRound`, `ShoppingCart`, `Truck`, `Webhook`. Already exported
and reused: `Bell`, `Calendar`, `Camera`, `CheckCircle`, `Clock`, `Compass`, `CreditCard`,
`FileIcon`, `Fingerprint`, `Laptop`, `MapPin`, `MessageSquare`, `Package`, `Pill`, `Plug`,
`Receipt`, `Search`, `Send`, `ShieldCheck`, `Sparkles`, `SquareCheck`, `Star`, `Stethoscope`, `Tag`,
`UserCog`, `UserPlus`, `Users`, `Wallet`, `Zap`.

## 4. Route / island map

n/a — no route, island, manifest or registration changes (`schema-routes.md:15–31`). Every change is
inside existing islands and shared units.

## 5. State management map

n/a — no new state. Each empty state reads the list state its screen already has (loaded, empty,
filtered, failed); permissions for actions come from the existing `useAppAccess` checks.

## 6. Per-screen build notes

### 6.1 `EmptyState` — the room look, colorful and centered — `frontend-design`, `fe-theme-axis-audit`, `fe-test-generation`

- Anatomy per `preset.md:27–40`: a 112px box (`size-28`); ring `inset-0`, 1.5px dashed, tone border;
  disc `inset-3.5`, tone fill; tile 48px `rounded-2xl`, `bg-linear-to-br` from tone dot to tone ink,
  `text-background`, `shadow-xs`, icon 22px; dots 10px tone dot (`top-3 end-2.5`), 7px first accent
  (`bottom-4 start-2`), 5px second accent (`top-2 start-4.5`).
- Accents: a fixed map, tone → two other tones (`preset.md:8–24`), drawn through `TONE_CLASSES[…].dot`.
- Gradient and ring classes: a literal per-tone map in the unit (Tailwind needs full class names).
- Placement: wrapper `my-auto` (centered in a flex column, a no-op elsewhere), `py-12` (was
  `pt-16 pb-18`), the rest unchanged — title `text-title` 600, line `text-detail` muted max 320px,
  action 6px gap below (`preset.md:38–40`).
- The filtered look keeps its words and Search icon, now in the same art (`empty-states.md:12–15`).
- Unit tests: the art in every tone, accent dots present, `aria-hidden`, heading level, the filtered
  state; axe.

### 6.2 `EmptyState` — the compact look and the card's art — `frontend-design`, `fe-test-generation`

- New `variant="compact"` (needs `tone` and `icon`): a 56px box (`size-14`), ring, disc `inset-1.5`,
  32px `rounded-lg` gradient tile, 16px icon, one 7px accent dot; title a `<p>`, `text-body` 500
  soft ink; optional line `text-xs` muted; optional action 8px below; wrapper `my-auto`, `py-6`
  (`preset.md:45–55`).
- `variant="card"` gains the compact art (no ring) above its title when `tone` and `icon` are given
  (`preset.md:58–61`).
- `variant="inline"` stays for the out-of-scope lines (D9).

### 6.3 The table body gives the empty state its height — `fe-test-generation`

`DataTable`'s body (`src/shared/components/DataTable/DataTable.tsx:418`) is `shrink-0`; when it has no
rows it becomes a growing column (`flex flex-1 flex-col`) and so do its row and cell, so the room look's
`my-auto` centers it in the card body (`shell.md:6–10`). The skeleton rows keep to the top (they do
not grow). The default empty line (no `empty` prop) becomes a compact look in stone — no table in the
clinic rooms relies on it.

### 6.4 Rooms, tabs and cards

Every row of `empty-states.md` R1–R48 and C1–C15, as listed there (tone, icon, title, line,
action). The notable rewrites:

- **Appointments › Agenda** (`AppointmentsAgenda.tsx:71–92`): the inline "No appointments here ·
  book one" becomes the room look — sky, `Calendar`, new title and line, the "New appointment"
  button (existing `toolbar.newAppointment`) for a member who may book; test id
  `appointments-book-one` moves to the button (E2E keeps working).
- **Leads** (`LeadsPage.tsx:115–152`): room look — lav, `UserPlus`, new "No leads yet" + line + "New
  lead"; filtered: `Search`, existing "No leads match" + "Clear filters".
- **Tasks** (`TaskList.tsx:101–128`): room look per view — plum; To do `SquareCheck` with new title
  "All caught up" over the existing line + "New task"; Snoozed `Clock`; Done `CheckCircle`. The view
  fills the list's height.
- **Today** (`LanePanel.tsx:265–270`): room look in the lane's tone and icon, filling the panel; the
  work queue (`WorkQueue.tsx:327–333`) compact, plum.
- **Patient file** — Photos (`PatientImagesPage.tsx:97–120`), Packages
  (`PatientPackagesPage.tsx:214–220`), Team notes (`PatientNotesPage.tsx:163–169`): room look in the
  section's tone and icon; the table sections already use `RoomTableEmpty` and inherit 6.1; Overview
  clinical cards, the Feedback card, the timeline cards and Activity: compact.
- **Medical / Clinic stock** (`MedicalTable.tsx:40`, `StockTable.tsx:37`): one icon per tab instead of
  one per room.
- **Grey → color**: Notifications, Sessions, Members, Roles, API keys, Webhooks, delivery attempts and
  the empty home take the tones in R41–R48.

## 7. Deviations

### 7.1 md over prototype

- The prototype's dark values are approximations; the build uses the app's own dark tone tokens
  (`preset.md:24`).
- The prototype shows sample words for Patients and Payments; the build keeps the shipped strings
  ("existing" in `empty-states.md`).

### 7.2 Project rules over the source

- Icons through `@/shared/icons/index.ts` only (the prototype inlines SVG).
- Semantic and tone tokens only; no inline styles (the prototype uses CSS variables).
- Every string an i18n key in eleven locales.

### 7.3 Standing deviations

n/a — Baseline `none`: no Baseline list to carry. This iteration's own deviations are listed in its
`AS-BUILT.md`.

## 8. Verification

- **The acceptance criteria** (`PRD.md:71–83`) and side by side with the prototype at **375px and
  1440px**, light and dark, for a sample of every look: a room table (Agenda), a view without a card
  (Tasks), a lane (Today), a patient-file section, a compact card, a settings panel, the filtered look.
- **Static gates:** `pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure &&
pnpm validate:testids && pnpm type-check && pnpm lint && pnpm biome:check`.
- **Unit:** colocated Vitest for `EmptyState`, `DataTable`, and every touched unit's existing suite;
  then the full `pnpm test`.
- **Build:** `pnpm build` (as CI builds) and `pnpm size` within the first-paint budgets.
- **Close:** `AS-BUILT.md` summary and its deviations, `pnpm iteration:status <it> done`; `frozen` in
  the last commit before the branch merges (after the user's confirmation of the PR).

## 9. The route — the ordered ledger

| #    | Work item                                                     | Kind       | Depends on | Skill/driver                        | Acceptance                                                  | Assignee | Status                        |
| ---- | ------------------------------------------------------------- | ---------- | ---------- | ----------------------------------- | ----------------------------------------------------------- | -------- | ----------------------------- |
| L-1  | Icon exports (§3.4)                                           | foundation | —          | fe-kickoff-iteration                | the ten exports resolve; lint forbids direct lucide imports | Claude   | done                          |
| L-2  | `EmptyState` room look — colorful + centered (§6.1)           | global     | L-1        | frontend-design, fe-test-generation | unit tests + axe; `validate:theme-axis`, `validate:tokens`  | Claude   | done                          |
| L-3  | `EmptyState` compact look + card art (§6.2)                   | global     | L-2        | frontend-design, fe-test-generation | unit tests + axe                                            | Claude   | done                          |
| L-4  | `DataTable` empty body fills the card (§6.3)                  | global     | L-2        | fe-test-generation                  | unit test: empty body grows, skeleton does not              | Claude   | done                          |
| L-5  | New strings, eleven locales (D11)                             | copy       | —          | fe-i18n-constants                   | locale parity check                                         | Claude   | done                          |
| L-6  | Appointments › Agenda (R10)                                   | styling    | L-2, L-5   | fe-kickoff-iteration                | unit test; running app                                      | Claude   | done                          |
| L-7  | Leads (R8, R9)                                                | styling    | L-2, L-5   | fe-kickoff-iteration                | unit test; running app                                      | Claude   | done                          |
| L-8  | Tasks (R34–R36)                                               | styling    | L-2, L-5   | fe-kickoff-iteration                | unit test; running app                                      | Claude   | done                          |
| L-9  | Today lanes + work queue (R1–R7, C1)                          | styling    | L-3        | fe-kickoff-iteration                | unit test; running app                                      | Claude   | done                          |
| L-10 | Patient file sections (R12–R20)                               | styling    | L-2        | fe-kickoff-iteration                | unit test; running app                                      | Claude   | done                          |
| L-11 | Patient overview, timeline, ideas, chat card (C2–C9, C15)     | styling    | L-3        | fe-kickoff-iteration                | unit test                                                   | Claude   | done                          |
| L-12 | Medical + Clinic stock per-tab icons (R21–R31)                | styling    | L-1, L-2   | fe-kickoff-iteration                | unit test; running app                                      | Claude   | done                          |
| L-13 | Payments, Offerings, Users, home (R32–R33, R37–R41, C10, C11) | styling    | L-2, L-3   | fe-kickoff-iteration                | unit test; running app                                      | Claude   | done                          |
| L-14 | Notifications + settings (R42–R48, C12–C14)                   | styling    | L-2, L-3   | fe-kickoff-iteration                | unit test                                                   | Claude   | done                          |
| L-15 | Docs: unit overviews, design reference                        | copy       | L-2–L-14   | fe-documentation-maintenance        | `pnpm sync:check`                                           | Claude   | done                          |
| L-16 | Verify in the running app (§8)                                | verify     | L-6–L-14   | fe-kickoff-iteration                | screenshots 375 + 1440, light + dark                        | Claude   | done                          |
| L-17 | Gates (§8)                                                    | gate       | L-1–L-15   | fe-before-commit-guard              | every gate green; `pnpm test`; `pnpm size`                  | Claude   | done (revised → AS-BUILT #16) |
| L-18 | Close: `AS-BUILT.md`, Status `done`                           | verify     | L-16, L-17 | fe-kickoff-iteration                | `pnpm iteration:status <it> done`                           | Claude   | done                          |

## Appendix A — Coverage matrix

| File                | Read fully? | Kind             | Screens/facts it owns                                      | In plan at        |
| ------------------- | ----------- | ---------------- | ---------------------------------------------------------- | ----------------- |
| `PRD.md`            | yes         | requirement      | the request, what changes, rules, acceptance, out of scope | §2, §6, §8, D8–D9 |
| `schema-routes.md`  | yes         | contract         | no entity / API / route change; the routes touched         | §4, D4            |
| `_index.md`         | yes         | index            | one screen, `empty-states`; shared files                   | §6                |
| `empty-states.md`   | yes         | screen spec      | looks, the R1–R48 and C1–C15 inventory, phone, a11y        | §6.4, L-6–L-14    |
| `preset.md`         | yes         | tokens + anatomy | tones, accents, the room and compact anatomy, the card art | §3.1, §6.1, §6.2  |
| `shell.md`          | yes         | placement        | table card, views, lanes, cards, settings, phone, motion   | §6.3, §6.4        |
| `empty-states.html` | yes         | prototype        | both looks in every section's tone, before → after, dark   | §7.1, §8          |

No JS file is loaded by the prototype (one inline theme switch); no extras; no unlisted screens.

## Appendix B — Reconciliation (md ↔ prototype ↔ code)

| #   | Fact                 | md says                                         | Prototype says                                           | Winner | Action                      |
| --- | -------------------- | ----------------------------------------------- | -------------------------------------------------------- | ------ | --------------------------- |
| 1   | Room art size        | 112px (`preset.md:31`)                          | `.art` 112px (`empty-states.html:49`)                    | agree  | build 112px                 |
| 2   | Ring paint           | dashed, tone border (`preset.md:31`)            | `.ring` dashed `--t-border` (`:50`)                      | agree  | tone border                 |
| 3   | Tile                 | 48px, `2xl`, dot → ink (`preset.md:33`)         | `.tile` inset 32px = 48px, 16px radius, gradient (`:52`) | agree  | `rounded-2xl` gradient      |
| 4   | Dots                 | 10 / 7 / 5px, three tones (`:35–37`)            | `.d1–.d3` (`:56–58`)                                     | agree  | build three dots            |
| 5   | Centering            | vertical middle (`shell.md:8`)                  | `.empty { margin: auto 0 }` (`:48`)                      | agree  | `my-auto` + growing columns |
| 6   | Compact art          | 56px, 32px tile, one accent dot (`:49–53`)      | `.compact` (`:64–70`)                                    | agree  | `variant="compact"`         |
| 7   | Agenda action        | "New appointment" button (`empty-states.md:33`) | `.btn` "+ New appointment" (`:104`)                      | agree  | button, was a link          |
| 8   | Dark values          | the app's dark tokens (`preset.md:24`)          | approximations (`:22–35`)                                | md     | app tokens (§7.1)           |
| 9   | Lane art on its tint | fills the panel, keeps its tint (`shell.md:14`) | `.lane` card in tone fill (`:115`)                       | agree  | disc ring stays visible     |

Rebuild-forcing facts: no popup shape, mobile behaviour, step sequence or table↔card changes —
the change is styling inside existing surfaces.
