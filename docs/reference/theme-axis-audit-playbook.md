# Theme axis audit playbook

> **Mandatory skill:** `agent-os/skills/fe-theme-axis-audit/SKILL.md`  
> **Mandatory rule:** `agent-os/rules/fe-theme-axis-audit.mdc`  
> Agents MUST read both before any axis cycle.

Repeatable process for making **every UI surface follow the design tokens and the axis
hooks in `src/index.css`**. Use this when context is fresh or after a long break — work
**one axis at a time**, same method we used for **corner radius + shape**.

> **Status (2026-10, L-65): the Appearance studio is retired.** The app wears one look,
> `clinozy-zinc-pastel`, in light or dark; nothing varies the axes at runtime any more, and
> each renders at the launch's default (`docs/reference/theming.md` → _The axes, at the
> launch's defaults_). The procedure still applies — a surface that bypasses a token is
> wrong under the one look too — but an axis's other values can only be previewed by
> setting its hook by hand in the browser's devtools (`data-shape="sharp"` on `<html>`,
> `data-elevation="flat"`, `--spacing: 0.215rem` …). The tracker and the history below are
> kept as the record of how the hooks were built.

**Source of truth:** `src/index.css` (`@theme`, the look's `[data-theme]` blocks, the
`[data-*]` axis blocks, `[data-slot='…']` selectors)  
**Runtime application:** `applyTheme()` (`src/shared/theme/presets.ts`) and the mode in
`useThemeStore` (`src/shared/store/useThemeStore/`)

---

## Status tracker (update as each axis is audited)

| #   | Axis                                      | Mechanism                                   | Audit status      |
| --- | ----------------------------------------- | ------------------------------------------- | ----------------- |
| 1   | **Corner radius** (`radiusId`)            | `--radius-sm/md/lg/xl` inline; rest derived | ✅ Done (2025-06) |
| 2   | **Shape language** (`shapeId`)            | `data-shape` + `[data-slot]`                | ✅ Done with #1   |
| 3   | **Elevation + separation**                | `data-elevation`, `data-separation`         | ✅ Done (2025-06) |
| 4   | **Focus ring** (`focusId`)                | `data-focus` + `data-slot`                  | ✅ Done (2025-06) |
| 5   | **Density** (`densityId`)                 | `--spacing`                                 | ✅ Done (2025-06) |
| 6   | **Motion** (`motionId`)                   | `--default-transition-*`                    | ✅ Done (2025-06) |
| 7   | **Contrast** (`contrastId`)               | `data-contrast`                             | ✅ Done (2025-06) |
| 8   | **Type scale** (`typeScaleId`)            | `--text-xs` … `--text-4xl`                  | ✅ Done (2025-06) |
| 9   | **Base colour** (`baseId`)                | `data-base`                                 | ✅ Done (2025-06) |
| 10  | **Menu style** (`menu`)                   | `data-menu`                                 | ✅ Done (2025-06) |
| 11  | **Accent / chart / intensity**            | inline OKLCH vars                           | ✅ Done (2025-06) |
| 12  | **Fonts** (`bodyFontId`, `headingFontId`) | `--font-sans`, `--font-heading`             | ✅ Done (2025-06) |
| 13  | **Icon weight** (`iconWeight`)            | `--icon-stroke`                             | ✅ Done (2025-06) |
| 14  | **Icon library** (`iconLibrary`)          | lazy icon chunks                            | ✅ Done (2025-06) |
| 15  | **Light/dark mode** (`theme`)             | `.dark` on `<html>`                         | ✅ Done (2025-06) |
| 16  | **Named presets** (`preset`)              | `data-theme`                                | ✅ Done (2025-06) |
| 17  | **Toasts** (one design since L-62)        | the bar on `primary` (sonner)               | ✅ Retired        |
| 18  | **Layout preview variants** (TEMP)        | — (retired 2026-10: one layout each)        | ✅ Retired        |

**All 18 axes audited.** Re-run a single axis by setting its row back to ⬜ Pending.

**Re-audit — Radius + shape (2026-06):** closed two consistency gaps so every interactive
surface follows the shape axis. (1) Wired the dropdown/select **interior** into the
`[data-shape='sharp']` block — `select-content`, `select-item`, `dropdown-menu-sub-content`,
and `dropdown-menu-{item,checkbox-item,radio-item,sub-trigger}` now go square with their
frame (previously only `dropdown-menu-content`/`popover-content` did, leaving rounded item
rows inside a square menu). (2) Added the missing `data-slot="button"` to dismiss/choice
controls that use `closeControlClassName`/chip styling but bypassed the `<Button>` primitive
(`InviteStep` remove, `InvitationsTable` revoke, `QuestionsStep` choice chip) — these now
reshape with `pill`/`mixed`/`sharp` instead of staying their hardcoded radius. Default
(uniform) look is unchanged; the fixes only engage under non-default shape settings.

