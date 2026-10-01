# Iteration walkthrough

How a design iteration moves from a Claude Design drop to frozen, as text diagrams — the two phases,
the folder, the Status lifecycle, planning and kickoff step by step, how the incremental delta is
found, the two repositories — and then one incremental iteration traced end to end.

The rules are in [`iterations/README.md`](../../../iterations/README.md); the pages for each phase are
in [the process index](README.md).

## The two phases at a glance

```text
PHASE 1 · PLANNING  (no code — ends in your approval)
 │
 ├─ 1 NEW         pnpm iteration:new <type> <topic> [--both]
 │                → iterations/<it>/README.md · Baseline suggested          [planning]
 │
 ├─ 2 INTAKE      pnpm iteration:intake <it> <drop-folder> [--both]
 │                → the FULL drop, checked, into intake-files/              [planning]
 │
 ├─ 3 PLANNING    "plan iteration <it>" → fe-iteration-planning, Steps 0–6
 │                → KICKOFF.md (plan + ordered ledger) · plans/decisions.md [ready-for-approval]
 │
 └─ 4 APPROVAL    you approve → pnpm iteration:status <it> approved
                  → intake-files/ LOCKED · KICKOFF.md FROZEN                [approved]

PHASE 2 · KICKOFF  (the approved plan, built one ledger row at a time)
 │
 ├─ 5 KICKOFF     "kickoff iteration <it>" → fe-kickoff-iteration, Step 0
 │                → Baseline must be none/done/frozen · AS-BUILT.md started [implementing]
 │
 ├─ 6 AS-BUILT    each row: do → verify → record → impact check → review    [implementing]
 │
 ├─ 7 DONE        gates green · every row done or deferred · AS-BUILT summary
 │                → pnpm iteration:status <it> done                         [done]
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
│     Drop placed · Drop source · Schema-routes (12-char sha256 of schema-routes.md)
│
├── intake-files/ ....... the FULL drop, exactly as delivered   written by iteration:intake
│     PRD.md · schema-routes.md · _index.md · preset.md · shell.md    LOCKED from approved
│     one <slug>.md per Slug in _index.md
│     <prototype>.html + every *.js it loads
│     optional: _patterns.md · _report.md · design-overview.md · …
│
├── plans/decisions.md .. blocking answers (RED / AMBER) and    written by planning,
│                         scope decisions (SCOPE), in order       then by the kickoff
│
├── KICKOFF.md .......... the plan + the ordered ledger         written by planning
│                         (the "route")                           FROZEN from approved *
│
└── AS-BUILT.md ......... what was actually built, row by row   written by the kickoff
                          + revisions to upcoming rows + summary

* after approval only the ledger's Status column and "revised → AS-BUILT #n" markers change
```

## The Status lifecycle

Every move goes through `pnpm iteration:status`, which writes the Status row and one History line
(`- date · from → to · reason · who`).

