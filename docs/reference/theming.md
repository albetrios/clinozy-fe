# Theming

The app is themed entirely through CSS custom properties (design tokens) declared
with Tailwind v4's `@theme` directive in `src/index.css`. Every component uses
**semantic tokens** (`bg-background`, `text-primary`, `border-border`, …) and
never raw palette classes — `pnpm validate:tokens` enforces this. A new theme is
therefore just a different set of token values; no component changes.

## shadcn-create compatible

A theme exported from [ui.shadcn.com/create](https://ui.shadcn.com/create) (or
the shadcn theme editors) is a block of CSS variables. Our token set is a
**superset** of shadcn's, with one naming difference: shadcn emits bare
`--background` / `--primary` / `--radius`, while our `@theme` uses the `--color-`
prefix (`--color-background`, `--color-primary`) and `--radius-{sm,md,lg,xl}`.

### Adopting a generated theme

1. Generate/copy the theme (its `:root { … }` light block + `.dark { … }` block).
2. Map names — prefix the color vars with `--color-`:

   | shadcn-create                                | this app                                            |
   | -------------------------------------------- | --------------------------------------------------- |
   | `--background` / `--foreground`              | `--color-background` / `--color-foreground`         |
   | `--primary` / `--primary-foreground`         | `--color-primary` / `--color-primary-foreground`    |
   | `--secondary*` `--muted*` `--accent*`        | `--color-secondary*` `--color-muted*` …             |
   | `--destructive` / `--destructive-foreground` | `--color-destructive*`                              |
   | `--card*` / `--popover*`                     | `--color-card*` / `--color-popover*`                |
   | `--border` / `--input` / `--ring`            | `--color-border` / `--color-input` / `--color-ring` |
   | `--sidebar*` (incl. `--sidebar-primary*`)    | `--color-sidebar*`                                  |
   | `--chart-1` … `--chart-5`                    | `--color-chart-1` … `--color-chart-5`               |
   | `--radius`                                   | `--radius-lg` (sm/md/xl derive around it)           |

3. Paste the mapped values into the `@theme` block (light) and the `.dark`
   override in `src/index.css`. Keep OKLCH — the generators emit it and it is the
   project's color space.
4. Run `pnpm validate:tokens` and do a visual pass in both light and dark.

The app's extra semantic tokens — `success` / `warning` / `info` (+ foregrounds),
`brand`, `overlay` — have no shadcn equivalent; pick values that fit the palette.

## The one look, and the mode

The app wears **one look** — the launch's **Clinozy Zinc Pastel** — in two modes. The
look is the `[data-theme='clinozy-zinc-pastel']` blocks in `src/index.css` over the base
`@theme` tokens; the mode is the `.dark` class. They are independent: the mode is the
user's (Light · Dark · System, from the Account menu's pills, the Appearance drawer's
Mode card and the signed-out header's toggle), the look is not.

There is no theme studio any more (the design has none). The named presets (Classic,
Violet, Emerald, Rose, Ocean), the generated looks and their shareable codes, Shuffle,
and the per-axis pickers — accent and chart colour, base colour, harmony, intensity,
fonts, radius, shape language, type scale, density, menu style, icon weight, colour and
library, content width — were retired with it. The Appearance drawer keeps the mode
and the device's language, text direction, date-time and number preferences.

- **`src/shared/theme/presets.ts`** — `THEME_ID` (`clinozy-zinc-pastel`) and
  `applyTheme()`, which puts `data-theme` on `<html>`.
- **`src/shared/store/useThemeStore/`** — the mode alone, persisted on the device
  (`theme-preference`). Persist **v8** retires the studio: the migration keeps the mode
  and drops every field an earlier build saved (preset, generated look and seed, base
  colour, menu, icon axes, content width), so no old value can reach the page; a mode
  outside the three falls back to light. It also clears the old `theme-boot-vars`
  snapshot.
- **`public/theme-init.js`** — before first paint it sets `data-theme` (ahead of its
  `try`, so a storage error cannot cost the page its look) and `.dark` from the saved
  mode.
- **Layout width** — `full`, the launch's (`LAUNCH_LAYOUT_WIDTH` in
  `src/shared/theme/layout-width.ts`); a deployment can still force `contained` or
  `reading` with `VITE_LAYOUT_WIDTH`.