**Re-audit — Radius + shape (2026-09): "square means square".** With radius **None** and
shape **Sharp** the dashboard hero, every badge, the avatar, the floating edge handle and
the settings modal were still round. Three separate causes, three systemic fixes:

1. **The radius scale had holes.** The axis sets `--radius-sm/md/lg/xl` inline, but
   `rounded-xs`, `rounded-2xl`, `rounded-3xl` and `rounded-4xl` resolved to Tailwind's
   _fixed_ defaults — so `rounded-2xl` kept a 16px corner under radius None. `index.css`
   now **derives** those four from `--radius-lg` (`calc(var(--radius-lg) * 2)` …). With the
   default `lg` of 0.5rem they equal the stock values exactly, so the default look did not
   move; pinned by `src/shared/theme/radius-shape-css.test.ts`.
2. **Two spellings are not token-backed at all** — a bare `rounded` and an arbitrary
   `rounded-[3px]`. Both are now rejected in app code by `pnpm validate:theme-axis`
   (check 5; `rounded-[var(--radius-*)]` and `calc()` over a token pass). Use a named step.
3. **Round-by-design elements had no way to follow Sharp.** `rounded-full` is a shape
   decision, not a radius one. The `[data-shape='sharp']` block now also squares the
   primitives that are round by design — `badge`, `avatar`(+`-fallback`), `checkbox`,
   `switch`(+`-thumb`), `progress`(+`-indicator`), `input-otp-slot`, `floating-edge`, `kbd`
   — and a new opt-in slot, **`data-slot="pill"`**, for app-level chips, count badges, icon
   discs and tracks. **Not** opted in, on purpose: status dots ≤ 10px and blurred glows —
   they are indicators, not surfaces. Off-scale surfaces that had no slot (`DashboardHero`,
   the bento panel) became `data-slot="card"`.

The boot splash follows too: `theme-init.js` sets `data-shape="sharp"` before first paint
and `index.html` squares the splash on it, so the HTML → React loader handoff does not
change shape half way through the boot (drift-tested in `locale-init.drift.test.ts`).
`SettingsModal` dropped an unconditional `rounded-none` (it is a sheet only below `sm`).

**Follow-up — measure, don't read (2026-09).** Grep found the class strings; it could not
find these, and a computed-style sweep in a browser did
(`tests/e2e/theme-shape.e2e.test.ts`, the Phase 3 step for radius/shape until it was retired with the studio in 2026-10):

- **`ui/carousel` re-slots its arrow `<Button>`s** (`data-slot="carousel-previous"` /
  `-next`), so the `button` rule stopped matching and the dashboard's highlight arrows
  stayed round. Both slots joined the Sharp list. _A vendored primitive that is round by
  design needs its own slot there — the `<Button>` inside it proves nothing._
- **`lib/animations` skeletons had no slot.** Only `ui/skeleton` did, and the dashboard,
  the members table and the shell load with the `lib` ones — a Sharp app painted round
  placeholders and snapped square. Both now carry `data-slot="skeleton"`.
- **Pseudo-element markers cannot carry a slot.** The active-route markers
  (`before:rounded-full` sidebar, `after:rounded-full` top nav) are squared through
  `[data-slot='nav-item']::before/::after`.
- The 16px palette swatches (`ThemeShowcase`) and the accent-toast preview bar became
  `pill`. The status-dot exemption stops at **10px**.

The gate grew **check 6** to hold the line: a `rounded-full` with no slot in reach fails
(`pnpm validate:theme-axis`). Writing the gate's own test
(`tooling/validate/theme-axis.test.mjs`) also showed that **check 3 had never fired**: its
pattern held a `'`, and `scan` builds its grep inside an `eval` that single-quotes the
pattern, so the quote closed the string early. It is fixed (`.` stands in for the quote) and
the icon barrel is allowlisted. A gate nobody has watched fail is a green checkmark.

---

## Config catalog — retired with the studio

