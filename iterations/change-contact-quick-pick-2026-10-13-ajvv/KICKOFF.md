# KICKOFF — change-contact-quick-pick-2026-10-13-ajvv

> The plan and the ordered ledger for a small, incremental iteration from a written brief
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Iteration         | `change-contact-quick-pick-2026-10-13-ajvv`                                                                                                  |
| Mode              | incremental                                                                                                                                  |
| Baseline          | `launch-2026-09-30-jxmr` ([D2](plans/decisions.md))                                                                                          |
| Intake mode       | brief — `BRIEF.md` received, 22 files carried forward from the Baseline                                                                      |
| Intake hash       | `5a0057e09f14` (gate passed 2026-10-13, Baseline `036cbb592ac5` unchanged)                                                                   |
| Schema-routes     | unchanged from the Baseline (`iteration:diff`: only `BRIEF.md` added)                                                                        |
| Sources           | `intake-files/BRIEF.md` (the change), the carried-forward specs it touches (`leads.md`, `appointments.md`, `_patterns.md`), the current code |
| Date              | 2026-10-13                                                                                                                                   |
| Evidence notation | `BRIEF.md:<line>`, `<spec>.md:<line>` in the Baseline's `intake-files/`, `src/…:<line>` in the code today                                    |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills)                                                         |
| Sibling           | none — clinozy-be changes nothing ([D4](plans/decisions.md), [D9](plans/decisions.md))                                                       |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — Delegated end to end; commit and push, no PR until the user confirms.
2. **D2** — Baseline `launch-2026-09-30-jxmr`; no later iteration is continued or edited.
3. **D3** — Intake mode `brief`.
4. **D4** — Branch `feat/contact-quick-pick`, clinozy-fe only.
5. **D5** — The folder keeps only this change's own files (`BRIEF.md`; its own deviation rows).
6. **D6** — The shared contact picker replaces the inline searches of New lead and the appointment form; Picker-based drawers get the loading look only.
7. **D7** — Recent = `GET /app/contacts?sort=last_activity_at&order=desc&limit=5`, quiet on failure.
8. **D8** — Inline quick add prefilled from the query; New lead's "More details" seeds the contact editor.
9. **D9** — No backend change.
10. **D10** — Sheen sweep (1.4s, 90ms stagger), spinner glyph, progress line, dimmed previous rows, status line; reduced motion stills it.
11. **D11** — `SkeletonBar`/`SkeletonRows` gain opt-in `shimmer`; the Picker opts in; new shared `ProgressLine`, which `RouteProgressBar` now uses.
12. **D12** — Esc clears the typed search before it closes the drawer; Esc in the quick add returns to the search.
13. **D13** — New strings in all 11 locales (AMBER: native read).
14. **D14** — Approved by delegation.

## 3. Foundation (before any screen)

### 3.1 Theme — one sheen token, one keyframe

No preset changes. One custom property and one keyframe, both in `src/index.css`:

```text
:root  { --skeleton-sheen: oklch(1 0 0 / 0.7);  }   light: a white sheen over muted-strong
.dark  { --skeleton-sheen: oklch(1 0 0 / 0.08); }   dark: a faint lift — never a glare

@theme  --animate-skeleton-sweep: skeleton-sweep 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite
        @keyframes skeleton-sweep { from { background-position: -100% 0 } to { background-position: 200% 0 } }

.skeleton-sheen        background: linear-gradient(90deg, transparent, var(--skeleton-sheen), transparent)
                       no-repeat, 50% wide, over the bar's own muted-strong fill
[dir='rtl'] .skeleton-sheen   animation-direction: reverse   (the sweep follows the reading direction)
```

Reduced motion: the platform rule (`src/index.css:1759`) cuts every animation to 0.01ms × 1 — the sheen
leaves the bar at once and the bars stand still; the spinner and the line stop the same way.

### 3.2 Shell

n/a — no shell change. `RouteProgressBar` keeps its place, look and label (it draws through
`ProgressLine`).

