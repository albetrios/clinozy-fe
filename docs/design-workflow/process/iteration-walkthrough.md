# Iteration walkthrough

How a design iteration moves from a Claude Design drop to frozen, as text diagrams — the two phases,
the folder, the three intake modes, the gate, the Status lifecycle, planning and kickoff step by
step, how the incremental delta is found, the two repositories — and then iterations traced end to
end: one from a full drop, the same one as an overlay, and one from a written brief.

The rules are in [`iterations/README.md`](../../../iterations/README.md); the pages for each phase are
in [the process index](README.md).

## The two phases at a glance

```text
PHASE 1 · PLANNING  (no code — ends in your approval)
 │
 ├─ 1 NEW         pnpm iteration:new <type> <topic> [--both]
 │                → iterations/<it>/README.md · Baseline suggested          [planning]
 │
 ├─ 2 INTAKE      pnpm iteration:intake <it> <source> [--mode full|overlay|brief] [--both]
 │                → what arrived into intake-files/, the snapshot checked   [planning]
 │                  README: Intake mode · Intake note · Intake hash
 │
 ├─ 3 PLANNING    "plan iteration <it>" → fe-iteration-planning
 │                Step 0 confirms, then THE GATE (iteration:intake --check), then Steps 1–6
 │                → KICKOFF.md (plan + ordered ledger) · plans/decisions.md [ready-for-approval]
 │
 └─ 4 APPROVAL    you approve → pnpm iteration:status <it> approved
                  → intake-files/ LOCKED · KICKOFF.md FROZEN                [approved]

PHASE 2 · KICKOFF  (the approved plan, built one ledger row at a time)
 │
 ├─ 5 KICKOFF     "kickoff iteration <it>" → fe-kickoff-iteration
 │                Step 0 confirms, then THE GATE again · Baseline none/done/frozen
 │                → AS-BUILT.md started, the Baseline's Standing deviations copied in
 │                                                                          [implementing]
 ├─ 6 AS-BUILT    each row: do → verify → record → impact check → review    [implementing]
 │
 ├─ 7 DONE        gates green · every row done or deferred · AS-BUILT summary
 │                + Standing deviations → pnpm iteration:status <it> done   [done]
 │
 └─ 8 FROZEN      the last commit before the merge → iteration:status frozen
                  → never edited again; a correction is a new fix           [frozen]
```

## What is inside an iteration folder

```text
iterations/feat-pharmacy-returns-2026-10-06-kqzx/
           └┬─┘ └──────┬───────┘ └───┬────┘ └┬─┘
           type      topic         opened    id     (the date is the only part with digits)

├── README.md ........... field table + "## History"            values: the commands (Summary: you)
│     Type · Topic · Owner · Opened · Branch · Baseline · Status · Summary
│     Drop placed · Drop source · Intake mode · Intake note
│     Schema-routes (12-char sha256 of schema-routes.md) · Intake hash (12-char sha256 of the snapshot)
│
├── intake-files/ ....... what arrived, flat, never edited       written by iteration:intake
│     PRD.md · schema-routes.md · _index.md · preset.md · shell.md    LOCKED from approved
│     one <slug>.md per Slug in _index.md
│     <prototype>.html + every *.js it loads
│     optional: _patterns.md · _report.md · design-overview.md · …
│               (mandatory once _index.md names them)
│     BRIEF.md — in brief mode, the written change
│
├── plans/decisions.md .. blocking answers (RED / AMBER) and    written by planning,
│                         scope decisions (SCOPE), in order       then by the kickoff
│
├── KICKOFF.md .......... the plan + the ordered ledger         written by planning
│                         (the "route")                           FROZEN from approved *
│
└── AS-BUILT.md ......... what was actually built, row by row   written by the kickoff
                          + revisions to upcoming rows + summary
                          + Standing deviations: every place the code differs from the design

* after approval only the ledger's Status column and "revised → AS-BUILT #n" markers change
```

## How the snapshot is built — the three intake modes

The snapshot is always the complete current design, however little arrived. `intake-files/` stores
only what arrived; an overlay or a brief takes every other file from its Baseline (up the Baseline
chain) — the gate, the Intake hash, `iteration:diff` and `iteration:list` all read that resolved
snapshot.

