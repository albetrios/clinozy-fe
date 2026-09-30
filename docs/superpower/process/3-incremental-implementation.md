# Process 3 — Incremental FE implementation (v2, v3, …)

**Run for every version after the first.** Assumes
[Process 1 — Common adoption](1-common-adoption.md) and that
[Process 2 step 5c](2-initial-implementation.md) committed the previous version.

The whole goal: **touch only what changed.** If you find yourself re-reading a
screen the design didn't alter, you've fallen back to Process 2.

---

## Prerequisites — have these before starting

Incremental needs one thing Initial doesn't: **a committed previous version to
diff against.**

| Prerequisite                                                                                                         | Source            | Required?                                   |
| -------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------- |
| Previous specs committed in git (`legacy/` history)                                                                  | Process 2 step 5c | **Yes** — no baseline, no diff              |
| The **new** versioned spec (`<name>vN.md`), saved **beside** the old — ideally opening with a "What changed" section | Claude Design     | **Yes** — what changed                      |
| The **new** prototype (`*.html` / `*.js`), kept beside the old                                                       | Claude Design     | If a prototype is used — it outranks the md |
| Existing clinozy-fe implementation of v(N-1)                                                                         | Process 2 output  | **Yes** — there must be something to update |
| Visual-regression baselines from v(N-1)                                                                              | Process 2 step 5b | Recommended — catches ripple                |

The **preset never re-enters** here — it's a once-ever file (Process 2 Step 2).
An incremental run touches it only if the delta explicitly changes tokens.

Quick check — both must pass:

```bash
git log --oneline -- legacy/   # non-empty → there's a baseline to diff
git status --short legacy/      # shows the new specs you're about to stage
```

If the first is empty, stop — see the Precondition below; this has to run as
Process 2.

---

## Precondition — is there a previous version to diff against?

Either works:

```bash
ls -R legacy/                  # is the previous version folder still here? (legacy/v<N-1>/)
git log --oneline -- legacy/   # or is it in git history? (overwrite pattern)
```

If **neither** — no old versioned file, no history — there's nothing to diff.
**Stop.** This is a Process 2 build; snapshot at its step 5c so the _next_ one is
incremental.

Note: `git diff --no-index legacy/v5/ legacy/v6/` compares two folders whether or
not they're committed, so versioned folders don't strictly require a prior commit —
but you still want the previous version committed for the ripple-catching
baselines (step 5b).

## The "start button"

**Paste [`kickoff-prompt.md`](../design/kickoff-prompt.md) to Claude Code** with:

```text
MODE: incremental
VERSION: v2   (or v3, …)
Build: just the delta
```

That drives the steps below — it runs the baseline check, diffs the specs, and
classifies the changes. The steps here are what it does; you don't run them by
hand.

---

## ==== STEP 1 — Get the new version from Claude Design ====

When you update the design, Claude Design gives you a **new version** — specs plus
prototype. Save it in its own folder, beside the previous version's:

```text
legacy/
├── v5/                     ← previous version, kept whole
│   ├── flowdmv5-screen.md
│   └── Flowdm v5 ….html · support.js
└── v6/                     ← NEW — its own folder
    ├── flowdmv6-screen.md  ← opens with "What changed from v5"
    └── Flowdm v6 ….html · support.js
```

