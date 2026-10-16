# KICKOFF — change-motion-consistency-2026-10-15-uiya

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field         | Value                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| Iteration     | `change-motion-consistency-2026-10-15-uiya`                                                   |
| Mode          | initial — from scratch                                                                        |
| Baseline      | `none` ([D2](plans/decisions.md))                                                             |
| Intake mode   | brief — `BRIEF.md` alone, the whole snapshot                                                  |
| Intake hash   | `04d065907a42` (gate passed 2026-10-15)                                                       |
| Schema-routes | — (no entity or route changes)                                                                |
| Sources       | `intake-files/BRIEF.md`; the current code (it holds `change-motion-polish`'s work); the audit |
| Date          | 2026-10-15                                                                                    |
| Standard      | `emil-design-eng` + `review-animations/STANDARDS.md` ([D4](plans/decisions.md))               |
| Plans with    | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills)          |
| Sibling       | none — clinozy-be changes nothing                                                             |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md); every finding is a row in
[plans/motion-audit.md](plans/motion-audit.md).

1. **D1** — Emil's standards across the app's motion, and a revision of what the first motion iteration built.
2. **D2** — A new `change` iteration (a `done` one cannot return to planning); Baseline `none`.
3. **D3** — Same branch and future PR as `change-motion-polish`.
4. **D4** — The standard: the two skill files; findings in the audit.
5. **D5** — Glides and the switch thumb on the strong ease-in-out; every glide 240ms.
6. **D6** — The covered label's ink transitions on the thumb's curve (not a duplicated list).
7. **D7** — Tailwind's `ease-out`, `ease-in-out` and default transition curve point at the strong curves.
8. **D8** — The command palette does not animate.
9. **D9** — Reduced motion: movement at once; meaningful opacity and colour fades stay.
10. **D10** — Kept as they are: drawer exits, the shortcuts drawer, the search field's morph, constant motion.
11. **D11** — One script twin of the curves, pinned to `index.css`.
12. **D12** — Approved under the user's request; freezes with the first motion iteration.

## 3. Foundation

### 3.1 Theme

`:root` gains `--ease-in-out-strong`. `@theme` re-points `--ease-out`, `--ease-in-out` and
`--default-transition-timing-function` at the strong curves. The `@theme` animations read the
tokens: `accordion`, `fade-in`, `fade-in-up` (page rise), `dropdown-in/up`, `pop-in`, `reveal`,
`fade` → `--ease-out-strong`; the drawer, backdrop, bulk bar and sheet stay on `--ease-sheet`;
the phone lens → `--ease-in-out-strong`, 240ms.

### 3.2 Shell

The phone tab bar: lens 240ms on the strong ease-in-out, its slots' ink 240ms, its icons' press
95% at 160ms. The section bar: no change beyond the glide (row 2).

### 3.3 Stores · 3.4 Icons

None.

## 4. Unit map

| Unit                                                                                                                                 | Change                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `src/index.css`                                                                                                                      | the third curve; Tailwind's easings; keyframe curves; phone lens                                |
| `src/lib/animations/motion-curves.ts` (new) + test                                                                                   | the curves for scripts, pinned to `index.css`                                                   |
| `src/shared/components/SelectionGlide/` (+ css)                                                                                      | in-out 240ms; direct properties; ink in step; reduced-motion colour                             |
| `src/shared/components/RollingNumber/rolling-number.css`                                                                             | 240ms; reduced-motion crossfade                                                                 |
| `…/today/components/LanePanel/lane-panel.css`, `LaneTiles`                                                                           | 30ms × 4 cascade; reduced-motion fade; tiles' press                                             |
| `src/shared/components/ui/{tooltip,dropdown-menu,popover,hover-card,sheet,checkbox,switch,progress,accordion,input-otp}.tsx` (+ css) | strong ease-out, faster exits, instant tooltips, sheet timings, tick, switch, named transitions |
| `src/shared/components/CommandPalette/CommandPaletteShell.tsx`                                                                       | no open/close animation                                                                         |
| `src/lib/animations/useRefreshSettle.ts`, onboarding motion                                                                          | the script curves; settle kept under reduced motion                                             |
| `BugReport/bug-report.css`, `AuthShowcase/auth-showcase.css`, `RoomSearchField`                                                      | named curves (no timing change)                                                                 |
| `LeadDetailsPane` copy chip                                                                                                          | named transition properties                                                                     |