```text
                 what arrived                                the snapshot (intake-files/ stores the received)
 --mode full    ┌───────────────────────────┐
 (default;      │ the whole drop: PRD.md,   │ ───────────────► exactly the drop
  the launch)   │ schema-routes.md, every   │                  note: "23 received"
                │ screen, the prototype …   │
                └───────────────────────────┘

 --mode overlay ┌───────────────────────────┐   the Baseline's intake-files/ (its gate must pass)
                │ only the changed files:   │   ┌───────────────────────────┐
                │ _index.md, medical.md,    │ ─►│ every file, the received  │ ─► Baseline + received
                │ returns.md                │   │ ones laid over (none is   │
                └───────────────────────────┘   │ ever removed)             │
                                                └───────────────────────────┘
                                                note: "3 received (_index.md, medical.md,
                                                returns.md) · 20 carried forward from <baseline>"

 --mode brief   ┌───────────────────────────┐   the Baseline's intake-files/, unchanged
                │ only BRIEF.md: what       │ ─► + BRIEF.md
                │ changes · why · affected  │   any other received file must match the Baseline's
                │ · rules · acceptance ·    │   note: "1 received (BRIEF.md) · 23 carried forward
                │ out of scope              │   from <baseline>"
                └───────────────────────────┘

 Then, in every mode: the mandatory set is checked on the RESULTING snapshot, and the README gets
 Drop placed · Drop source · Intake mode · Intake note · Schema-routes · Intake hash.
 A different existing snapshot is replaced only with --replace, only while planning;
 from approved on, the intake is locked.
```

## The gate

Both skills run it first. It is the only thing standing between an edited or incomplete intake and
a plan or a build built on it.

```text
 pnpm iteration:intake <it> --check [--baseline <baseline>]
   │
   ├─ for <it>, and for the Baseline when given:
   │    intake-files/ holds files ............................ no → ✗ no intake yet
   │    every mandatory file, for its Intake mode
   │      (+ the optional files _index.md names) ............. no → ✗ missing mandatory file(s): …
   │    the recomputed Intake hash = the README's ............ no → ✗ changed since the intake
   │                                                                   (+ the file git saw change)
   │    overlay / brief: built on the README's Baseline ...... no → ✗ built on X, but …
   ├─ with --baseline: it is the README's Baseline ............ no → ✗ the Baseline is X, not Y
   │
   ├─ all pass → "Gate passed."                                exit 0 → the skill goes on
   └─ any fail → "Gate failed — n problems. Stop here: …"      exit 1
                 every ✗ names the folder, what is wrong, and a "fix:" line
                 → the skill STOPS: writes nothing, changes no status, asks nothing
                   else, prints the output and ends the turn
```

## The Status lifecycle

Every move goes through `pnpm iteration:status`, which writes the Status row and one History line
(`- date · from → to · reason · who`).

```text
                    pnpm iteration:new
                              │
                              ▼
     ┌────────────►┌─────────────────────┐
     │             │      planning       │  the snapshot is placed and planned
     │             └──────────┬──────────┘
     │                        │  planning Step 6: self-check passed
     │                        ▼
     │             ┌─────────────────────┐
     ├◄─ --reason ─┤ ready-for-approval  │  waiting for your review
     │             └──────────┬──────────┘
     │                        │  your go-ahead
     │                        ▼
     │             ┌─────────────────────┐
     ├◄─ --reason ─┤      approved       │  intake-files/ locked · KICKOFF.md frozen
     │             └──────────┬──────────┘
     │                        │  kickoff Step 0: the gate passes · Baseline none, done or frozen
     │                        ▼
     │             ┌─────────────────────┐
     └◄─ --reason ─┤    implementing     │  ledger built row by row · AS-BUILT.md
                   └──────────┬──────────┘
                              │  every row done (or deferred with your OK) · AS-BUILT summary
                              │  and Standing deviations
                              ▼
                   ┌─────────────────────┐
                   │        done         │  can now be suggested as a Baseline
                   └──────────┬──────────┘
                              │  the last commit before the branch merges
                              ▼
                   ┌─────────────────────┐
                   │       frozen        │  never edited again — a correction is a new fix
                   └─────────────────────┘

Anything else is refused: no skipping steps, and nothing leaves frozen.
```

## Planning in detail

`fe-iteration-planning` writes no code and stops after every step.