Ask Claude Design to open the new spec with a **"What changed from vN-1"**
section — you already do this (v5's file opened with `## ⚡ What changed from v4 →
v5` and noted `Preset: unchanged`). That section is the designer's stated delta:
the fastest read of what moved.

> A flat `legacy/*.md` per version (overwrite + `git diff --staged`) still works
> — but one folder per version keeps prototypes tidy and the diff a clean
> `v5/` → `v6/` folder compare.

## ==== STEP 2 — Establish the delta from two signals ====

The kickoff reads **both**, because they catch different things:

1. **The `What changed` section** — what the designer _meant_ to change.
2. **Old file vs new file** — what actually changed, including anything the
   changelog forgot:

   ```bash
   # versioned files side by side:
   git diff --no-index legacy/v5/ legacy/v6/     # folder-to-folder; per-file also works

   # or, if you overwrote + committed instead:
   git diff --staged -- legacy/
   ```

If the file diff shows a change the `What changed` section doesn't mention, **that
is a finding** — surface it, don't silently build it. A changelog is someone's
account of the diff; the diff is the truth. (Same rule as prototype-outranks-spec,
one level up.)

**The reconciled delta is the work list.** Nothing outside it gets re-read.

## ==== STEP 3 — Classify every change before touching code ====

| Change                                                  | Cost     | Blast radius                         | Gate                 |
| ------------------------------------------------------- | -------- | ------------------------------------ | -------------------- |
| Token values                                            | Trivial  | **Every screen** — re-screenshot all | Contrast recheck     |
| Copy                                                    | Trivial  | Locale files only                    | —                    |
| Component styling                                       | Low      | Contained                            | —                    |
| **Structural** (popup shape, step sequence, table↔card) | **High** | Rebuild                              | **Full RED gate**    |
| **New screen / surface**                                | High     | New island + registrations           | **Full RED gate**    |
| **Preset change** (tokens/type/radius/motion)           | **High** | **Every screen + all presets**       | **Sub-kickoff (3b)** |
| **Layout / shell change** (auth, public, app shell)     | **High** | **Every route the shell owns**       | **Sub-kickoff (3b)** |

- **First three rows batch safely** — apply directly.
- **Structural / new-screen** run the full `legacy-ditto` gate as if new
  (Process 2, steps 3–4, scoped to those screens).
- **Preset / layout change** are cross-cutting — they don't touch one screen,
  they re-tone or re-frame all of them. Route them through **Step 3b**.

**The token-change trap:** trivial to make, touches _every_ screen. This is
exactly what step 5b's baselines exist to catch — a value tweak that silently
shifts a screen you weren't editing.

## ==== STEP 3b — Preset or layout changed? Spin a scoped kickoff ====

A preset or layout change is not a screen edit — it re-tones or re-frames the
whole app. Treat it like a mini-build with its own plan, the same way an initial
build does. **Before touching code, write a short scoped kickoff** (save it next
to the spec, e.g. `legacy/v<N>/KICKOFF.md`) covering just this change:

**If the PRESET changed:**

- Which tokens moved (old → new), light **and** dark.
- Recompute every contrast pair locally; brand colours failing AA keep their
  value only on non-text tokens.
- The four registration points (`index.css` block, `.theme-dot`, `THEME_PRESETS`,
  `theme-init.js`) — confirm all four.
- Blast radius: **every screen re-screenshots** (step 5b full baseline).

**If a LAYOUT / SHELL changed:**

- Which shell (auth / public / app) and which routes it owns — list them.
- Exact values to port (type, spacing, colour, bg, radius, shadow) — read from
  the prototype CSS, not memory.
- **Make it live** (Process 1 → _Making a variant live_): set it as the default
  **and** pin it (`SHUFFLE_TEMP.<axis> = false`); confirm the default isn't
  overridden by a persisted value.
- Platform-surface check: relocate-never-delete — every surface still has a home.
- Blast radius: **every route the shell owns** re-verifies, not one.

Show me the scoped kickoff and **stop** before building. This is the step whose
absence caused "the v5 layout isn't the default" and "you didn't take the exact
design values" — it forces both to the front.

## ==== STEP 4 — Apply only the delta ====

Work the classified list. **Do not re-read screens the diff didn't touch** —
that re-reading is the cost Process 3 exists to avoid.

For structural or new-screen rows, the build order from Process 1 still applies
(interaction shell → skeleton → regions → content → states → motion), just scoped
to the changed screen.

## ==== STEP 5 — Verify · Pin · Snapshot (again) ====

Same as Process 2 step 5, with one difference:

- **5a. Verify** the changed screens by comparison, and **close the delta
  ledger** — every row `done` or `deferred` with recorded OK (Process 1 → _The
  delta ledger_). An open row = not done; keep going, don't report success.
- **5b. Re-run the _full_ baseline set** — not just changed screens. The point is
  to catch ripple. Update baselines only where the change was intended; an
  unexpected diff is a finding, not a baseline to bless.
- **5c. Commit** the new specs:

```bash
git add -f legacy/ && git commit -m "chore: design specs v2 (as built)"
```

This sets up v3 to be incremental too. The loop sustains itself.

---

## Why this is cheaper than Process 2

|             | Process 2 (Initial) | Process 3 (Incremental)             |
| ----------- | ------------------- | ----------------------------------- |
| Read        | Every spec, in full | Only the diff                       |
| Build       | Every screen        | Only changed screens                |
| Verify      | Every screen        | Changed screens + full ripple check |
| Cost driver | Screen count        | Change count                        |

Process 2's cost scales with how big the design is. Process 3's scales with how
much _changed_ — which for a v2 or v3 is usually small.

---

## Known gap

`legacy-ditto` has **no delta mode** — Process 3 is a documented procedure, not
an automated one. The highest-leverage improvement is a Step 0 in the skill that
diffs spec versions, classifies each change against the Step 3 table, and runs
the full gate only on structural changes. Until then, the classification is
yours to make.
