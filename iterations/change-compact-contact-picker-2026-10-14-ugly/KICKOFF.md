# A short contact picker — kickoff plan

> **Status: approved on 2026-10-14** on the user's request for the change, a new iteration, a
> branch and a push, with no pull request until they confirm (D14). Every decision is in
> [`plans/decisions.md`](plans/decisions.md) and can be reopened by moving the iteration back to
> `planning`. `fe-kickoff-iteration` builds §6 in ledger order (§9); what was actually built goes in
> `AS-BUILT.md`.

## 1. Header

| Field            | Value                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Iteration · mode | `iterations/change-compact-contact-picker-2026-10-14-ugly/` · **initial** (type `change`, Baseline `none`, D2)                         |
| Intake           | mode `brief` · note "1 received (BRIEF.md) · from scratch" · placed 2026-10-14 · Intake hash `a59c5051a3fc`                            |
| Date             | 2026-10-14                                                                                                                             |
| Sources          | `intake-files/BRIEF.md` (the change); the code as built; before screenshots and recordings of the running app at 375px and 1440px (§8) |
| Evidence         | `BRIEF.md:n` = brief line n · `path:n` = this repo (paths under `src/shared/components/ContactQuickPick/` unless given in full)        |
| Planned by       | `fe-iteration-planning` (this file)                                                                                                    |
| Built by         | `fe-kickoff-iteration`, driving the skills named per ledger row (§9)                                                                   |
| Sibling          | none — frontend only (D4)                                                                                                              |

### Coverage matrix (Step 1)

| File                    | Read fully? | Kind  | Screens / facts it owns                                                                                         | In plan at     |
| ----------------------- | ----------- | ----- | --------------------------------------------------------------------------------------------------------------- | -------------- |
| `intake-files/BRIEF.md` | yes         | brief | the five changes (rail, window, add row, quick add, loading), the rules, nine acceptance criteria, out of scope | §2, §6, §8, §9 |

Delta (Step 2): `n/a — initial`. The brief is the whole change list, read against the current code of
the one component it changes and its five hosts.

## 2. Locked decisions

All in [`plans/decisions.md`](plans/decisions.md), locked with the approval on 2026-10-14.

| #   | Decision                                                                                    |
| --- | ------------------------------------------------------------------------------------------- |
| D1  | Make selecting and adding a person much shorter, in a new way, wherever the picker is drawn |
| D2  | A new `change` iteration from scratch (Baseline `none`), Intake mode `brief`                |
| D3  | Branch `feat/compact-contact-picker`, pushed; no pull request until the user confirms       |
| D4  | Frontend only                                                                               |
| D5  | Recent → one line of faces (chips) that scrolls sideways                                    |
| D6  | Chip: short name visible, whole name + line + action to assistive technology                |
| D7  | Results: tighter rows in a ~3½-row window, a fade above the add row while there is more     |
| D8  | ← / → move along the rail with nothing typed, mirrored under RTL                            |
| D9  | Add row 36px, words unchanged                                                               |
| D10 | Quick add on a narrow card: Name; Mobile + Add                                              |
| D11 | Scroll-edge measuring promoted from the Feedback carousel to `useScrollEdges`               |
| D12 | AMBER — a vertical wheel scrolls an overflowing rail sideways                               |
| D13 | AMBER — loading shimmer in the new shapes (chips on the rail, compact rows)                 |
| D14 | Approved on the request; the pushed branch is the checkpoint                                |

## 3. Foundation (before any screen)

- **Theme preset** — n/a: no token changes. Every new class is a semantic token (`bg-card`,
  `from-card`, `bg-canvas`, `border-b-muted`, `text-muted-foreground`, `ring`) and a named radius;
  the round chip carries `data-slot="pill"` so the Sharp shape squares it (`CLAUDE.md` › Styling).
- **Shell** — n/a.
- **Stores** — n/a: no new state beyond the picker's own `useState` (`use-contact-quick-pick.ts`).
- **Icons** — none new.
- **Shared hook** — `src/shared/hooks/useScrollEdges/` (D11): `{ ref, start, end }` for the `x` or
  `y` axis, measured after every render, on resize (`ResizeObserver`) and on scroll (its own
  passive listener); `x` reads `Math.abs(scrollLeft)` so RTL's negative offsets count. The Feedback
  carousel (`patients/$patientId/overview/components/FeedbackCard/feedback-carousel.ts`) is rebuilt
  on it and drops its own measuring and `onScroll`.

## 4. Route / island map

No route, island, manifest or dialog route changes. The hosts stay where they are:

| Host                                 | Where                                                   | Shape                         |
| ------------------------------------ | ------------------------------------------------------- | ----------------------------- |
| New lead — Contact step              | `leads/components/NewLeadDrawer/NewLeadContactStep.tsx` | inline, Quick start toolbar   |
| New appointment / appointment drawer | `src/shared/forms/AppointmentForm/WhoSection.tsx`       | inline                        |
| New task — For                       | `tasks/components/NewTaskDrawer/NewTaskPersonField.tsx` | field → popover / phone sheet |
| Receive payment · Invoice — patient  | `src/shared/components/PatientPicker/PatientPicker.tsx` | field → popover / phone sheet |

## 5. State management map

| Screen            | Server state                                        | Client state                                                    | URL state | Form state |
| ----------------- | --------------------------------------------------- | --------------------------------------------------------------- | --------- | ---------- |
| The picker        | `useContactSearch`, `useRecentContacts` (unchanged) | `useContactQuickPick` (query, highlight, quick add — unchanged) | none      | none       |
| The rail / window | none                                                | `useScrollEdges` (DOM measurement only)                         | none      | none       |
| The quick add     | none                                                | its own `useState` (unchanged)                                  | none      | unchanged  |

Nothing new in Zustand; the highlight stays cmdk's controlled `value`.

## 6. Per-screen build notes

### 6.1 The shared hook — `fe-component-promotion`, `fe-test-generation`

`useScrollEdges(axis)` per §3. The carousel keeps `trackRef`, `canPrevious`, `canNext`, `previous`,
`next`; `onScroll` goes (the hook listens itself), and `FeedbackCard.tsx:225–247` drops it. Tests:
the hook's edges on a scrolled element, both axes, RTL's negative `scrollLeft`.

### 6.2 Recent as a rail — `shadcn` (cmdk), `fe-code-structure`

- `RecentRail` replaces the Recent `PeopleGroup` (`ContactQuickPick.tsx:396–408`). A `CommandGroup`
  with the "Recent" heading (its accessible name), heading and track on one line: heading `text-tiny`
  uppercase at the start, then a scroller (`overflow-x-auto`, hidden scrollbar, `py-2`, `gap-1.5`)
  of chips; the fades (`from-card`, 24px) at whichever edge `useScrollEdges('x')` reports, mirrored
  under RTL (`bg-linear-to-r` / `rtl:bg-linear-to-l`).
- `RecentChip`: a `CommandItem` (`value` = the hit's id, `data-testid` = the host's hit id) drawn as
  a 32px pill — the `chip` avatar (22px, the "P" badge kept), the short name (`railName`, D6) at
  `text-caption`, max 9rem, truncated, `aria-hidden`; a `sr-only` span with the whole name, the line
  and the action; `title` = the whole name. Highlighted (`data-[selected=true]`): `bg-canvas` and a
  `ring-1 ring-ring` hairline.
- `railName(name)` — a pure helper in `contact-quick-pick-query.ts`: first word + space + the last
  word's first letter + "."; a one-word name whole.
- Keys (D8): the picker's `onKeyDown` takes ← / → while the search is empty and the highlight is on a
  chip: the next or previous chip (direction from `getComputedStyle(...).direction`), clamped at the
  ends, then scrolls it into view (`block: 'nearest', inline: 'nearest'`) on the next frame —
  cmdk's own scroll runs only for ↑ ↓.
- Wheel (D12): a non-passive `wheel` listener on the track turns a vertical wheel into sideways
  scroll while the track can move that way; otherwise the wheel passes on.
- Loading (D13): with nothing typed and Recent loading, a `LoadingRail` — three chip-shaped
  `SkeletonBar`s, shimmering — on the rail's line.

### 6.3 The results window — `shadcn`, `frontend-design`

- `PickList`'s `CommandList`: `max-h-50` (was `max-h-80`), `scroll-pb-12` (keeps the highlighted row
  clear of the add row and the fade), `ref` = `useScrollEdges('y')`.
- `PersonRow`: the `option` avatar (26px), `gap-2`, `py-1.5`, leading 1.25 — two lines kept.
- A fade (`from-card`, 24px, `sticky bottom-9`, `-mt-6`, `aria-hidden`) before the add row, only while
  the window has more below.
- `LoadingRows`: three rows at the new geometry (`size-6.5` avatar bar).
- The add row: `h-9` (D9).

### 6.4 The quick add on a narrow card — `frontend-design`

`ContactQuickAdd.tsx:136`: `@max-[480px]:grid-cols-[minmax(0,1fr)_auto]`, Name
`@max-[480px]:col-span-2`; Mobile and the Add button share the second line; `gap-2.5` (was `gap-3`).