```text
"plan iteration <it>"
 │
 ├─ Step 0  CONFIRM ──── pnpm iteration:list → | Iteration | Type | Baseline | Status | Eligible | Why |
 │                       eligible = Status planning · recommends the earliest-opened (launch first)
 │                       incremental: suggests a Baseline (latest done/frozen with a complete
 │                       intake) → you confirm or pick another → pnpm iteration:baseline
 │                       always asks you (AskUserQuestion) — never picks silently
 │          THE GATE ─── pnpm iteration:intake <it> --check [--baseline <baseline>]
 │                       fails → print its output, end the turn (nothing written)
 │
 ├─ Step 1  READ ─────── EVERY file in intake-files/ in full (BRIEF.md first in brief mode)
 │                       → coverage matrix (file · read fully? · kind · what it owns · where it is
 │                       in the plan)
 │
 ├─ Step 2  DELTA ────── initial: n/a
 │                       full / overlay: pnpm iteration:diff <baseline> <it> (+ --json)
 │                         ⟷ the designer's "What changed" → a diff hit the notes omit = FINDING
 │                       brief: BRIEF.md is the change list; the diff must show only BRIEF.md
 │                       always: the Baseline's Standing deviations and the current code
 │                         → plan from what was BUILT; KICKOFF §7 lists the ones it touches
 │                       classify every change: token · copy · styling · structural · new screen
 │                       preset or layout changed → scoped section with exact value moves, STOP
 │
 ├─ Step 3  RECONCILE ── md ↔ prototype, every verdict with file:line evidence
 │                       prototype wins on behaviour · dead CSS flagged · md-only → deviation
 │                       brief: BRIEF.md ↔ the current screens' specs and code
 │
 ├─ Step 4  RED GATE ─── RED: popup shape · mobile · step sequence · table-vs-card · surface home
 │                       → AskUserQuestion (≤4 per call, one recommendation, quoted evidence)
 │                       → plans/decisions.md (Kind RED)
 │                       AMBER: safe default, logged open (Kind AMBER), gets a ledger row
 │
 ├─ Step 5  KICKOFF.md ─ 9 required sections ("n/a — reason" allowed, absent never), ending in
 │                       the route: | # | Work item | Kind | Depends on | Skill/driver |
 │                                  | Acceptance | Assignee | Status |
 │
 └─ Step 6  SELF-CHECK ─ → pnpm iteration:status <it> ready-for-approval → STOP
                         your go-ahead → pnpm iteration:status <it> approved
```

## Kickoff in detail

`fe-kickoff-iteration` builds the approved ledger one row at a time.

```text
"kickoff iteration <it>"
 │
 ├─ Step 0  CONFIRM ── eligible = Status approved AND Baseline none/done/frozen · AskUserQuestion
 │          THE GATE ─ pnpm iteration:intake <it> --check — fails → print its output, end the turn
 │                     → pnpm iteration:status <it> implementing
 │                     → AS-BUILT.md, with the Baseline's Standing deviations copied in
 ├─ Step 1  READ ───── KICKOFF.md · plans/decisions.md · README · the intake lines each row cites
 │
 ▼
 ┌──► (1) DO ─────── screen row → fe-design-ditto: interaction shell → flow skeleton →
 │                   regions (desktop + mobile together) → content → states → motion
 │                   other rows → the skill the row names (fe-route-island, fe-i18n-constants, …)
 │    (2) VERIFY ─── the row's Acceptance, by Intake mode:
 │                   full / overlay → a screen side by side at 375px and 1440px, per state
 │                   brief          → the BRIEF.md acceptance criteria the row covers
 │                   incremental    → plus the FULL visual baseline set (catches ripple)
 │    (3) RECORD ─── AS-BUILT entry #n: planned · built · difference · why · decision · commit
 │                   a deliberate difference from the design → a new Standing deviation;
 │                   one the row resolves comes off the list · the ledger row's Status → done
 │    (4) IMPACT ──┬ small, inside the row ─────► note it in the entry, carry on
 │                 └ SCOPE: row added/removed, Acceptance or order changed
 │                     ─► STOP · AskUserQuestion
 │                     ─► plans/decisions.md (Kind SCOPE)
 │                     ─► AS-BUILT "Revisions to upcoming rows" (the revised row text)
 │                     ─► KICKOFF row gets "revised → AS-BUILT #n"
 │    (5) REVIEW ─── shows you the comparison and the entry, waits
 │         │
 └─────────┘ next row, until none is open
 │
 ▼
 CLOSE ── static design gates · every row done or deferred (your OK) · AS-BUILT summary
          (planned-not-built · built-not-planned · follow-ups) and Standing deviations
          (the Baseline's, minus the resolved, plus the new) → iteration:status <it> done
          Claude never pushes, opens PRs or merges
```

## Initial or incremental — where the delta comes from

```text
                              README › Baseline
                     ┌────────────────┴────────────────┐
                     ▼                                 ▼
              none → INITIAL                    X → INCREMENTAL
     (the first iteration in this repo)  (confirmed at planning Step 0)
                     │                                 │
                     │                      README › Intake mode
                     │               ┌─────────────────┴─────────────────┐
                     │               ▼                                   ▼
                     │         full / overlay                          brief
                     │   pnpm iteration:diff X <it>         BRIEF.md is the change list;
                     │   (the two intake-files/ only)       pnpm iteration:diff X <it> must
                     │   files + − ~ · screens · PRD /      show only BRIEF.md added
                     │   schema-routes / prototype ·                     │
                     │   entities · fields · enums ·                     │
                     │   routes · operations                             │
                     │   ⟷ the designer's "What changed"                 │
                     │   (a hit the notes omit = FINDING)                │
                     │               └─────────────────┬─────────────────┘
                     │                                 ▼
                     │          + X's AS-BUILT › Standing deviations + the current code
                     ▼                                 ▼
      read · plan · build EVERYTHING          classify each change → that is the route
      route: preset → shell (made live) →     route: global (tokens, preset, layout) →
             stores → icons → screens                copy → styling → structural → new screens
      verify: every screen                    verify: the changed screens (or the BRIEF.md
                                                      criteria) + the full baseline set
```

