# Paste this to Claude Design

Fill in the 6 lines under **MY PRODUCT**. Leave everything else exactly as-is.

---

You are producing a theme preset for an existing React app.

**Return exactly ONE markdown file and nothing else** — no prose before or after
it, no JSON, no second file. The file is named `preset.md` and it holds the
**entire** preset: axes, tokens, contrast, and notes. Everything must live inside
this one markdown file — do not leave anything out and do not split it.

Output it in a single fenced block, prefixed with its filename:

````markdown
**`preset.md`**

```markdown
<contents>
```
````

## MY PRODUCT

- Name: `<product name>`
- Brand color: `<#hex, or "none — you choose">`
- What it does: `<one sentence>`
- Who uses it: `<one sentence — role and setting>`
- Content density: `<data-dense | spacious | mixed>`
- Feel: `<3 adjectives, e.g. "calm, clinical, precise">`

## HARD CONSTRAINTS

1. **Every axis value must be chosen from the enums below.** These are closed lists. An unlisted value (e.g. "bouncy", "slightly rounded") is unusable — it maps to nothing.
2. **All colors in OKLCH**: `oklch(L C H)`, L∈0..1, C∈0..0.4, H∈0..360. No hex, rgb, or hsl in token values. (Note the source hex alongside in a comment if the brand mandates one.)
3. **Provide both light and dark.** A single-mode design is incomplete — every token table has a Light and a Dark column.
4. **Every text pair must meet WCAG AA 4.5:1.** Compute the ratio and report it in the Contrast table. If my brand color fails (most saturated brand colors do — they land near 3.5:1 on white), do **not** silently ship it: keep the true brand color for non-text tokens (`ring`, `chart-1`) and use a darkened variant for anything with text on it. Say so in **Notes**.
5. **Do not invent token names.** Use only the token names shown in the Colour tokens table.
6. If you can't satisfy something, state it in **Notes** rather than approximating.
7. **Fill every row — remove nothing.** Every axis and every token row must carry
   a value (or a dash only where the rule above allows). Do not delete a row, do
   not leave a cell blank, do not collapse the tables. A missing row reads as a
   detail lost during development.

## AXIS ENUMS (closed lists — pick one value from each)

```text
accentColor  rose | orange | amber | lime | emerald | teal | blue | violet | pink
baseColor    neutral | stone | slate | olive | zinc | warm
harmony      monochromatic | analogous | complementary | split | triadic
intensity    subtle | muted | balanced | vibrant | max
contrast     normal | soft | crisp | dim | amoled
density      compact | cozy | relaxed | airy
typeScale    tight | compact | default | grand | display
headingFont  inter | grotesk | geometric | humanist | serif | slab | mono
bodyFont     inter | grotesk | geometric | humanist | serif | slab | mono
radius       sharp | default | rounded | round
shape        uniform | mixed | pill | sharp
elevation    flat | soft | lifted | floating
separation   border | hairline | shadow
focus        ring | glow | offset | underline | inset
motion       instant | calm | smooth | snappy
menu         default | translucent | glass
iconLibrary  lucide | tabler | phosphor
iconWeight   thin | regular | bold
layoutWidth  contained | full | reading
```

## RETURN EXACTLY THIS FILE — `preset.md`

```markdown
# Preset: <Display Name>

- Id: <kebab-case-id>
- Scope: <accent-only | full-surface>
- Rationale: <1-3 sentences on why this look fits the product>

## Axes

| Axis        | Value |
| ----------- | ----- |
| accentColor |       |
| baseColor   |       |
| harmony     |       |
| intensity   |       |
| contrast    |       |
| density     |       |
| typeScale   |       |
| headingFont |       |
| bodyFont    |       |
| radius      |       |
| shape       |       |
| elevation   |       |
| separation  |       |
| focus       |       |
| motion      |       |
| menu        |       |
| iconLibrary |       |
| iconWeight  |       |
| layoutWidth |       |

## Colour tokens

Values in OKLCH (`oklch(L C H)`). Note the source hex in a trailing comment if the
brand mandates one. Include the whole table — omit no row.

| Token              | Light | Dark |
| ------------------ | ----- | ---- |
| primary            |       |      |
| primary-foreground |       |      |
| accent             |       |      |
| accent-foreground  |       |      |
| ring               |       |      |
| chart-1            |       |      |
| chart-2            |       |      |
| chart-3            |       |      |
| chart-4            |       |      |
| chart-5            |       |      |

> Tokens may be left as `—` only if the `Axes` selections fully express the design
> (the app generates a palette from them). Fill exact values whenever brand colour
> matters.

## Contrast (WCAG AA 4.5:1)

| Pair                         | Mode  | Resolved hex       | Ratio | Passes AA? |
| ---------------------------- | ----- | ------------------ | ----- | ---------- |
| primary / primary-foreground | light | #______ on #______ |       |            |
| primary / primary-foreground | dark  | #______ on #______ |       |            |
| accent / accent-foreground   | light | #______ on #______ |       |            |
| accent / accent-foreground   | dark  | #______ on #______ |       |            |

**Non-text exemptions.** For any token kept at the true brand value because it
carries no text (typically `ring`, `chart-1`), name it and say why it is exempt
from 4.5:1.

## Notes

Unmet constraints, brand compromises, deliberate omissions. If nothing, write `none`.
```

Notes on the shape:

- `Scope`: use `accent-only` unless the design genuinely needs new background/surface colors. Accent-only is safer and composes with the existing light/dark surfaces.
- The `Colour tokens` table may be left as dashes if the `Axes` selections fully express the design — the app generates a palette from them. Fill exact values when brand color matters.

---

## When it comes back

Save `preset.md` into the drop folder with the rest of the drop and place it with `pnpm iteration:intake <iteration> <drop-folder>`; the iteration's plan applies the preset before any screen. (A preset on its own can still be pasted to me with **"apply this preset"**.)

I'll write the CSS blocks, register it in the three places that need to agree
(`presets.ts`, `index.css`, `public/theme-init.js`), re-verify every contrast
ratio independently, and run `pnpm validate:tokens && pnpm validate:theme-axis`.

Don't trust the ratios in the response — models routinely miscalculate WCAG
contrast. I recompute them from the OKLCH values before anything ships.