The catalogs the studio offered (named presets, accent and chart hues, harmony,
intensity, base colours, menu styles, fonts, radii, shapes, type scales, density,
motion, elevation, contrast, separation, focus rings, icon weight / colour / library,
content widths) are gone from `src/shared/theme/presets.ts`. What renders is the
launch's default for each — the table in `docs/reference/theming.md` (_The axes, at the
launch's defaults_). The `[data-*]` blocks in `index.css` that implemented the other
values remain, so an audit can still set one by hand:

| Hook (on `<html>`) | Values the blocks implement                                   |
| ------------------ | ------------------------------------------------------------- |
| `data-shape`       | `mixed` · `pill` · `sharp` (default: none)                    |
| `data-elevation`   | `flat` · `soft` · `lifted` · `floating`                       |
| `data-contrast`    | `soft` · `crisp` · `dim` · `amoled` (dark)                    |
| `data-separation`  | `hairline` · `shadow`                                         |
| `data-focus`       | `glow` · `offset` · `underline` · `inset`                     |
| `data-menu`        | `translucent` · `glass`                                       |
| `data-base`        | `stone` · `slate` · `olive` · `zinc` · `warm`                 |
| `data-icon-color`  | `foreground` · `muted` · `primary` · `accent` · `destructive` |
| `--spacing`        | any rem (default 0.25rem)                                     |
| `--radius-lg`      | any rem (default 0.5rem; the scale derives from it)           |

### Layout shells (one design each)

One design per surface, no axis: the app shell is the section bar alone (the sidebar,
top-nav, rail and Focus previews and `appVariant` are gone), and the auth and public
layouts are the launch's signed-out canvas alone (`AuthLayout.tsx`, `PublicLayout.tsx`
— the Split / Spotlight / Minimal and Centered / Card / Brand previews,
`authVariant` / `publicVariant` and `SHUFFLE_TEMP` are gone, L-65).