The Baseline's `intake-files/` is mandatory: `iteration:baseline` refuses a Baseline without the
complete required set, the gate checks it with `--baseline`, and `iteration:diff` refuses either
side without `intake-files/`.

## Two repositories

```text
 clinozy-fe/iterations/feat-…-kqzx/            clinozy-be/iterations/feat-…-kqzx/   (same name)
 ├── README.md         FE's own Baseline        ├── README.md         BE's own Baseline
 ├── intake-files/     the full FE snapshot     ├── intake-files/     PRD.md + schema-routes.md (+ …)
 ├── plans/            decisions.md             ├── plans/            decisions, coverage, …
 ├── KICKOFF.md        fe-iteration-planning    ├── KICKOFF.md        be-iteration-planning
 └── AS-BUILT.md       fe-kickoff-iteration     └── AS-BUILT.md       be-kickoff-iteration

   PRD.md and schema-routes.md (and BRIEF.md in brief mode) are the same bytes in both
   intake-files/ folders — pnpm iteration:list shows the same Schema-routes fingerprint in each.

 pnpm iteration:new feat <topic> --both                 README in both (each suggests its own Baseline)
 pnpm iteration:intake <it> <source> [--mode …] --both  the same mode in both, each on ITS OWN Baseline:
                                                        the snapshot here · PRD.md + schema-routes.md
                                                        (+ BRIEF.md in brief mode) there
                                                        no such folder there → stop
                                                        a differing copy there → diff shown, nothing
                                                        written (--replace, only while planning)
```

## Many iterations over time

```text
 main ───●───────────────────────●─────────────────────────────●──────────────────►
         ▲ merge                 ▲ merge                       ▲ merge
         │                       │                             │
   launch-2026-09-30-jxmr   feat-pharmacy-returns-…-kqzx   change-sales-filters-…-wvbn
   Baseline none            Baseline launch                Baseline feat-pharmacy-returns
   → initial                → incremental                  → incremental
   intake: full (22)        intake: full (23)              intake: brief (24 = 23 + BRIEF.md)
                 └──── diff A ↔ B ────┘        └──── diff B ↔ C: + BRIEF.md only ────┘
   Standing deviations: 1   copied: 1 → closes with 1      copied: 1 → closes with 2

 The latest done/frozen iteration's intake-files/ is the complete current design (after a brief,
 plus the written change); its AS-BUILT › Standing deviations is where the code differs from it.
 The chain of Baselines is the history of how both changed.

 Parallel work is fine:
   feat-a (Baseline launch) ───────────────●  merges first
   feat-b (Baseline launch) ─────────────────────●  merges second → in review, check overlap
                                                    with feat-a (same screen / entity / route)
```

## One incremental iteration, end to end

An illustrative example: the scenario, the fingerprints and the file contents are made up, while the
commands, the statuses and the shape of every output are the real ones.