- **`VITE_THEME_LOCK`** — pins the mode: the Account menu's Light / Dark / System
  pills, the ⌘K menu's theme rows and the signed-out pages' theme toggle give way, and
  the Appearance drawer shows the "managed by your organization" note in place of its
  Mode card.

### No palette is written inline

`public/theme-init.js` writes **no inline custom property**, and neither does the
bundle. An inline token outranks both `:root` and `.dark`, so one left on `<html>` pins
its colour to the mode the document booted in: a later mode switch then moves only the
tokens it does not cover — black text on a black card, a light card on a black page —
until a reload. The splash paints from `index.html`'s zero-specificity `:where(html)`
fallbacks (the look's own values) and the stylesheet's blocks once it has loaded.
`src/lib/i18n/locale-init.drift.test.ts` pins both halves of the boot script's contract.

## The look: Clinozy Zinc Pastel

A fresh install starts in **light** mode. Toasts are not part of the look: every toast
is the design's bar, bottom-centre (`shared/notify/ToastBar.tsx`).

It is **full-surface**: its `[data-theme]` block sets every surface token and sits after
the base-colour blocks, so a `data-base` tint does not reach it. Dark is `@media screen`
only — printing always uses the light tokens.
Inside it, `[data-surface='light-pinned']` keeps a panel on the light ramp in dark mode
(the bulk-actions bar, the photo viewer and its captions), with primary one step softer.

Tokens the clinic screens add — all base-level (light values in `@theme`, dark in
`.dark`; the Clinozy block sets its own neutral steps):

| Group         | Tokens                                                                                                                                                                                                                           | Use                                                                                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neutral steps | `canvas`, `muted-strong`, `border-strong`, `disabled`, `muted-foreground-strong`, `foreground-soft`                                                                                                                              | page tint under cards; skeleton / focus fill; strong border; disabled text; **text on `muted`** (never `muted-foreground` there — 4.40:1); body one step down                                                                                   |
| Accents       | `brand-mark`, `brand-mark-strong`, `destructive-tint`, `destructive-border`, `highlight`, `assist`, `success-strong`, `now-indicator`, `presence-online`                                                                         | logo (non-text only); danger wash and border; search match; the AI "Suggest" accent; "Read" / trend up; calendar now-line; online dot                                                                                                           |
| Channels      | `channel-whatsapp`, `channel-call`, `channel-note`, `channel-instagram` (+ `-tint`, `-foreground` where the design has them)                                                                                                     | chat channels; the Instagram values are raised to AA                                                                                                                                                                                            |
| Section tones | `tone-<butter · lav · sky · sage · blush · mint · peach · plum · lime · slate>` + `-foreground` (ink), `-border` (line), `-dot`, `-edge` (ink mixed into the dot); `-tint` on sage, butter and lav; `tone-stone` is the fallback | one per clinic room: text in ink on the tone; selected = ink fill with `background` text; a **picked badge** = a 1.5px `-edge` + a 3px `-dot` halo (`TONE_CLASSES.selected`), never an ink outline; dots are decorative (always beside a label) |

`-edge` is derived in `@theme inline` — `color-mix(in oklab, <ink> var(--tone-edge-ink), <dot>)`,
45% ink in light and 15% in `.dark` (stone: `foreground-soft` 55% with `border-strong`) — so
it follows dark mode and every preset, and holds 3:1 against the card and its chip in both
(`src/shared/theme/tone-edge-css.test.ts`; iteration `change-shell-polish-and-sign-in`).

In this look `warning` and `info` are **pairs** — a pale fill with an ink
(`-foreground`). Text or an icon on its own uses the ink or a tone dot, never the fill.
`src/shared/theme/preset-contrast.test.ts` recomputes every pair's WCAG ratio from the
stylesheet in light, dark and the light-pinned scope.

Also in `index.css`: the clinic **text steps** `text-tiny` · `text-micro` ·
`text-caption` · `text-detail` · `text-body` · `text-field` · `text-title` ·
`text-greeting` · `text-stat` · `text-display` (10.5 → 32px, derived from the stock
steps); the design's **motion** as
`animate-dropdown-in`, `-dropdown-up`, `-drawer-in`, `-backdrop-in`, `-pop-in`,
`-bulk-in`, `-reveal`, `-fade`, `-spinner`, `-sheet-up`; and the **room metrics** by
tier — compact by default, comfortable at ≥ 1440 × 800, the phone column below `md`
(`--room-toolbar-pad`, `--table-pad-x`, `--drawer-header-height`, …), read as
`p-(--room-toolbar-pad)`. Theme values are tree-shaken until a utility uses them, so
write tone classes as whole literals (a `TONE_CLASSES` map), never `bg-tone-${tone}`.

## Icons

Every app icon flows through the `@/shared/icons` barrel (eslint-enforced — see
`eslint.config.mjs`): each export is the Lucide glyph under the app's name for it, so
the app names its icons in one file. Lucide is statically imported and tree-shaken (only
the icons the app uses ship). The three brand marks (GitHub, Instagram, WhatsApp) are
drawn locally and carry the `lucide` class, so the icon rules reach them. Vendored
shadcn primitives (`components/ui`) import Lucide directly. The Tabler and Phosphor sets
that once swapped in at runtime are gone with the Appearance studio.

The stroke is the look's thin **1.5** (`svg.lucide { stroke-width: var(--icon-stroke, 1.5) }`
in `index.css`).