### 6.5 Copy — `fe-i18n-constants`

No new user-facing copy is expected: the chip's words are the person's name and the host's existing
line and action; "Recent" exists (`contactPick.recent`). Any string that turns out to be needed ships
in all 11 locales.

### 6.6 Docs

`docs/reference/design.md` › One person picker (the list's new height, the rail);
`docs/reference/e2e-testids-inventory.md` rows 105 and 337 (Recent is a rail; ids unchanged);
the TSDoc on `ContactQuickPick`, `ContactQuickAdd`, `useScrollEdges`, `railName`.

## 7. Deviations

### 7.1 Build to the brief over the screens as built

| Item      | As built before                    | This iteration builds                | Decision |
| --------- | ---------------------------------- | ------------------------------------ | -------- |
| Recent    | five two-line rows under a heading | one line of chips beside the heading | D5, D6   |
| Results   | up to 20rem of 51px rows           | a 200px window of ~46px rows, a fade | D7       |
| Add row   | 40px                               | 36px                                 | D9       |
| Quick add | three stacked lines when narrow    | two lines                            | D10      |

### 7.2 Project rules over the source

Semantic tokens and named radii only; `data-slot="pill"` on the chip; icons none; no new copy.

### 7.3 Standing deviations

None carried — the iteration starts from scratch (Baseline `none`). The deviations of §7.1 become
this iteration's Standing deviations in `AS-BUILT.md`.

## 8. Verification

- **By Intake mode (`brief`)** — the nine acceptance criteria of `BRIEF.md`, each checked in the
  running app (clinozy-be + the dev server, the demo clinic) at **375px and 1440px**: New lead
  (Recent, a search, the keys, the add row, the quick add), New appointment (Recent, a search), New
  task's "For" (popover / phone sheet). Before and after screenshots and recordings from one script,
  run on `main`'s code and on this branch.
- **Static gates** — `pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure &&
pnpm validate:testids && pnpm type-check && pnpm lint && pnpm biome:check`, `pnpm tsdoc:check`,
  `pnpm sync:check`, `pnpm docs:lint`.
- **Vitest** — `ContactQuickPick`, `contact-quick-pick-query`, `useScrollEdges`, `FeedbackCard`, and
  the hosts' suites (`NewLeadDrawer`, `LeadDrawer`, `WhoSection`, `AppointmentForm`, `NewTaskDrawer`,
  `PatientPicker`), then the full unit run.
- **Close** — `AS-BUILT.md` with its summary and Standing deviations, `pnpm iteration:status <it>
done`; `frozen` in the last commit before the merge (after the user's confirmation, D3).

## 9. The route — the ordered ledger

| #   | Work item                                                             | Kind       | Depends on | Skill/driver                                     | Acceptance                                                                             | Assignee | Status |
| --- | --------------------------------------------------------------------- | ---------- | ---------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- | -------- | ------ |
| L-1 | `useScrollEdges` shared hook; the Feedback carousel on it             | foundation | —          | fe-component-promotion, fe-test-generation       | hook tests (x, y, RTL); `FeedbackCard` suite passes unchanged                          | Claude   | done   |
| L-2 | Recent rail: chips, short name, keys, wheel, loading rail             | structural | L-1        | shadcn, fe-code-structure                        | BRIEF criteria 1–3, 6 (rail half); new unit tests for the rail, ← / →, `railName`      | Claude   | done   |
| L-3 | Results window: compact rows, fade, add row 36px, loading rows        | styling    | L-1        | shadcn, frontend-design                          | BRIEF criteria 4–6; picker suite passes                                                | Claude   | done   |
| L-4 | Quick add: two lines on a narrow card                                 | styling    | —          | frontend-design                                  | BRIEF criterion 5 (quick add half) at 375px                                            | Claude   | done   |
| L-5 | Hosts' suites, copy check, docs (design.md, testids inventory, TSDoc) | gate       | L-2–L-4    | fe-test-generation, fe-documentation-maintenance | BRIEF criteria 7–9; hosts' suites pass; `docs:lint`, `tsdoc:check`, `sync:check` green | Claude   | done   |
| L-6 | Verify in the running app: before / after at 375px and 1440px         | verify     | L-2–L-5    | fe-kickoff-iteration                             | every BRIEF criterion seen in the app; screenshots + recordings                        | Claude   | done   |
| L-7 | Static gates, `AS-BUILT.md`, Status `done`, commit, push              | gate       | L-6        | fe-before-commit-guard                           | all §8 gates green; branch pushed; no pull request (D3)                                | Claude   | done   |