```text
══════════════════════════════════════════════════════════════════════════════════════════════
 feat-pharmacy-returns-2026-10-06-kqzx — medicine returns, touching FE and BE
 Start: launch-2026-09-30-jxmr is still `implementing`; its AS-BUILT lists 1 Standing deviation
 (Medical › Sales is paginated at 50 rows; the design scrolls).
══════════════════════════════════════════════════════════════════════════════════════════════

 DAY 1 · 2026-10-06 ───────────────────────────────────────────────────────────────── OPEN
 YOU    git switch -c feat/pharmacy-returns              (same branch name in both repos)
 YOU    pnpm iteration:new feat pharmacy-returns --both
 CMD    Created.
        Iteration: feat-pharmacy-returns-2026-10-06-kqzx
        Baseline:  — (suggested — confirm it at planning Step 0)   ← nothing is done yet
                   clinozy-be: —
        Files:  clinozy-fe/iterations/feat-…-kqzx/README.md
                clinozy-be/iterations/feat-…-kqzx/README.md
 STATE  Status planning · Baseline — · Drop placed — · Intake mode — · Intake hash —
 YOU    write the Summary row: "Medicine returns: partial/full, credit notes, a returns list"

 ─────────────────────────────────────────────────────────────────────────────────── INTAKE
 YOU    export the FULL drop from Claude Design → ~/Downloads/clinozy-returns-drop/
          PRD.md · schema-routes.md · Clinozy.dc.html · support.js · preset.md · shell.md
          _index.md (13 Slugs, new: returns) · 13 × <slug>.md · _patterns.md · _report.md
          · design-brief-preset.md   (medical.md and returns.md open with "What changed")
 YOU    pnpm iteration:intake feat-…-kqzx ~/Downloads/clinozy-returns-drop --both
 CMD    Placed.
        Drop: ~/Downloads/clinozy-returns-drop · --mode full
        This repository (clinozy-fe/iterations/feat-…-kqzx/intake-files) — Status planning:
          23 new, 0 replaced, 0 removed, 0 unchanged
          Intake note: 23 received · Intake hash: 9c41d07e5b2a
        Sibling repository (clinozy-be/iterations/feat-…-kqzx/intake-files) — Status planning:
          2 new, 0 replaced, 0 removed, 0 unchanged
          Intake note: 2 received · Intake hash: 4e0a6b1f93c2
        Next: say "plan iteration feat-…-kqzx" — planning runs the gate first: …
 STATE  Drop placed 2026-10-06 · Drop source ~/Downloads/clinozy-returns-drop · Intake mode full
        Intake note 23 received · Schema-routes 3b7c1e09a2f4 (the same in clinozy-be)
        Intake hash 9c41d07e5b2a

 ───────────────────────────────────────────────────────────────────────────────── PLANNING
 YOU    "plan iteration feat-pharmacy-returns-2026-10-06-kqzx"
 SKILL  fe-iteration-planning
 Step 0 | Iteration      | Type   | Baseline | Status       | Eligible | Why                      |
        | launch-…-jxmr  | launch | none     | implementing | no       | not in planning          |
        | feat-…-kqzx    | feat   | —        | planning     | YES      | earliest-opened eligible |
        no done/frozen iteration yet → no suggestion → asks you for the Baseline
 YOU    "use the launch"  (its intake is complete; it will be done before the kickoff)
 CMD    pnpm iteration:baseline feat-…-kqzx launch-2026-09-30-jxmr
 STATE  History  - 2026-10-06 · Baseline — → launch-2026-09-30-jxmr · — · Nikunj Mavani
 GATE   pnpm iteration:intake feat-…-kqzx --check --baseline launch-2026-09-30-jxmr
        ✓ iterations/feat-…-kqzx/intake-files/ — 23 files, mandatory set complete,
          Intake hash 9c41d07e5b2a unchanged (Intake mode full)
        ✓ iterations/launch-2026-09-30-jxmr/intake-files/ — 22 files, mandatory set complete,
          Intake hash 158afb87d00c unchanged (Intake mode full)
        Gate passed.
 Step 1 reads all 23 files in full → coverage matrix, 23 rows
 Step 2 pnpm iteration:diff launch-2026-09-30-jxmr feat-…-kqzx      (abridged)
          Files       + returns.md
                      ~ PRD.md · _index.md · medical.md · schema-routes.md · Clinozy.dc.html
          Screens     + returns   ~ medical
          PRD.md changed · schema-routes.md changed · prototype changed
          Entities    + MedicalReturn   ~ MedicalSale
          Fields      + MedicalSale.returnedQty
          Enums       + return_reason
          Routes      + …/medical/returns   + …/medical/returns/create
          Operations  + Medical › createReturn   + Medical › listReturns
        vs "What changed": medical.md also gains a "Returned" badge on Sales rows that the
        notes never mention → FINDING F1 (raised to you, then planned as its own row)
        Standing deviations (the launch's AS-BUILT): Sales is paginated, not scrolling → the
        badge row is planned on the paginated table; KICKOFF §7 lists it
        classify: copy · styling (badge) · structural (Return step) · new screen · no preset
 Step 3 reconcile with evidence: returns.md says "dialog", prototype opens a right drawer
        (H:3120) → prototype wins → drawer
 Step 4 RED   does the Return step's sequence change with the payment mode? source silent
              → AskUserQuestion → your answer → D1 (RED) in plans/decisions.md
        AMBER refund toast copy missing → safe default → D2 (AMBER, open) + a ledger row
 Step 5 KICKOFF.md, all 9 sections; the route (Assignee — and Status open on every row):
          | # | Work item                          | Kind       | Depends | Skill/driver            | Acceptance                 |
          | 1 | Return labels in 11 locales        | copy       | —       | fe-i18n-constants       | keys exist · locale parity |
          | 2 | "Returned" badge on Sales (F1)     | styling    | —       | fe-design-ditto         | side by side 375 / 1440    |
          | 3 | Sale drawer: Return step (D1)      | structural | 1       | fe-design-ditto         | every state, both widths   |
          | 4 | Returns list + create (new screen) | screen     | 3       | fe-route-island → ditto | registered · side by side  |
          | 5 | Verify changed + full baseline set | verify     | 1–4     | fe-visual-regression    | no unexpected diff         |
 Step 6 self-check passes → pnpm iteration:status feat-…-kqzx ready-for-approval → STOP
 STATE  History  - 2026-10-06 · planning → ready-for-approval · — · Nikunj Mavani

 DAY 2 · 2026-10-07 ───────────────────────────────────────────────────────────── APPROVAL
 YOU    read KICKOFF.md → "approved"
 CMD    pnpm iteration:status feat-…-kqzx approved
 STATE  History  - 2026-10-07 · ready-for-approval → approved · — · Nikunj Mavani
        intake-files/ LOCKED (intake now refuses changes) · KICKOFF.md FROZEN

 DAY 3 · 2026-10-08 ────────────────────────────────────────────────────────────── KICKOFF
        the launch's own kickoff closes → launch-2026-09-30-jxmr is now `done`
 YOU    "kickoff iteration feat-pharmacy-returns-2026-10-06-kqzx"
 SKILL  fe-kickoff-iteration
 Step 0 | launch-…-jxmr | launch | none   | done     | no  | already built               |
        | feat-…-kqzx   | feat   | launch | approved | YES | approved · Baseline is done |
        AskUserQuestion → yes
 GATE   pnpm iteration:intake feat-…-kqzx --check → Gate passed.
        → pnpm iteration:status feat-…-kqzx implementing
        → AS-BUILT.md created ("Started 2026-10-08"), the launch's 1 Standing deviation copied in
 STATE  History  - 2026-10-08 · approved → implementing · — · Nikunj Mavani
 Step 1 reads KICKOFF.md, decisions.md, the README and the intake lines row 1 cites

 ROW 1  copy        do: keys in 11 locales → verify: i18n + parity gates green
                    record: AS-BUILT #1 (as planned) · row 1 → done → review ✓
 ROW 2  styling     do: fe-design-ditto (badge) → verify: side by side, 375 / 1440
                    record: AS-BUILT #2 · row 2 → done → review ✓
 ROW 3  structural  do: the Return step, sequence per D1 → verify: every state, both widths
                    record: AS-BUILT #3
                    IMPACT: a return issues a credit note (CN-###), and row 4's Returns list
                    should link to it → row 4's Acceptance changes → SCOPE → STOP
                    AskUserQuestion → you: "yes, link it"
                      → plans/decisions.md  D3 (SCOPE): each return links to its credit note
                      → AS-BUILT.md         Revisions: #3 → row 4 "…with the credit-note link"
                      → KICKOFF.md          row 4 gets "revised → AS-BUILT #3"
                    review ✓

 DAY 4 · 2026-10-09 ───────────────────────────────────────────────────────────── AS-BUILT
 ROW 4  new screen  do: fe-page-scaffolding → fe-route-island → fe-design-ditto
                    (built to the revised row: list + create dialog + credit-note link)
                    verify: side by side, both widths, every state
                    record: AS-BUILT #4 · row 4 → done → review ✓
 ROW 5  verify      the changed screens + the FULL visual baseline set → no unexpected diff
                    record: AS-BUILT #5 · row 5 → done → review ✓

 DAY 5 · 2026-10-10 ───────────────────────────────────────────────────────────────── DONE
 CLOSE  validate:tokens · theme-axis · structure · testids · type-check · lint → green
        ledger 5/5 done · AS-BUILT summary:
          planned, not built: —   built, not planned: credit-note link (D3)
          follow-ups: return-reason analytics on Today
        Standing deviations: 1 — Sales still paginated (since the launch); none new, none resolved
        pnpm iteration:status feat-…-kqzx done
 STATE  History  - 2026-10-10 · implementing → done · — · Nikunj Mavani
 YOU    open the PR yourself. If another iteration merged into main meanwhile, check overlap
        (same screen / entity / route) and resolve it in review.

 DAY 6 · 2026-10-11 ─────────────────────────────────────────────────────────────── FROZEN
 YOU    in the last commit before the merge: pnpm iteration:status feat-…-kqzx frozen
 STATE  History  - 2026-10-11 · done → frozen · — · Nikunj Mavani
        merged → the folder is never edited again; the next iteration's suggested
        Baseline is feat-pharmacy-returns-2026-10-06-kqzx
══════════════════════════════════════════════════════════════════════════════════════════════
```