## Theme axis audit playbook

The axes the studio used to vary still live in `index.css`, at the launch's defaults,
and components still have to follow them — a named radius step rather than
`rounded-[3px]`, a `data-slot` on a surface, no hardcoded shadow. The repeatable
procedure is **[theme-axis-audit-playbook.md](theme-axis-audit-playbook.md)**.

**Agents:** read **`agent-os/skills/fe-theme-axis-audit/SKILL.md`** and
**`agent-os/rules/fe-theme-axis-audit.mdc`** before any axis cycle (one axis per cycle,
detailed report required).

**Product-design floors (typography, density, touch, motion):**
**[preset-product-design-rules.md](preset-product-design-rules.md)** — industry-backed
rules for the look; **`agent-os/rules/fe-preset-product-design.mdc`** for agents.

## The axes, at the launch's defaults

Nothing sets these at runtime any more; each renders at its default.

| Axis         | Implemented as                            | The launch's value                             |
| ------------ | ----------------------------------------- | ---------------------------------------------- |
| Look         | `data-theme` (`theme-init.js`, store)     | `clinozy-zinc-pastel`                          |
| Mode         | `.dark` class / store `theme`             | the user's: light (default), dark or system    |
| Radius       | `--radius-*` (`rounded-xs` … `4xl`)       | `--radius-lg` 0.5rem; every other step derives |
| Shape        | `[data-shape]` blocks                     | uniform (no attribute)                         |
| Elevation    | `--elevation-*` / `[data-elevation]`      | the look's shadows (no attribute)              |
| Contrast     | `[data-contrast]` blocks                  | normal (no attribute)                          |
| Separation   | `[data-separation]` blocks                | border (no attribute)                          |
| Density      | `--spacing`                               | Tailwind's 0.25rem                             |
| Motion       | `--default-transition-*`                  | Tailwind's defaults                            |
| Focus ring   | `[data-focus]` blocks                     | ring (no attribute)                            |
| Menu surface | `[data-menu]` blocks                      | default (no attribute)                         |
| Icons        | `svg.lucide` / `--icon-stroke`            | Lucide, stroke 1.5, `currentColor`             |
| Layout width | `data-layout-width` / `VITE_LAYOUT_WIDTH` | full, unless the deployment forces another     |

`pnpm validate:theme-catalog` keeps these docs on the one look — and off the retired
studio (assertions in `src/shared/theme/catalog-doc.ts`).

## Compliance gate

`pnpm validate:theme-axis` scans app code (excluding vendored `ui/` and tests) for:

- Hardcoded Tailwind shadows (`shadow-sm` … `shadow-2xl`)
- Hardcoded focus rings (`focus-visible:ring`, `focus:ring`)
- Direct `lucide-react` imports outside the icon barrel
- `bg-card` / `bg-popover` without a nearby `data-slot=` marker (a class on a `<Button>`
  passes: the button brings `data-slot="button"`)