`VITE_THEME_LOCK=true` pins the mode: no surface offers Light / Dark / System (the
Account menu's pills, the ⌘K theme rows and the signed-out toggle give way), and the
Appearance drawer's Mode card becomes the "managed by your organization" note.

---

## Standard audit procedure (per axis)

Copy this checklist for **each** axis. Do not skip steps.

### Phase 0 — Understand the axis

1. Read the axis's hook and its values in the _Config catalog_ above.
2. Find CSS hooks in `src/index.css` (`[data-*]` blocks or CSS vars).
3. Note which **`data-slot`** values the axis targets (if any).
4. In the browser's devtools, set the hook to its **most extreme** value (e.g. `data-shape="sharp"`, `data-elevation="flat"`, `--spacing: 0.215rem` on `<html>`).
5. Screenshot or mentally note: login, Today, settings modal, command palette, toast, tables.

### Phase 1 — Inventory violations

```bash
# Hardcoded Tailwind scale steps that bypass token vars (axis-specific — adjust pattern)
rg 'rounded-2xl|rounded-3xl' src --glob '*.tsx' --glob '!**/ui/**'

# Card-like surfaces without data-slot="card"
rg 'bg-card.*rounded|rounded.*bg-card|divide-y rounded' src --glob '*.tsx' --glob '!**/ui/**'

# Custom buttons/inputs (no data-slot)
rg '<button[^>]*rounded-' src --glob '*.tsx' --glob '!**/ui/**'

# Focus ring fights data-focus
rg 'focus-visible:ring|focus:ring' src --glob '*.tsx' --glob '!**/ui/**'

# List all data-slot usages vs what index.css targets for THIS axis
rg 'data-slot=' src --glob '*.tsx' | sort -u
```

Categorize each hit:

| Category                          | Fix                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| **A. Should be shadcn primitive** | Use `<Card>`, `<Button>`, `<Input>`, the shared `<Picker>`                            |
| **B. Needs existing slot**        | Add `data-slot="card" \| "button" \| "nav-item" \| …`                                 |
| **C. Fixed scale class**          | Replace `rounded-2xl` → `Card` or token class; remove skeleton `rounded-xl` overrides |
| **D. Intentional**                | `rounded-full` avatars, dots, progress pills — document exception                     |
| **E. System gap**                 | Extend `[data-*]` or `[data-slot]` rules in `index.css`                               |

### Phase 2 — Fix (priority order)

1. **Extend `index.css`** — add missing `[data-shape]`, `[data-elevation]`, etc. selectors for slots already in shadcn (`dialog-content`, `popover-content`, `surface`, …).
2. **Replace custom card shells** with `<Card>` + `<CardContent>` (auth/public layouts, settings lists, dashboard tiles).
3. **Replace raw `<button>` / `<a>` chrome** with `<Button>` or `data-slot="button"`.
4. **Replace raw inputs/selects** with shadcn or `data-slot="input"` / `select-trigger"`.
5. **Add shared helpers** only when repeated 3+ times (e.g. `iconChipClassName`, `themeChoiceButtonClassName`, `focusControlClassName` in `src/lib/icon-surface.ts`).
6. **Remove className overrides** on `<Skeleton>` that fight the axis (`rounded-lg`, `rounded-xl`).

### Phase 3 — Verify

```bash
pnpm type-check
pnpm eslint --fix <changed-files>
pnpm test -- --run <colocated-tests-for-touched-components>
```

Measure, don't eyeball: with the hook set by hand, sweep the computed style the axis
drives (e.g. `getComputedStyle(el).borderRadius` over every painted element under
`data-shape="sharp"` and `--radius-lg: 0`). The Playwright sweep that did this from a
seeded look was retired with the studio that could seed one.

Manual: set the hook across **all its values** on:

- `/login` (public card layout)
- `/organization/acme/today` (Today — the role home for most roles)
- Settings drawer (`#settings/account/profile`)
- Command palette (⌘K)
- A toast (any save)

### Phase 4 — Record

1. Update **Status tracker** table at top of this file.
2. If new slots or helpers were added, add one line to `docs/reference/theming.md` → “Axis hooks”.

---

## Helpers introduced by the audit

| Helper                         | File                                                               | Pair with                                   |
| ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------- |
| `iconChipClassName`            | `src/lib/icon-surface.ts`                                          | `data-slot="icon-chip"`                     |
| `closeControlClassName`        | `src/lib/icon-surface.ts`                                          | `data-slot="button"` (dismiss controls)     |
| `focusControlClassName`        | `src/lib/icon-surface.ts`                                          | `data-slot="button"` (no hardcoded rings)   |
| `themeChoiceButtonClassName`   | `src/lib/icon-surface.ts`                                          | `data-slot="button"` (Appearance pickers)   |
| `data-slot="floating-edge"`    | floating edge buttons                                              | `[data-elevation]`, `[data-shape]`          |
| `data-slot="pill"`             | chips, count badges, icon discs, tracks (`rounded-full` by design) | `[data-shape='sharp']` squares it           |
| `data-slot="kbd"`              | keyboard-hint `<kbd>`                                              | radius + shape axes                         |
| `data-floating` on a `surface` | a non-modal surface pinned over the page (consent card)            | default lift; `[data-elevation]` still wins |
| `data-slot="menu-item"`        | notification rows, command items                                   | focus + shape axes                          |
| `data-surface="light-pinned"`  | panels that stay light in dark mode (bulk bar, photo viewer)       | the Clinozy preset's dark block             |

---

## Quick grep cheatsheet by axis

| Axis       | Grep / inspect                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Radius     | bare `rounded`, `rounded-[…px]` (gate check 5); any named step is fine                                                                             |
| Shape      | `rounded-full` with no slot in reach (gate check 6); a vendored primitive that re-slots a `<Button>`; `rounded-none` that is not breakpoint-scoped |
| Elevation  | custom `shadow-lg`, `shadow-none` on `[data-slot='card']`                                                                                          |
| Separation | custom `border-2` on cards                                                                                                                         |
| Density    | hardcoded pixel padding (`p-[13px]`), fixed heights bypassing scale                                                                                |
| Motion     | `duration-\d+`, `ease-` on app components (not animations)                                                                                         |
| Contrast   | raw greys, `text-white`, `bg-black`                                                                                                                |
| Focus      | `focus-visible:ring` on app code outside `ui/`                                                                                                     |
| Type scale | `text-[15px]`, arbitrary font sizes                                                                                                                |
| Base       | non-semantic surface colours                                                                                                                       |
| Menu       | popover/dropdown without blur when `data-menu=translucent\|glass`                                                                                  |
| Fonts      | `h1`–`h6` use `var(--font-heading)` in `@layer base`                                                                                               |
| Icons      | direct `lucide-react` imports outside `ui/`                                                                                                        |

---

## Agent handoff prompt (paste when re-auditing one axis)

```text
Theme axis audit — axis: <NAME> (e.g. elevation)

Follow docs/reference/theme-axis-audit-playbook.md exactly:
- Phase 0–4, update status tracker when done
- Extend index.css [data-*] / [data-slot] if needed
- Prefer <Card>/<Button>/shadcn over hardcoded rounded/shadow/spacing
- Run tsc, eslint --fix on touched files, colocated tests
- Do not ask for confirmation; complete full axis in one pass
```