### 3.3 Stores

n/a — the query, the active row and the quick add are component state; Recent and the search are
TanStack Query reads.

### 3.4 Icons

n/a — `Search`, `Plus`, `X`, `UserPlus` and the `Spinner` glyph are already in `@/shared/icons/index.ts`.

## 4. Route / island map

No route, island, manifest or registration is added, moved or removed.

| Unit                                                                   | Kind        | Change                                                                             |
| ---------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `src/shared/components/ContactQuickPick/` NEW                          | shared unit | the contact picker: search, Recent, rows, keyboard, quick add                      |
| `src/shared/components/ProgressLine/` NEW                              | shared unit | the indeterminate line                                                             |
| `src/shared/components/SkeletonRows/`                                  | shared unit | opt-in `shimmer` on `SkeletonBar` and `SkeletonRows`                               |
| `src/shared/components/RouteProgressBar/`                              | shared unit | draws `ProgressLine`                                                               |
| `src/shared/components/Picker/PickerPanel/`                            | shared unit | loading rows shimmer                                                               |
| `src/shared/api/app/contacts-api.ts`, `src/shared/hooks/useContacts/`  | api / hook  | `fetchRecentContacts`, `useRecentContacts`; `useContactSearch` reports its loading |
| `pages/organization/$organizationSlug/leads/components/NewLeadDrawer/` | page unit   | the Contact step is the shared picker; the editor can be seeded                    |
| `src/shared/forms/AppointmentForm/WhoSection.tsx`                      | shared form | the who search is the shared picker                                                |

## 5. State management map

| Surface         | Server state                                         | Client state                                    | URL state | Form state                         |
| --------------- | ---------------------------------------------------- | ----------------------------------------------- | --------- | ---------------------------------- |
| Contact search  | `contactQueryKeys.search(org, q)` (as today)         | query, quick-add open (`useState`)              | —         | —                                  |
| Recent          | `contactQueryKeys.recent(org)` NEW, quiet on failure | —                                               | —         | —                                  |
| Active row      | —                                                    | cmdk's own selection                            | —         | —                                  |
| Quick add       | —                                                    | name, mobile (`useState`)                       | —         | handed to the drawer's form on Add |
| New lead editor | —                                                    | `editorValue` — the value the editor opens with | —         | the lead form's `contact` on Done  |

No rule is under pressure: nothing new is stored, server state stays in TanStack Query.

## 6. Per-screen build notes

### 6.1 Shared loading — `fe-component-promotion`, `fe-test-generation`

```text
SkeletonBar  shimmer?  → classes: bg-muted-strong · skeleton-sheen · animate-skeleton-sweep · [animation-delay:<n×90>ms]
                          (n = the row index mod 4; without shimmer: flat, `animate-none`, as today)
SkeletonRows shimmer?  → each row's bars carry it, staggered by row
PickerPanel            → its four loading rows and the two "Loading more" rows pass shimmer + their index
ProgressLine           → role=progressbar, aria-label, h-0.5 overflow-hidden; the bar `bg-primary w-2/5`
                          on `route-progress` 1.1s; `className` places it (fixed top / under a field)
RouteProgressBar       → <ProgressLine label="Loading page" testId="route-progress" className="fixed inset-x-0 top-0 z-[60]" />
```

### 6.2 `ContactQuickPick` — `composition-patterns`, `fe-i18n-constants`, `fe-e2e-testids`, `web-design-guidelines`, `fe-test-generation`