```text
                    pnpm iteration:new
                              │
                              ▼
     ┌────────────►┌─────────────────────┐
     │             │      planning       │  the drop is placed and planned
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
     │                        │  kickoff Step 0: Baseline is none, done or frozen
     │                        ▼
     │             ┌─────────────────────┐
     └◄─ --reason ─┤    implementing     │  ledger built row by row · AS-BUILT.md
                   └──────────┬──────────┘
                              │  every row done (or deferred with your OK) · AS-BUILT summary
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
 │
 ├─ Step 1  INTAKE ───── iteration:intake <it> iterations/<it>/intake-files --dry-run must pass
 │                       reads EVERY intake file in full → coverage matrix
 │                       (file · read fully? · kind · what it owns · where it is in the plan)
 │
 ├─ Step 2  DELTA ────── initial: n/a
 │                       incremental: pnpm iteration:diff <baseline> <it> (+ --json)
 │                       ⟷ the designer's "What changed" → a diff hit the notes omit = FINDING
 │                       classify every change: token · copy · styling · structural · new screen
 │                       preset or layout changed → scoped section with exact value moves, STOP
 │
 ├─ Step 3  RECONCILE ── md ↔ prototype, every verdict with file:line evidence
 │                       prototype wins on behaviour · dead CSS flagged · md-only → deviation
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
 ├─ Step 0  CONFIRM ── eligible = Status approved AND Baseline none/done/frozen
 │                     AskUserQuestion → pnpm iteration:status <it> implementing → AS-BUILT.md
 ├─ Step 1  READ ───── KICKOFF.md · plans/decisions.md · README · the intake lines each row cites
 │
 ▼
 ┌──► (1) DO ─────── screen row → fe-design-ditto: interaction shell → flow skeleton →
 │                   regions (desktop + mobile together) → content → states → motion
 │                   other rows → the skill the row names (fe-route-island, fe-i18n-constants, …)
 │    (2) VERIFY ─── the row's Acceptance · a screen side by side at 375px and 1440px, per state
 │                   incremental → plus the FULL visual baseline set (catches ripple)
 │    (3) RECORD ─── AS-BUILT entry #n: planned · built · difference · why · decision · commit
 │                   the ledger row's Status → done
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
          (planned-not-built · built-not-planned · follow-ups) → iteration:status <it> done
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
                     │            X/intake-files/ ─────┤  both are FULL drops
                     │          <it>/intake-files/ ────┤  (README, KICKOFF, plans and
                     │                                 │   AS-BUILT are never compared)
                     │                                 ▼
                     │                  pnpm iteration:diff X <it>  (--json for the skill)
                     │                                 │
                     │      files + − ~ · screens (via _index.md Slugs) · PRD / schema-routes /
                     │      prototype changed? · entities · fields · enums · routes · operations
                     │                                 │
                     │      reconcile with the designer's "What changed" notes
                     │      (anything the diff shows that the notes omit = a FINDING)
                     │                                 │
                     ▼                                 ▼
      read · plan · build EVERYTHING          classify each change → that is the route
      route: preset → shell (made live) →     route: global (tokens, preset, layout) →
             stores → icons → screens                copy → styling → structural → new screens
      verify: every screen                    verify: changed screens + full baseline set
```

The Baseline's `intake-files/` is mandatory: `iteration:baseline` refuses a Baseline without the
complete required set, and `iteration:diff` refuses either side without `intake-files/`.

## Two repositories

```text
 clinozy-fe/iterations/feat-…-kqzx/            clinozy-be/iterations/feat-…-kqzx/   (same name)
 ├── README.md         FE's own Baseline        ├── README.md         BE's own Baseline
 ├── intake-files/     the full FE drop         ├── intake-files/     PRD.md + schema-routes.md
 ├── plans/            decisions.md             ├── plans/            decisions, coverage, …
 ├── KICKOFF.md        fe-iteration-planning    ├── KICKOFF.md        be-iteration-planning
 └── AS-BUILT.md       fe-kickoff-iteration     └── AS-BUILT.md       be-kickoff-iteration

   PRD.md and schema-routes.md are the same bytes in both intake-files/ folders —
   pnpm iteration:list shows the same Schema-routes fingerprint in each repo.

 pnpm iteration:new feat <topic> --both      README in both (each suggests its own Baseline)
 pnpm iteration:intake <it> <drop> --both    full drop here · PRD.md + schema-routes.md there
                                             (a differing copy there → diff shown, nothing written)
```

## Many iterations over time

```text
 main ───●───────────────────────●─────────────────────────────●──────────────────►
         ▲ merge                 ▲ merge                       ▲ merge
         │                       │                             │
   launch-2026-09-30-jxmr   feat-pharmacy-returns-…-kqzx   fix-refund-rounding-…-pmwd
   Baseline none            Baseline launch                Baseline feat-pharmacy-returns
   → initial                → incremental                  → incremental
   intake: full drop A      intake: full drop B            intake: full drop C
                 └──── diff A ↔ B ────┘        └───── diff B ↔ C ─────┘

 The latest done/frozen iteration's intake-files/ is always the complete current design;
 the chain of Baselines is the history of how it changed.

 Parallel work is fine:
   feat-a (Baseline launch) ───────────────●  merges first
   feat-b (Baseline launch) ─────────────────────●  merges second → in review, check overlap
                                                    with feat-a (same screen / entity / route)
```