The folder at the end:

```text
iterations/feat-pharmacy-returns-2026-10-06-kqzx/
├── README.md
├── intake-files/        23 files: the snapshot (locked since 2026-10-07)
├── plans/
│   └── decisions.md     D1 RED · D2 AMBER · D3 SCOPE
├── KICKOFF.md           frozen; rows 1–5 done; row 4 "revised → AS-BUILT #3"
└── AS-BUILT.md          entries #1–#5 · 1 revision · summary · 1 Standing deviation
```

Its README:

```text
# feat-pharmacy-returns-2026-10-06-kqzx

| Field | Value |
| --- | --- |
| Type | feat |
| Topic | pharmacy-returns |
| Owner | Nikunj Mavani |
| Opened | 2026-10-06 |
| Branch | feat/pharmacy-returns |
| Baseline | launch-2026-09-30-jxmr |
| Status | frozen |
| Summary | Medicine returns: partial/full, credit notes, a returns list |
| Drop placed | 2026-10-06 |
| Drop source | ~/Downloads/clinozy-returns-drop |
| Intake mode | full |
| Intake note | 23 received |
| Schema-routes | 3b7c1e09a2f4 |
| Intake hash | 9c41d07e5b2a |

## History

- 2026-10-06 · Baseline — → launch-2026-09-30-jxmr · — · Nikunj Mavani
- 2026-10-06 · planning → ready-for-approval · — · Nikunj Mavani
- 2026-10-07 · ready-for-approval → approved · — · Nikunj Mavani
- 2026-10-08 · approved → implementing · — · Nikunj Mavani
- 2026-10-10 · implementing → done · — · Nikunj Mavani
- 2026-10-11 · done → frozen · — · Nikunj Mavani
```