```text
┌ card (data-slot=surface, rounded-xl, border) ─────────────────────────────┐
│ [🔍|◌] Search by name or mobile                                    [esc?] │ 44px · cmdk Input · glyph → Spinner while searching
│ ═══════════                                                                │ ProgressLine under the field while a search is in flight
│ {toolbar}  Quick start (Walk-in) (Instagram DM)                            │ New lead only · keys stay with the chips
│ RECENT                                                                     │ empty query: ≤ 5 people (shimmer rows while they load)
│ (AP) Asha Patel        Patient · C-12 · +91 98250 11241    Use contact  ↵ │ the highlighted row shows ↵ (md+)
│ …                                                                          │
│ Keep typing — 3 letters or 4 digits                                        │ typed, not yet searchable
│ ░░ ▓▓▓▓▓▓▓▓▓▓▓░░░░                                                         │ searching, nothing shown yet: 3 shimmer rows
│ (AP) **Ash**a Patel    …                               (dimmed on refetch) │ results: the typed part marked
│ No existing match                                                          │ settled + empty
│ + Add “Meera Iyer” as a new contact                                     ↵ │ the add row — "New contact" when nothing is typed
└────────────────────────────────────────────────────────────────────────────┘
       ↵ on the add row, or ↵ with no match ─►
┌ card ──────────────────────────────────────────────────────────────────────┐
│ ← New contact                                                              │ "Back to search" (Esc too) keeps the query
│ Name [Meera Iyer        ]   Mobile [+91|98250 11241]                       │ prefilled; focus on the first empty field
│ [Add contact]  More details                                                │ ↵ in a field adds; More details: New lead only
└────────────────────────────────────────────────────────────────────────────┘
```

- Props: `searchPlaceholder`, `searchLabel`, `limit`, `describe(hit) → { line, action, tone }`,
  `onPick(hit)`, `onQuickAdd({ name, phone })`, `onMoreDetails?`, `requirePhone?`, `toolbar?`,
  `inputRef?`, `disabled?`, `testIds` (search, hit, add, noMatch — the drawers keep their ids) and
  `testId` (the new parts: `-recent`, `-loading`, `-progress`, `-hint`, `-quick-add`, `-quick-add-name`,
  `-quick-add-mobile`, `-quick-add-submit`, `-quick-add-more`, `-quick-add-back`, `-status`).
- Built on shadcn `Command` (cmdk), `shouldFilter={false}`, `loop`: ↑ ↓, Home/End kept for the caret,
  ↵ selects; the first row is highlighted as rows arrive. The toolbar stops key events from reaching
  cmdk so a chip's ↵ stays the chip's. The quick add is rendered outside `Command`.
- Query parsing (`contact-quick-pick-query.ts`): `quickAddDraftOf(query) → { name, phone }` and
  `markMatch(name, query) → [before, match, after] | null` (letters only; numbers are not marked).
- Status line (`<output aria-live="polite" class="sr-only">`): "Searching…" → "3 people found" /
  "No existing match"; silent for Recent.
- Copy: `app` › `contactPick.*` (D13): `recent`, `keepTyping`, `searching`, `found_one/_other`,
  `noMatch`, `newContact`, `addNamed`, `addPhone`, `addNamedPhone`, `quickAdd.{title, name, mobile,
add, more, back, addName, needMobile, mobileDigits}`, `pickKey`, `clearSearch`.

### 6.3 New lead — `fe-design-ditto`, `fe-test-generation`

