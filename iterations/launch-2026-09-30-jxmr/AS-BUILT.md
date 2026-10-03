# launch-2026-09-30-jxmr — as built

What was actually built, ledger row by ledger row, against the approved plan in
[`KICKOFF.md`](KICKOFF.md) §9. Started 2026-10-03, when the re-planned iteration
moved to `implementing` (first opened 2026-10-01; the Oct 2 drop sent it back to
`planning` before any row was built). `fe-kickoff-iteration` adds one entry as
each row is built and verified.

## Rows

| #   | Ledger row | Planned                                              | Actually built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Difference                                                                                                                                                 | Why                                                                                                                                                                                                                                                         | Decision     | Commit |
| --- | ---------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------ |
| #1  | L-02       | Self-host Inter and JetBrains Mono (`@fontsource/*`) | `@fontsource/inter` and `@fontsource/jetbrains-mono` 5.3.0 (OFL-1.1); 12 `@font-face` rules in `src/index.css` — Inter 400 / 500 / 600 / 700, Mono 400 / 500, `latin` + `latin-ext` subsets, woff2 only; knip `ignoreDependencies`; font docs (`design.md`, `theming.md`, rule TY-1) and the `GENERATED_FONTS` label "Inter". Verified: 12 hashed same-origin woff2 in `dist/assets`; in the app Inter 400 / 500 / 600 load from :5173 and 0 requests reach googleapis / gstatic; `build:check` green; first-paint CSS 23.32 / 23.5 kB | Latin subsets only (the prototype's Google Fonts link serves every subset by `unicode-range`); the `body` `cv11` / `ss01` / −0.005em settings move to L-03 | fontsource's per-subset CSS files ship without `unicode-range`, so two of them would shadow each other — the faces are declared with fontsource's ranges instead. `latin-ext` carries ₹ (U+20B9). The feature settings are preset-scoped, not platform-wide | §7.2 (fonts) | —      |

## Revisions to upcoming rows

A built row that changes a row not yet built records the revised row text here;
the KICKOFF ledger row gets `revised → AS-BUILT #n` and nothing else.

| #   | Ledger row | Revised row | Decision |
| --- | ---------- | ----------- | -------- |

## Summary

Written when every ledger row is `done`, or `deferred` with the user's OK.

- **Planned, not built** (deferred, user OK): —
- **Built, not planned:** —
- **Follow-ups for the next iteration:** —

## Standing deviations

The complete list of where the code differs from the design. The launch has no Baseline, so the
list starts empty; a deviation is added when it is found and removed when an iteration resolves it.
The next iteration copies this list as its starting point.

| Item          | Design says                                                                        | Built as                                                                                                                      | Since iteration        | Decision |
| ------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------- |
| Font delivery | Google Fonts CDN, every Inter / JetBrains Mono subset (`preset.md:183`; H:193–194) | self-hosted `@fontsource`, Latin + Latin Extended subsets; Cyrillic, Greek and Vietnamese text falls back to the system stack | launch-2026-09-30-jxmr | §7.2     |
