# Process 2 — Initial FE implementation

**Run once per surface.** Everything is new; nothing exists to diff against.
Assumes [Process 1 — Common adoption](1-common-adoption.md).

Five steps. The first four are yours and already work. Step 5 is the one that
makes the _next_ version cheap.

---

## Prerequisites — have these before Step 3

Step 3 (the start button) does nothing useful until `legacy/` is populated.
Steps 1–2 produce these; confirm they exist first.

| File                                   | Source                                                                                             | Required?                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `legacy/preset.md`                     | Claude Design — [`design-brief-prompt.md`](../design/design-brief-prompt.md)                       | **Yes** — theme first                             |
| `legacy/<screen>.md` (one per screen)  | Claude Design — [`extract-screens-prompt.md`](../design/extract-screens-prompt.md)                 | **Yes** — the screens to build                    |
| `legacy/shell.md`                      | Claude Design — same screens prompt                                                                | If a custom app shell is in scope                 |
| `legacy/<auth/public>.md` + layout JSX | Claude Design — [`auth-public-routes-brief.md`](../design/auth-public-routes-brief.md)             | If auth/public routes are in scope                |
| `legacy/<overlays/loading>.md`         | Claude Design — [`extract-system-surfaces-prompt.md`](../design/extract-system-surfaces-prompt.md) | If overlays/loading are in scope                  |
| `legacy/*.html`, `legacy/*.js`         | Claude Design — the prototype export                                                               | Optional, but it **outranks the md** when present |

Everything sits **flat in `legacy/`**. Nothing from the clinozy-fe repo is a
prerequisite — the skill reads the live codebase itself. If none of these exist
yet, you're not ready for Step 3; do Steps 1–2 first.

Quick check:

```bash
ls legacy/
```

---

## ==== STEP 1 — Design ====

In Claude Design, build the requirement. It generates the prototype:

```text
<name>.html   +   support.js
```

Nothing to do in clinozy-fe yet. This is design work, and it should stay yours.

## ==== STEP 2 — Extract ====

Paste these prompts into Claude Design, in this order. Save every returned `.md`
**flat in `legacy/`**, alongside the prototype files.

| #   | Prompt                                                                             | Frequency                                                 |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | [`design-brief-prompt.md`](../design/design-brief-prompt.md)                       | **Once, ever** — the preset. After this it never changes. |
| 2   | [`extract-screens-prompt.md`](../design/extract-screens-prompt.md)                 | **Per version** — shell + screens.                        |
| 3   | [`auth-public-routes-brief.md`](../design/auth-public-routes-brief.md)             | Once — auth/public layouts + routes.                      |
| 4   | [`extract-system-surfaces-prompt.md`](../design/extract-system-surfaces-prompt.md) | Once — overlays + loading.                                |

End state — `legacy/` holds:

```text
legacy/
├── preset.md            ← from prompt 1
├── shell.md             ← from prompt 2
├── <screen>.md          ← from prompt 2, one per screen
├── <name>.html          ← the prototype
└── support.js
```

## ==== STEP 3 — Start the build (this is the "start button") ====

**Paste [`kickoff-prompt.md`](../design/kickoff-prompt.md) to Claude Code (here,
in clinozy-fe)** with:

```text
MODE: initial
VERSION: v1
Build: all screens
```

(Short form: just say **"implement from legacy"** — the skill auto-triggers. The
kickoff file is the fuller version that spells out the stop points.)

> **Who gets what:** the Step 2 prompts go to **Claude Design** and produce
> `.md`. This kickoff prompt goes to **Claude Code** and consumes them. Different
> apps, different jobs.

`fe-legacy-ditto` now:

1. Inventories `legacy/` (`ls legacy/`)
2. Reads every `.md` **and** the prototype, in full
3. Reconciles the markdown against the prototype (prototype wins)
4. **Stops for your confirmation** before writing any code

Anything RED (see Process 1) comes back as a question.

**Do not skip the stop.** It exists because building on a summary — rather than
the source — is what produced every rebuild in this repo.

## ==== STEP 4 — Build ====

In the order from Process 1: **preset → shell → screens**.

- Preset: recompute every contrast ratio locally; register in all four places.
- Shell: new variant, relocate-never-delete.
- Screens: one at a time, desktop and mobile together.

This is where "ditto" happens — the implementation matches the design across all
screens.

## ==== STEP 5 — Verify · Pin · Snapshot ====

**The step that was missing.** Its absence is why every version currently costs
as much as the first. Three parts, in order:

### 5a. Verify by comparison

Side-by-side, source vs implementation, 375px and 1440px, per screen, per state.
Then the static gates (Process 1, DONE definition).

### 5b. Pin the result

Capture visual-regression baselines
([`fe-visual-regression`](../../../agent-os/skills/fe-visual-regression/SKILL.md)).

This is the safety net for the _next_ version: when a token changes in v3, the
diff shows every screen it touched — including the ones you weren't editing.

### 5c. Snapshot the specs

```bash
git add -f legacy/ && git commit -m "chore: design specs v1 (as built)"
```

**`legacy/` is untracked by default.** Dropping v2's spec over v1's destroys the
only cheap way to compute what changed. This one commit turns `git diff` into the
work list for v2.

> Without 5c, v2 is Process 2 again. With it, v2 is Process 3.

---

**Result:** a ditto Claude-Design implementation across all screens, pinned and
committed. **Next version →**
[Process 3 — Incremental](3-incremental-implementation.md).