`NewLeadContactStep` keeps its file and hands its props to `ContactQuickPick`: the Quick start chips as
`toolbar`, `limit` 8, `describe` = today's hit line and action (`useHitLine`, `hitActionKey`), the open-
lead hit → `onOpenLead`, `requirePhone`. `onQuickAdd` → `contact = emptyContactValue(name, +91 phone)`
(the person strip and Lead details follow, as after the editor's Done). `onMoreDetails` → the editor
opens on `editorValue` (seeded) and commits only on Done; the strip's Edit opens it on `form.contact`.
The test ids stay (`new-lead-search`, `new-lead-hit-<n>`, `new-lead-no-match`, `new-lead-new-contact`).

### 6.4 Appointment form — `fe-design-ditto`, `fe-test-generation`

`WhoSearch` becomes `ContactQuickPick` with `limit` 5, `describe` = "Patient" or the mobile, "Use
contact", the who tones (sage · lav · butter). `onQuickAdd` → `who` = a new person (name ≤ 60) and
`newPhone` = the digits — in that order, since a who change clears `newPhone`
(`appointment-form-model.ts:401`). The ids stay (`appointment-form-who-search`, `-who-hit`,
`-who-create` on the add row).

## 7. Deviations

### 7.1 Brief over the carried-forward specs

| Spec says                                                                                                 | Built as (brief)                                                        |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| New lead: "New contact" opens the contact editor (`leads.md:80`, `:251`)                                  | the add row opens the inline quick add; "More details" opens the editor |
| Appointment: "+ Create contact “<query>”" sets the person, the mobile below (`appointments.md:61`, `:64`) | the quick add takes name and mobile together                            |
| Esc closes the drawer (`leads.md:89`)                                                                     | Esc clears a typed search first (D12)                                   |
| Skeletons are a flat fill (launch KICKOFF §3.1, §3.5)                                                     | the contact picker and the Picker shimmer (opt-in; rooms stay flat)     |
| No Recent list in either search                                                                           | ≤ 5 Recent people before typing                                         |

### 7.2 Project rules over the source

- Semantic tokens only (`validate:tokens`); named radii; `data-slot="pill"` on round surfaces
  (`validate:theme-axis`).
- Reuse before create: `SkeletonBar`, `Spinner`, `Command`, `DrawerField`, `DrawerPhoneInput`,
  `PersonAvatar`, `CONTACT_EDITOR_KEYS.newContact` are reused; `RouteProgressBar` moves onto the one new line.

### 7.3 The Baseline's Standing deviations this change touches

None of the launch's rows changes: the contact search's 3-letter / 4-digit threshold and its limits
stay as built. New rows: §7.1.

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, each with its proof.

| Criterion (`BRIEF.md`)                                | Proof                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recent on open, shimmer while loading                 | `ContactQuickPick` test (recent rows, skeleton with the sheen class); `NewLeadDrawer` test (focus)                                                                                                                                                                                            |
| hint · progress + spinner · results marked            | `ContactQuickPick` tests (hint, progress line, `mark`)                                                                                                                                                                                                                                        |
| ↓ ↑ ↵ pick = click                                    | `ContactQuickPick` keyboard test; `NewLeadDrawer` keyboard pick → strip + toast                                                                                                                                                                                                               |
| ↵ with no match → quick add prefilled → person        | `ContactQuickPick` + `NewLeadDrawer` tests; query parsing unit tests                                                                                                                                                                                                                          |
| More details seeds the editor; cancel commits nothing | `NewLeadDrawer` test                                                                                                                                                                                                                                                                          |
| appointment who is the same component                 | `WhoSection` / `AppointmentForm` tests                                                                                                                                                                                                                                                        |
| Picker shimmers; route bar unchanged                  | `PickerPanel`, `SkeletonRows`, `ProgressLine`, `RouteProgressBar` tests                                                                                                                                                                                                                       |
| reduced motion                                        | the platform rule (`src/index.css:1759`); class assertions                                                                                                                                                                                                                                    |
| announcements                                         | `ContactQuickPick` status-line test                                                                                                                                                                                                                                                           |
| tests and gates                                       | `pnpm type-check && pnpm lint && pnpm biome:check && pnpm test && pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure && pnpm validate:testids && pnpm validate:i18n && pnpm validate:i18n-parity && pnpm tsdoc:check && pnpm build && pnpm build:check && pnpm size` |

Close: `AS-BUILT.md` with its summary and Standing deviations, `pnpm iteration:status <it> done`;
`frozen` waits for the last commit before the merge (the user confirms the PR first — D1).

## 9. The route — the ordered ledger

| #    | Work item                                                                           | Kind       | Depends on | Skill/driver                                                  | Acceptance                                | Status |
| ---- | ----------------------------------------------------------------------------------- | ---------- | ---------- | ------------------------------------------------------------- | ----------------------------------------- | ------ |
| L-1  | Sheen token + `skeleton-sweep` keyframe; `SkeletonBar`/`SkeletonRows` `shimmer`     | foundation | —          | fe-theme-axis-audit · fe-test-generation                      | `SkeletonRows` tests                      | done   |
| L-2  | `ProgressLine`; `RouteProgressBar` on it                                            | global     | —          | fe-component-promotion · fe-test-generation                   | `ProgressLine` + `RouteProgressBar` tests | done   |
| L-3  | Picker loading rows shimmer                                                         | styling    | L-1        | fe-test-generation                                            | `PickerPanel` tests                       | done   |
| L-4  | `fetchRecentContacts` + `useRecentContacts`; `useContactSearch` reports `searching` | data       | —          | fe-http-forms-errors · fe-test-generation                     | `contacts-api`, `useContacts` tests       | done   |
| L-5  | `contactPick.*` copy, 11 locales                                                    | copy       | —          | fe-i18n-constants                                             | `validate:i18n`, `validate:i18n-parity`   | done   |
| L-6  | `ContactQuickPick` (query parsing, rows, keyboard, quick add, loading, status line) | structural | L-1–L-5    | composition-patterns · fe-e2e-testids · web-design-guidelines | §8 rows 1–4, 9                            | done   |
| L-7  | New lead's Contact step on it; the editor seeded by More details                    | screen     | L-6        | fe-design-ditto · fe-test-generation                          | §8 rows 3–5                               | done   |
| L-8  | The appointment form's who on it                                                    | screen     | L-6        | fe-design-ditto · fe-test-generation                          | §8 row 6                                  | done   |
| L-9  | Docs: overviews and references that describe the searches or the flat skeleton      | copy       | L-1–L-8    | fe-documentation-maintenance                                  | `pnpm sync:check`, `pnpm docs:lint`       | done   |
| L-10 | Gates: static, unit, build, size                                                    | gate       | L-9        | fe-before-commit-guard                                        | §8 last row green                         | done   |
| L-11 | Close: `AS-BUILT.md` (rows, summary, Standing deviations), Status `done`            | verify     | L-10       | fe-kickoff-iteration                                          | README Status `done`                      | done   |

## Appendix A — Coverage matrix

| File               | Read fully?                                      | Kind                   | Facts it owns here                              |
| ------------------ | ------------------------------------------------ | ---------------------- | ----------------------------------------------- |
| `BRIEF.md`         | yes                                              | the change             | three changes, rules, 10 criteria, out of scope |
| `leads.md`         | New lead rows (`:75–90`, `:138–150`, `:246–262`) | spec (carried forward) | the Contact step, Quick start, New contact, Esc |
| `appointments.md`  | who rows (`:58–66`)                              | spec (carried forward) | the who search, create contact, the new mobile  |
| the other 19 files | not re-read — unchanged since the Baseline       | carried forward        | none in this change                             |

## Appendix B — Reconciliation (BRIEF ↔ carried-forward specs ↔ code)

| #   | Fact             | Brief / spec says                                                           | Code today says                                                          |
| --- | ---------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| R1  | search threshold | 2 characters (`leads.md:79`, `appointments.md:61`); the brief keeps today's | 3 letters / 4 digits / a whole `C-12345` (`contacts-api.ts:107–112`)     |
| R2  | limits           | 5 (`leads.md:79`); the brief keeps today's                                  | New lead 8 (`contacts-api.ts:35`), appointment 5 (`WhoSection.tsx:48`)   |
| R3  | new contact      | editor (`leads.md:80`) / create + mobile (`appointments.md:61–64`)          | as the spec (`NewLeadContactStep.tsx:176–185`, `WhoSection.tsx:156–175`) |
| R4  | skeleton motion  | flat (launch §3.1) vs a sweep (`BRIEF.md`)                                  | flat, `animate-none` (`SkeletonRows.tsx:31–47`)                          |
| R5  | route progress   | unchanged                                                                   | inline bar on `route-progress` (`RouteProgressBar.tsx:18–28`)            |