## The same iteration as an overlay

If Claude Design sends only what changed, the intake builds the same snapshot — so the same Intake
hash, and everything after the intake is identical.

```text
 YOU    pnpm iteration:baseline feat-…-kqzx launch-2026-09-30-jxmr   ← first: an overlay builds on it
        (clinozy-be confirms its own Baseline for its same-named iteration the same way)
 YOU    ls ~/Downloads/clinozy-returns-changes/
          Clinozy.dc.html · PRD.md · _index.md · medical.md · returns.md · schema-routes.md
 YOU    pnpm iteration:intake feat-…-kqzx ~/Downloads/clinozy-returns-changes --mode overlay --both
 CMD    Placed.
        Drop: ~/Downloads/clinozy-returns-changes · --mode overlay on launch-2026-09-30-jxmr
        This repository (clinozy-fe/iterations/feat-…-kqzx/intake-files) — Status planning:
          23 new, 0 replaced, 0 removed, 0 unchanged
          Intake note: 6 received (_index.md, Clinozy.dc.html, medical.md, PRD.md, returns.md,
          schema-routes.md) · 17 carried forward from launch-2026-09-30-jxmr · Intake hash: 9c41d07e5b2a
        Sibling repository (clinozy-be/iterations/feat-…-kqzx/intake-files) — Status planning:
          2 new, 0 replaced, 0 removed, 0 unchanged
          Intake note: 2 received (PRD.md, schema-routes.md) · 0 carried forward from
          launch-2026-09-30-jxmr · Intake hash: 4e0a6b1f93c2
```

## A brief iteration, end to end

No new design — the change is written down ("implement filters like these on Sales and Purchases").