## 5. State management map

No state is added: every change is a stylesheet value, a class or a curve.

## 6. Build notes

- Easing by kind (STANDARDS › Easing): enter / leave / press → `--ease-out-strong`; travel →
  `--ease-in-out-strong`; drawers → `--ease-sheet`; colour → `ease`.
- The glide's ink: `[data-glide-covered]` transitions `color` 240ms on the strong ease-in-out — the
  newly selected label darkens with the thumb; the old one fades on its own 150ms (exit faster).
- Reduced motion (D9): each co-located stylesheet carries a `prefers-reduced-motion: reduce`
  block that swaps movement for an opacity / colour fade at 160ms, `!important` against the
  global reduce rule.
- `motion-stylesheets.test.ts` grows: the three curves, Tailwind's easings, no literal curve in
  app CSS, the glide on the in-out curve at 240ms, the reduced-motion blocks.

## 7. Verification

By Intake mode `brief`: each `BRIEF.md` criterion with its proof — the policy test, unit tests,
slow-motion recordings (0.25×) before and after, mid-motion stills, reduced-motion and keyboard
captures, and `pnpm size`.

## 8. The route — the ordered ledger

| #    | Work item                                                                                        | Kind       | Depends on | Skill/driver                        | Acceptance             | Assignee | Status |
| ---- | ------------------------------------------------------------------------------------------------ | ---------- | ---------- | ----------------------------------- | ---------------------- | -------- | ------ |
| L-1  | The three curves; Tailwind's easings; keyframes, bug report, sign-in dial, search field, scripts | global     | —          | emil-design-eng                     | criterion 1            | Claude   | done   |
| L-2  | Glides and the switch on the strong ease-in-out, 240ms; ink in step; direct properties           | structural | L-1        | emil-design-eng · review-animations | criterion 2            | Claude   | done   |
| L-3  | One press: lane tiles; phone tab icons 95% / 160ms                                               | styling    | L-1        | emil-design-eng                     | criterion 3            | Claude   | done   |
| L-4  | The command palette without animation                                                            | styling    | —          | review-animations                   | criterion 4            | Claude   | done   |
| L-5  | Instant follow-on tooltips; faster exits; strong entrances; the Sheet's timings                  | styling    | L-1        | shadcn · emil-design-eng            | criteria 5–6           | Claude   | done   |
| L-6  | Retune: roll 240ms, cascade 30ms × 4, tick from 90%                                              | styling    | L-1        | review-animations                   | criterion 7            | Claude   | done   |
| L-7  | Reduced motion: gentler, not zero                                                                | styling    | L-2, L-6   | emil-design-eng                     | criterion 8            | Claude   | done   |
| L-8  | No `transition-all`                                                                              | styling    | —          | review-animations                   | criterion 9            | Claude   | done   |
| L-9  | Docs: `design.md` §5 Motion; the policy test                                                     | copy       | L-1–L-8    | fe-documentation-maintenance        | `pnpm docs:lint`       | Claude   | done   |
| L-10 | Verify in the running app: slow motion before/after, stills, reduced motion, Ctrl+K              | verify     | L-1–L-9    | fe-kickoff-iteration                | every criterion proven | Claude   | done   |
| L-11 | Gates                                                                                            | gate       | L-10       | fe-before-commit-guard              | criterion 10           | Claude   | done   |
| L-12 | Close: `AS-BUILT.md`, Status `done`                                                              | verify     | L-11       | fe-kickoff-iteration                | README Status `done`   | Claude   | done   |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                              | In plan at |
| ---------------------- | ----------- | ---------- | ----------------------------------------------- | ---------- |
| `BRIEF.md`             | yes         | the change | nine changes, rules, ten criteria, out of scope | §2–§8      |