- **Off-scale corner radius** — a bare `rounded`, or an arbitrary `rounded-[3px]`.
  Neither follows the radius scale. Every _named_ step does (`rounded-xs` …
  `rounded-4xl`: `sm/md/lg/xl` are tokens, the rest derive from `--radius-lg` in
  `index.css`), and so does `rounded-[var(--radius-*)]`.

- **`rounded-full` the Sharp shape cannot reach** — `rounded-full` is a **shape**
  decision rather than a radius one, so the element needs a slot the
  `[data-shape='sharp']` list squares: its own `data-slot=` within 5 lines above
  (usually **`data-slot="pill"`** — chip, count badge, icon disc, track, swatch), or a
  primitive that brings one (`<Button>`, `<Avatar>`, `<Skeleton>`).
  **Exempt, because they are indicators and not surfaces:** status dots of at most 10px
  (`size-2.5`, `h-2 w-2`), blurred glows, the `animate-ping` halo, and pseudo-element
  markers (`before:rounded-full` — squared in `index.css` through the `nav-item` that
  draws them).

- **Fixed-size spacing** — a padding / margin / gap written as a literal (`p-[24px]`,
  `gap-[0.5rem]`). Every scale step is `calc(var(--spacing) * n)`, so `p-6` follows the
  `--spacing` token and `p-[24px]` — pixel-identical today — silently ignores it.
  `[var(--…)]` and `[calc(…)]` pass; sizes and offsets (`h-[640px]`, `top-[20%]`) are not
  spacing and are not checked.

**One inset for every pane.** A `RecordDrawer` pads its body with `--drawer-body-pad`. A
drawer that opts out to lay out its own panes (`flushBody` — the Settings drawer) has to put
one step back on **each** pane — search box, nav and content are all `6` there, and the
phone's section picker starts on the content's `4` gutter.

Two traps the slot model has, both found by measuring rather than reading:

- **A vendored primitive can re-slot a `<Button>`.** `ui/carousel` (removed with the old
  dashboard, L-63) rendered its arrows as `<Button data-slot="carousel-previous">`, so the
  `button` rule no longer matched them. A primitive that is round by design needs **its
  own** slot in the Sharp list.
- **A placeholder needs the corners of the thing it stands in for.** `lib/animations`
  ships the skeletons the shell actually loads with; both carry
  `data-slot="skeleton"` like `ui/skeleton`, or a Sharp app paints round and snaps square.

Allowlisted exceptions live in `tooling/validate/theme-axis-allowlist.txt` — prefer a
class **fragment** over a file name: a fragment exempts one line from one check, a file
name exempts the whole file from every check. The gate runs in `pnpm health` (phase 8b)
after `validate:tokens`, and in the PR `static-sync` job. It is itself under test —
`tooling/validate/theme-axis.test.mjs` runs it against fixture trees (every violating
spelling, every allowed one) via `pnpm test:github-scripts`.

**The gate reads class strings.** The browser sweep that measured corners under radius
None + shape Sharp was retired with the studio that could set them; the unit suite still
pins the stylesheet's radius scale and Sharp list (`src/shared/theme/radius-shape-css.test.ts`).

**Catalog doc sync:** `pnpm validate:theme-catalog` keeps `design.md`, `theming.md` and
the playbook on the one look and off the retired studio (assertions in
`catalog-doc.ts`). Runs in the same health phase and PR `static-sync` job.

## Readability & route motion

These rules prevent “invisible UI” when themes or motion settings change:

| Rule                                                                   | Where enforced                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `text-card-foreground` on card surfaces                                | `Card` primitive + custom card markup                          |
| Minimum `text-xs` for product labels/hints                             | `agent-os/rules/fe-tailwind-styling.mdc`, `design.md` §2       |
| Page transitions use **transform-only** `route-rise` (no opacity fade) | `src/index.css` (`--animate-fade-in-up`), `PageTransition.tsx` |

Do not add opacity-based entrance animations to layout outlets or `PageTransition` —
`animation-fill-mode: both` can leave primary copy at `opacity: 0` when reduced
motion zeroes duration. See `design.md` §5 Motion.
