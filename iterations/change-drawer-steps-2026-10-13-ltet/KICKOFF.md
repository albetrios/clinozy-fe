# KICKOFF — change-drawer-steps-2026-10-13-ltet

> The plan and the ordered ledger for a small, incremental iteration from a written brief
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Iteration         | `change-drawer-steps-2026-10-13-ltet`                                                        |
| Mode              | incremental                                                                                  |
| Baseline          | `launch-2026-09-30-jxmr` ([D2](plans/decisions.md))                                          |
| Intake mode       | brief — `BRIEF.md` received, 22 files carried forward from the Baseline                      |
| Intake hash       | `9142681352a4` (gate passed 2026-10-13, Baseline `036cbb592ac5` unchanged)                   |
| Schema-routes     | `5f90325208e1` — unchanged from the Baseline                                                 |
| Sources           | `intake-files/BRIEF.md` (the change), the carried-forward specs it touches, the current code |
| Date              | 2026-10-13                                                                                   |
| Evidence notation | `BRIEF.md:<line>`, `<spec>.md:<line>` in `intake-files/`, `src/…` in the code today          |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills)         |
| Sibling           | none — clinozy-fe only; no route, payload or rule changes ([D3](plans/decisions.md))         |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — The user delegated the design calls; the agent plans, approves, builds and closes; no PR until the user confirms.
2. **D2** — Baseline `launch-2026-09-30-jxmr`, the design snapshot that owns the step cards; the later iterations are not related.
3. **D3** — clinozy-fe only, on `feat/drawer-step-pattern`.
4. **D4** — Intake mode `brief`.
5. **D5** — Every create and edit drawer opens on its first step (or its shortcut's); the rest start collapsed.
6. **D6** — Done ✓ = holds something or was reached, with nothing required empty.
7. **D7** — "!" only once the step was reached or a Save was tried.
8. **D8** — The collapsed step: label / value pairs, one "Not filled: …" line, "+N more", items as chips; "Not filled yet" when empty.
9. **D9** — One head: circle · title · sub line (collapsed) · hint · chevron; hover lift; lock and no chevron on a locked step.
10. **D10** — The appointment form: one open card, "Next: Date & time →", the shared head and summary.
11. **D11** — The lead drawer's cards stay as they are.
12. **D12** — Per-step `summary` strings that the field summary replaces are removed.
13. **D13** — The contact editor's open step takes the section tone like every other.
14. **D14** — New strings in all 11 locales; 10 translations flagged for a native read (AMBER).
15. **D15** — Approved by delegation (D1) on 2026-10-13.

## 3. Foundation (before any screen)

### 3.1 Theme

n/a — no preset or token changes. The new parts use existing semantic tokens only (`bg-canvas`,
`bg-card`, `border-border-strong`, `text-destructive`, `bg-success`, the tone fills) and named radius
steps (`rounded-xl`, `rounded-full` + `data-slot="pill"`); the four preset registration points are
untouched.

### 3.2 Shell

n/a — the shell is unchanged.

### 3.3 Stores

n/a — no store. The steps a user has reached live in `DrawerSteps` (component state, reset when the
drawer closes); a save attempt lives in `RecordDrawer` (component state, reset on close); the
appointment form's open card in its form UI state.

### 3.4 Icons

`ChevronDown`, `Check`, `Lock` — already exported by `@/shared/icons/index.ts`; nothing to add.

### 3.5 The shared step parts (`src/shared/components/DrawerSteps/`)

```text
drawer-step-status.ts   drawerStepStatus({ open, missingCount, filled, reached, revealMissing })
                          open → 'open'
                          missing > 0 → reached || revealMissing ? 'missing' : 'later'
                          filled || reached → 'done', else 'later'
                        peekHasValue(peek)
drawer-step-head.tsx    DrawerStepCircle (open: tone ink + n · done: ✓ · missing: ! · later: n · locked: lock)
                        DrawerStepHeadText (title · sr-only "Step n of m · <state>" · sub line when collapsed
                                            · hint when collapsed · chevron, rotated when open)
drawer-step-peek.tsx    DrawerStepPeek (dl grid auto-fill minmax(7.5rem,1fr) · pairs · items rows
                                        · "+N more" · "Not filled: …")
DrawerSteps.tsx         the accordion: reached set (previous-value pattern), revealMissing, collapsible
RecordDrawer.tsx        a blocked Save sets `attempted` → revealMissing; stepsCollapsible → collapsible
```

## 4. Route / island map

n/a — no route, page or dialog route is added, moved or removed. The drawers keep their URLs.

## 5. State management map

| Surface            | Server state | Client state                                 | URL state | Form state      |
| ------------------ | ------------ | -------------------------------------------- | --------- | --------------- |
| `DrawerSteps`      | —            | reached steps (`useState`, previous-value)   | —         | —               |
| `RecordDrawer`     | —            | `attempted` (`useState`, cleared on close)   | —         | —               |
| Appointment form   | unchanged    | `openStep` (`useState`, follows the booking) | unchanged | unchanged       |
| Every other drawer | unchanged    | unchanged (their `openStep`)                 | unchanged | unchanged (RHF) |

Nothing tempts a rule break: no server data enters a store.

## 6. Per-screen build notes

### 6.1 The shared step card — `frontend-design`, `web-design-guidelines`, `fe-test-generation`

- Card: `rounded-xl border p-(--step-pad)`; open = `bg-card` + `border-border-strong`; closed =
  `bg-canvas`, hover = `bg-card` + `border-border-strong` (`transition-colors`); the head's
  `after:inset-0` makes the whole closed card the button (unchanged).
- Head: 24px circle · title 13.5px/600 · sub line 12px (collapsed only; `text-destructive` when it
  names missing fields) · hint 12px muted (collapsed only) · 16px chevron, `rotate-180` open, 200ms.
- Summary: `ms-8.5 -mt-1`, `@container`; a multi-select of several picks spans two columns from
  16rem; values `line-clamp-2`; at most 6 pairs.
- Motion: the body's 240ms reveal is unchanged.

### 6.2 Steps without a summary get one — `fe-design-ditto`

| Drawer          | Step                                        | Summary fields                                                                                        |
| --------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| New task        | What needs doing · When & who · How & notes | For, Title (or its "Follow up · <first>" fallback) · Due, Assign to · Priority (High in blush), Notes |
| Contact editor  | Identity & reach · Contact preferences      | First name, Last name, Mobiles, Instagram, Default channel (its tone) · the preferences as pills      |
| Supplier (edit) | Account                                     | Payable, Orders                                                                                       |
| Sale return     | What is coming back · Reason & refund       | the lines as chips ("<name> × <qty>"), Refund · Reason (its tone), Refund by (its tone)               |
| Purchase order  | Items                                       | Items ("<n> items · ₹<total>")                                                                        |
| Stock purchase  | Items received                              | Items ("<n> items · ₹<total>")                                                                        |

### 6.3 The appointment form — `fe-design-ditto`, `fe-test-generation`

`openStep: 'details' | 'slot' | ''`, starting `details` (New, Edit), `slot` (from a chat, a task, a
Copy, a Reschedule), `''` (checked in); it follows the booking until the member picks a card. Step 1
ends with "Next: Date & time →" (`appointment-form-details-next`), hidden once the slot is locked. A
save stopped on the doctor opens step 1; on the slot or a passed time, step 2. Summaries: Type,
Doctor, Length, Reason, Notes · Date, Time; the locked slot reads "<day> · <time> · locked after
check-in". The section tone is `SECTION_TONES.appointments`.

### 6.4 New lead — `fe-design-ditto`

`stepsCollapsible={false}`: the open step never folds (unchanged, H:4135) and so shows no chevron;
the locked "Lead details" shows its lock, hint and promise.

## 7. Deviations

### 7.1 Brief over the carried-forward specs

| Item                  | Design says (evidence)                                                                    | Built as                                              | Decision |
| --------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| Missing "!"           | "has missing required fields (not open) = red" (`_patterns.md:45`)                        | only once reached or after a Save                     | D7       |
| Collapsed peek        | mini tiles; "an empty field shows a dashed z200 tile reading 'Empty'" (`_patterns.md:46`) | borderless pairs; empties in one "Not filled: …" line | D8       |
| Head                  | no chevron (`_patterns.md:45`)                                                            | chevron on every collapsible head; hover lift         | D9       |
| Appointment step 2    | "step 2 is always open; no Next buttons" (`appointments.md:248`)                          | one card open at a time; "Next: Date & time →"        | D10      |
| Contact editor circle | "green once a name is filled", open or not (`leads.md:294`)                               | the open step takes the tone                          | D13      |

### 7.2 Project rules over the source

- Semantic tokens and named radius steps only; every new string an i18n key in all 11 locales.
- The circle's state is read out (`sr-only`), not only shown in colour (WCAG 1.4.1).

### 7.3 The Baseline's Standing deviations this change touches

The launch's `AS-BUILT.md` Standing deviations that name step cards, the appointment form's cards or
New lead's fixed step are kept as they are, except where §7.1 changes them; the new deviations above
are carried into this iteration's Standing deviations.

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, each with its proof, plus the baseline set.

| Criterion (`BRIEF.md`)                 | Proof                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------- |
| first step open, one at a time (`:75`) | recordings 01–06, 08; `DrawerSteps` tests                                 |
| appointment form (`:77`)               | recording 07; `AppointmentForm` tests (Next, one card open, locked slot)  |
| no red before reached (`:79`)          | recordings 01, 02; `drawer-step-status` + `DrawerSteps` tests             |
| saved record's steps done (`:81`)      | recordings 03, 05, 06; `DrawerSteps` "reads … done before it is reached"  |
| one head (`:82`)                       | `DrawerSteps` tests (no open sub line, chevron, hint)                     |
| collapsed summary (`:84`)              | recordings 04–06; `DrawerSteps` summary tests                             |
| no bare step (`:86`)                   | §6.2 drawers' tests; recordings                                           |
| state read out (`:87`)                 | `DrawerSteps` "reads out each step's place and state"                     |
| screenshots + recordings (`:88`)       | 1440 × 900 and 390 × 844, before and after, per change — sent to the user |

Static gates: `pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure &&
pnpm validate:testids && pnpm type-check && pnpm lint && pnpm biome:check`; i18n parity; the unit
suite. Baseline set: every create and edit drawer opens and saves as before (the drawers' own suites).
Close: `AS-BUILT.md` with its summary and Standing deviations, `pnpm iteration:status <it> done`;
`frozen` waits for the last commit before the merge (the user confirms the PR first — D1).

## 9. The route — the ordered ledger

| #    | Work item                                                                                                                                 | Kind       | Depends on | Skill/driver                                                 | Acceptance                            | Assignee | Status |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- | ------------------------------------------------------------ | ------------------------------------- | -------- | ------ |
| L-1  | Shared step parts: status rule, head (circle, chevron, read-out state), collapsed summary; `DrawerSteps` reached set                      | foundation | —          | frontend-design · web-design-guidelines · fe-test-generation | §3.5; `DrawerSteps` + status tests    | Claude   | open   |
| L-2  | `RecordDrawer`: a blocked Save reveals every missing step; `stepsCollapsible`                                                             | global     | L-1        | fe-test-generation                                           | `RecordDrawer` tests                  | Claude   | open   |
| L-3  | Copy: `recordDrawer.step.position` / `.state.*`, `peek.more` / `.notFilled`, `appointmentForm.slot.date` in 11 locales; dead keys removed | copy       | L-1        | fe-i18n-constants                                            | i18n parity, `sync:check`             | Claude   | open   |
| L-4  | Steps without a summary get one (§6.2)                                                                                                    | structural | L-1        | fe-design-ditto                                              | the drawers' tests; recordings        | Claude   | open   |
| L-5  | Per-step `summary` strings the field summary replaces are removed (D12)                                                                   | structural | L-1        | fe-code-smells-best-practices                                | type-check; the drawers' tests        | Claude   | open   |
| L-6  | Appointment form: one open card, shared head and summary, Next (§6.3)                                                                     | structural | L-1        | fe-design-ditto · fe-test-generation                         | `AppointmentForm` tests; recording 07 | Claude   | open   |
| L-7  | New lead: fixed open step without a chevron (§6.4)                                                                                        | styling    | L-1, L-2   | fe-design-ditto                                              | `NewLeadDrawer` tests                 | Claude   | open   |
| L-8  | The drawers' suites follow the pattern (no open sub line, honest states, the new summary)                                                 | gate       | L-1–L-7    | fe-test-generation                                           | the unit suite green                  | Claude   | open   |
| L-9  | Docs: the step-card notes in overviews and reference docs                                                                                 | copy       | L-1–L-7    | fe-documentation-maintenance                                 | `pnpm sync:check`, `pnpm docs:lint`   | Claude   | open   |
| L-10 | Verify: before / after recordings and screenshots per change, 1440 and 390                                                                | verify     | L-1–L-9    | fe-kickoff-iteration                                         | every §8 row proven                   | Claude   | open   |
| L-11 | Gates: static, unit                                                                                                                       | gate       | L-10       | fe-before-commit-guard                                       | §8 gates green                        | Claude   | open   |
| L-12 | Close: `AS-BUILT.md` (rows, summary, Standing deviations), Status `done`                                                                  | verify     | L-11       | fe-kickoff-iteration                                         | README Status `done`                  | Claude   | open   |

## Appendix A — Coverage matrix

| File (`intake-files/`)                                                                 | Read fully?                                                                          | Kind                   | Facts it owns here                                                              | In plan at       |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------- | ---------------- |
| `BRIEF.md`                                                                             | yes                                                                                  | the change             | five changes, rules, 9 criteria, out of scope                                   | §2, §6, §8, §9   |
| `_patterns.md`                                                                         | the rows it touches (`:36`, `:40–49`)                                                | spec (carried forward) | step cards: card, head, peek, Next, motion; Save opens the missing step         | §3.5, §6.1, §7.1 |
| `appointments.md`                                                                      | Multi-step flow (`:227–252`)                                                         | spec (carried forward) | the two cards, step 2 always open, locked after check-in, collapsed from a chat | §6.3, §7.1       |
| `leads.md`                                                                             | New lead + contact editor flows (`:246–296`)                                         | spec (carried forward) | New lead's fixed step and lock; contact editor's circle                         | §6.4, §7.1       |
| `clinic-stock.md`, `medical.md`, `offerings.md`, `patient-file.md`                     | Multi-step flow sections                                                             | spec (carried forward) | "Edit mode: prefilled, same steps, any step can be opened"; opens on step 1     | D5               |
| the other 16 files (screens, prototype, `support.js`, `schema-routes.md`, `PRD.md`, …) | not re-read — unchanged since the Baseline (`iteration:diff`: only `BRIEF.md` added) | carried forward        | none in this change                                                             | —                |

## Appendix B — Reconciliation (BRIEF ↔ carried-forward specs ↔ code)

| #   | Fact               | Brief / spec says                                                                                         | Code today says                                                         | Winner | Action   |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------- |
| 1   | "!" on a step      | brief: only once reached (`BRIEF.md:19–21`); spec: any closed step (`_patterns.md:45`)                    | `drawerStepStatus`: `missingCount > 0` → missing on every closed step   | brief  | L-1      |
| 2   | Done ✓             | brief: holds something, nothing missing (`BRIEF.md:17–18`)                                                | index ≤ the last opened step                                            | brief  | L-1      |
| 3   | Collapsed body     | brief: pairs + one "Not filled" line (`BRIEF.md:29–37`); spec: tiles + dashed "Empty" (`_patterns.md:46`) | tiles, dashed "Empty" per field                                         | brief  | L-1      |
| 4   | Open head sub line | brief: none (`BRIEF.md:25–28`)                                                                            | most drawers show the step summary under the open title                 | brief  | L-1, L-5 |
| 5   | Appointment cards  | brief: one open (`BRIEF.md:9–14`); spec: step 2 always open (`appointments.md:248`)                       | both open                                                               | brief  | L-6      |
| 6   | Bare steps         | brief: none (`BRIEF.md:38–41`)                                                                            | contact editor, New task, supplier Account, sale return, purchase items | brief  | L-4      |