## One incremental iteration, end to end

An illustrative example: the scenario, the fingerprint and the file contents are made up, while the
commands, the statuses and the shape of every output are the real ones.

```text
══════════════════════════════════════════════════════════════════════════════════════════════
 feat-pharmacy-returns-2026-10-06-kqzx — medicine returns, touching FE and BE
 Start: launch-2026-09-30-jxmr is still `implementing`.
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
 STATE  Status planning · Baseline — · Drop placed — · Schema-routes —
 YOU    write the Summary row: "Medicine returns: partial/full, credit notes, a returns list"

 ─────────────────────────────────────────────────────────────────────────────────── INTAKE
 YOU    export the FULL drop from Claude Design → ~/Downloads/clinozy-returns-drop/
          PRD.md · schema-routes.md · Clinozy.dc.html · support.js · preset.md · shell.md
          _index.md (13 Slugs, new: returns) · 13 × <slug>.md · _patterns.md · _report.md
          · design-brief-preset.md   (medical.md and returns.md open with "What changed")
 YOU    pnpm iteration:intake feat-…-kqzx ~/Downloads/clinozy-returns-drop --both
 CMD    Placed.
        This repository (…/intake-files) — Status planning: 23 new, 0 replaced, 0 unchanged
        Sibling repository (…/intake-files) — Status planning: 2 new  (PRD.md, schema-routes.md)
 STATE  Drop placed 2026-10-06 · Drop source ~/Downloads/clinozy-returns-drop
        Schema-routes 3b7c1e09a2f4              ← the same fingerprint in clinozy-be

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

 Step 1 intake --dry-run on its own intake-files/ → passes (0 new, 23 unchanged)
        reads all 23 files in full → coverage matrix, 23 rows
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
        AskUserQuestion → yes → pnpm iteration:status feat-…-kqzx implementing
        → AS-BUILT.md created ("Started 2026-10-08")
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
├── intake-files/        23 files, exactly as delivered (locked since 2026-10-07)
├── plans/
│   └── decisions.md     D1 RED · D2 AMBER · D3 SCOPE
├── KICKOFF.md           frozen; rows 1–5 done; row 4 "revised → AS-BUILT #3"
└── AS-BUILT.md          entries #1–#5 · 1 revision · summary
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
| Schema-routes | 3b7c1e09a2f4 |

## History

- 2026-10-06 · Baseline — → launch-2026-09-30-jxmr · — · Nikunj Mavani
- 2026-10-06 · planning → ready-for-approval · — · Nikunj Mavani
- 2026-10-07 · ready-for-approval → approved · — · Nikunj Mavani
- 2026-10-08 · approved → implementing · — · Nikunj Mavani
- 2026-10-10 · implementing → done · — · Nikunj Mavani
- 2026-10-11 · done → frozen · — · Nikunj Mavani
```

## What if

```text
 the designer re-sends a changed drop while planning
   → iteration:intake shows the diff and writes nothing → re-run with --replace (planning only)

 a change after approval (or mid-build) is bigger than one row
   → pnpm iteration:status <it> planning --reason "<why>"
   → intake --replace if the drop changed → re-plan (Steps 0–6) → ready-for-approval → approved

 the kickoff is asked for while the Baseline is not done yet
   → Step 0 marks it not eligible (Baseline not done/frozen) — planning can go ahead, the build waits

 a mistake is found after the merge
   → never edit the frozen folder → pnpm iteration:new fix <topic>, with this one as its Baseline
```