```text
══════════════════════════════════════════════════════════════════════════════════════════════
 change-sales-filters-2026-10-14-wvbn — date and supplier filters, written as a brief
 Start: feat-pharmacy-returns-2026-10-06-kqzx is frozen, with 1 Standing deviation.
══════════════════════════════════════════════════════════════════════════════════════════════

 DAY 1 · 2026-10-14 ──────────────────────────────────────────────────────────── OPEN + BRIEF
 YOU    pnpm iteration:new change sales-filters
 CMD    Iteration: change-sales-filters-2026-10-14-wvbn
        Baseline:  feat-pharmacy-returns-2026-10-06-kqzx (suggested — confirm it at planning Step 0)
        … only a BRIEF.md: --mode brief — both build on the README's Baseline
          (feat-pharmacy-returns-2026-10-06-kqzx); for another one, first: pnpm iteration:baseline …
 YOU    copy tooling/iterations/templates/BRIEF.md to ~/Desktop/BRIEF.md and fill every section:
          What changes   Sales and Purchases get a date-range filter and a supplier filter
          Why            month-end reconciliation means scrolling the whole list
          Affected       Screens: medical · Entities: MedicalSale, MedicalPurchase
                         Routes: /medical/:tab
          Rules          the filters live in the URL; "This month" by default; active suppliers only
          Acceptance     [ ] filter by date range  [ ] filter by supplier  [ ] a shared URL keeps both
          Out of scope   Payments, Clinic stock
 YOU    pnpm iteration:intake change-…-wvbn ~/Desktop/BRIEF.md --mode brief
 CMD    Placed.
        Drop: ~/Desktop/BRIEF.md · --mode brief on feat-pharmacy-returns-2026-10-06-kqzx
        This repository (clinozy-fe/iterations/change-…-wvbn/intake-files) — Status planning:
          24 new, 0 replaced, 0 removed, 0 unchanged
          Intake note: 1 received (BRIEF.md) · 23 carried forward from
          feat-pharmacy-returns-2026-10-06-kqzx · Intake hash: 7f2d915ce04b
        (a BRIEF.md missing a section, or any other changed file, stops it with nothing written)

 ───────────────────────────────────────────────────────────────────────────────── PLANNING
 YOU    "plan iteration change-sales-filters-2026-10-14-wvbn"
 Step 0 eligible · Baseline feat-pharmacy-returns-… (frozen) → you confirm it
 GATE   pnpm iteration:intake change-…-wvbn --check --baseline feat-pharmacy-returns-2026-10-06-kqzx
        → Gate passed.
 Step 1 reads BRIEF.md first, then all 24 files in full → coverage matrix
 Step 2 brief: pnpm iteration:diff feat-…-kqzx change-…-wvbn → Files + added (1): BRIEF.md and
        nothing else ✓ · BRIEF.md is the change list
        Standing deviations (feat AS-BUILT): Sales is paginated → the filters sit above the
        paginated table and send it back to page 1
 Step 3 brief: BRIEF.md ↔ medical.md and the code — medical.md's toolbar has search only, and
        useMedicalSales already takes a date range → reuse it (evidence: file:line)
 Step 4 RED   on mobile, filter chips or a bottom sheet? BRIEF.md is silent → AskUserQuestion → D1
 Step 5 KICKOFF.md — §7: the filters will be a new Standing deviation (the design does not draw
        them); §8: verify the BRIEF.md acceptance criteria + the full baseline set. The route:
          | 1 | Filter labels in 11 locales        | copy       | —   | fe-i18n-constants    | keys exist · parity |
          | 2 | Sales + Purchases filters (D1)     | structural | 1   | shadcn → fe-design-ditto | BRIEF criteria 1–3 |
          | 3 | Verify BRIEF + full baseline set   | verify     | 1–2 | fe-visual-regression | no unexpected diff |
 Step 6 → ready-for-approval → you approve → approved

 ────────────────────────────────────────────────────────────────────────────────── KICKOFF
 GATE   pnpm iteration:intake change-…-wvbn --check → Gate passed. → implementing
        → AS-BUILT.md, with feat-pharmacy-returns' 1 Standing deviation copied in
 ROW 2  do: the filters on Sales and Purchases, the rest of each screen still to medical.md
        verify: BRIEF.md criteria 1–3 ✓ · the touched screens still match their specs elsewhere
        record: AS-BUILT #2 and a new Standing deviation —
          | Medical › Sales, Purchases filters | no filters (medical.md) | date range + supplier |
          | change-sales-filters-2026-10-14-wvbn | BRIEF.md · D1 |
 CLOSE  Standing deviations: 2 — Sales paginated (since the launch) · the filters (since this one)
        → the next drop that draws the filters resolves that one, and its iteration removes it
══════════════════════════════════════════════════════════════════════════════════════════════
```

## What if

```text
 the gate fails at planning or kickoff
   → the skill prints the output and ends the turn — nothing written, no status changed
   → follow the "fix:" line: restore the delivered file, or re-run the intake with --replace
     (while planning; later, move the iteration back to planning first)

 the designer re-sends a changed drop while planning
   → iteration:intake shows the diff and writes nothing → re-run with --replace (planning only);
     the new snapshot replaces the old one whole — a file the new full drop lacks is removed

 a screen is removed in an overlay
   → an overlay never removes a file → send the full drop: --mode full --replace

 the Baseline changes after an overlay or brief intake
   → the gate fails: "built on X, but the README's Baseline is Y" → re-run the intake with --replace

 a change after approval (or mid-build) is bigger than one row
   → pnpm iteration:status <it> planning --reason "<why>"
   → intake --replace if the drop changed → re-plan (Steps 0–6) → ready-for-approval → approved

 the kickoff is asked for while the Baseline is not done yet
   → Step 0 marks it not eligible (Baseline not done/frozen) — planning can go ahead, the build waits

 a mistake is found after the merge
   → never edit the frozen folder → pnpm iteration:new fix <topic>, with this one as its Baseline
```
