# Preset — the empty state's tones and anatomy

No new color value. The empty states use the app's existing tone tokens (`--color-tone-<tone>`,
`-foreground`, `-border`, `-dot`), which already have light and dark values. The theme preset, fonts,
radius and shape axes are unchanged; every rounded corner uses a named radius step, and every full
circle is a decorative dot or ring.

## Tones

| Tone   | Fill (`tone`)          | Ink (`-foreground`)     | Border (`-border`)     | Dot (`-dot`)           | Accents (dots) |
| ------ | ---------------------- | ----------------------- | ---------------------- | ---------------------- | -------------- |
| butter | oklch(0.935 0.06 85)   | oklch(0.38 0.085 65)    | oklch(0.85 0.08 80)    | oklch(0.74 0.11 75)    | peach · sky    |
| lav    | oklch(0.925 0.045 295) | oklch(0.37 0.09 295)    | oklch(0.83 0.06 295)   | oklch(0.68 0.1 295)    | plum · sky     |
| sky    | oklch(0.925 0.04 235)  | oklch(0.37 0.08 235)    | oklch(0.83 0.055 235)  | oklch(0.68 0.09 235)   | mint · lav     |
| sage   | oklch(0.925 0.045 150) | oklch(0.37 0.08 150)    | oklch(0.83 0.06 150)   | oklch(0.66 0.1 150)    | lime · sky     |
| blush  | oklch(0.925 0.04 20)   | oklch(0.38 0.1 20)      | oklch(0.83 0.06 20)    | oklch(0.68 0.1 20)     | peach · lav    |
| mint   | oklch(0.93 0.04 190)   | oklch(0.37 0.07 195)    | oklch(0.83 0.055 190)  | oklch(0.68 0.08 190)   | sky · lime     |
| peach  | oklch(0.93 0.045 55)   | oklch(0.4 0.1 50)       | oklch(0.84 0.07 55)    | oklch(0.72 0.12 55)    | butter · blush |
| plum   | oklch(0.925 0.04 330)  | oklch(0.38 0.1 330)     | oklch(0.83 0.06 330)   | oklch(0.68 0.1 330)    | lav · blush    |
| lime   | oklch(0.935 0.055 120) | oklch(0.38 0.08 125)    | oklch(0.85 0.07 120)   | oklch(0.72 0.11 120)   | sage · butter  |
| slate  | oklch(0.925 0.02 255)  | oklch(0.37 0.04 255)    | oklch(0.83 0.03 255)   | oklch(0.66 0.05 255)   | sky · lav      |
| stone  | the neutral muted set  | `foreground-soft`       | `border`               | `border-strong`        | sky · peach    |

Light values above; the dark values are the existing dark tone tokens. Every accent pair is two other
tones, so each illustration carries three colors.

## The room look — anatomy (112px)

| Layer        | Box                                         | Paint                                                              |
| ------------ | ------------------------------------------- | ------------------------------------------------------------------ |
| Ring         | 112px circle                                | 1.5px **dashed** border in the tone's border                       |
| Disc         | inset 14px (84px circle)                    | the tone's fill                                                    |
| Tile         | 48px, radius `2xl`, centered                | gradient bottom-right from the tone's dot to its ink; small shadow |
| Icon         | 22px, stroke 2, in the tile                 | the page background (knocked out of the tile)                      |
| Dot one      | 10px, top 12px, end 10px                    | the tone's dot                                                     |
| Dot two      | 7px, bottom 16px, start 8px                 | the first accent's dot                                             |
| Dot three    | 5px, top 8px, start 18px                    | the second accent's dot                                            |
| Title        | 14px gap below the art; `title` size, 600   | foreground                                                         |
| Line         | 10px below; `detail` size, max 320px        | muted foreground                                                   |
| Action       | 16px below; 36px primary button             | as today                                                           |

Was: a neutral grey dashed ring, a 68px disc, a white 40px tile with the icon in the tone's ink, one
tone dot and one grey dot — 64px from the top of the list.

## The compact look — anatomy (56px)

| Layer   | Box                                 | Paint                                      |
| ------- | ----------------------------------- | ------------------------------------------ |
| Ring    | 56px circle                         | 1.5px dashed, the tone's border            |
| Disc    | inset 6px (44px)                    | the tone's fill                            |
| Tile    | 32px, radius `lg`                   | the same gradient as the room look         |
| Icon    | 16px                                | the page background                        |
| Dot     | 7px, top 2px, end 2px               | the first accent's dot                     |
| Title   | 8px below; `body` size, 500         | soft foreground                            |
| Line    | `xs`, muted, optional               |                                            |
| Action  | 8px below, optional                 |                                            |

## The thread card

The chat column's dashed starter card keeps its shape and chips and gains the compact art (without
its ring) above its title.
