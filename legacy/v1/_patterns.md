# Shared patterns (referenced by every screen file)

## Right drawer (every form, confirm, detail view)

| Field           | Value                                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shape (desktop) | side drawer, right edge, full height                                                                                                                                                                                                              |
| Shape (mobile)  | side drawer, `min(<w>px, calc(100vw - 56px))`                                                                                                                                                                                                     |
| Size            | 560 (light forms ≤ 8 fields) · 680 default · 840 item tables · 1040 Prescription / Day close; askDel 480                                                                                                                                          |
| Dismiss         | overlay click, Esc, floating × (czpop), footer Discard                                                                                                                                                                                            |
| Header          | 76px, plain white + hairline: title 600, sub line, tag pill; × floats outside the left edge                                                                                                                                                       |
| Footer          | left: "Not saved · your changes are kept" (red, only after a failed save); right: "Discard" (outline) · primary "Save" / "Create …" (disabled until dirty; "Saving…" while pending; "Retry save" after failure). Child drawer footer reads "Back" |
| Multi-step      | yes — step cards (accordion), one open at a time, "Next: <step>" button ends each step                                                                                                                                                            |
| Initial focus   | first empty required field of the open step                                                                                                                                                                                                       |

Body padding 20px 24px 28px; header 16px 24px; footer 12px 24px. Form grid 6 columns: full (textarea, uploads, item tables, big chip groups) · half (names, pickers) · third (numbers, mobile, dates, codes ≤ 16 chars). Last field in a row stretches to fill.

Step card: numbered circle 22px (green oklch(0.52 0.12 150) when filled, #18181b when open, #e4e4e7 otherwise; open step uses the section tone) + title + hint. Collapsed = peek grid (uppercase 11px label + 2-line value, empty = dashed "Empty"; "Missing: …" in red). Padding 14px 16px (12px 14px compact).

## Delete confirm (askDel)

480px right drawer, role alertdialog, z 180. Title "Delete this <record type>?" (never the record name); record shown as grey pill under title; one-line effect; reason chips "Created by mistake" · "Duplicate" · "No longer needed" · "Other" (note required for Other); footer "Keep it" + red action (disabled until a reason). After confirm: toast with "Undo".

## Dropdown (dd) — the only picker

Floating popover (czddin 160ms), never pushes layout; flips up (czddup) when no space. Trigger heights sm 32 / md 36 / lg 44. Search shown for dynamic data always, static lists > 7 options; dynamic search = 250ms debounce + skeleton rows. Row: leading 10px tone dot / 24px tinted icon tile / avatar · label + sub · meta · check at far right. "Recent" group (last 3) for lists > 7. Missing name → "Add ‘query’"; full create → "＋ New <thing> · “query” — full details" opens a stacked child drawer. Keys ↑↓ PgUp/PgDn Home/End ↵ Esc. Mobile: same popover, capped to viewport.

## Table (mkTable)

| Field            | Value                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header           | sticky, uppercase 11px, outside the scroller, sortable (Lucide `arrow-up-down` / `arrow-up` / `arrow-down`)                                        |
| Row              | comfortable height, 3px status edge left, 20px side padding (16 compact)                                                                           |
| Row click        | opens the record's right drawer                                                                                                                    |
| Row actions      | direct 32px icon buttons, always visible, destructive last after a separator (light-red bg, red icon); actions column sticky right                 |
| Selection        | hover checkbox, tri-state header, shift-range; dark bulk bar docks in footer: "✓ N selected · Select all N · <actions> · Esc ×"                    |
| Mobile behaviour | collapse: low-priority columns fold into a meta line under the primary cell (footer "N columns in rows · Show all" ↔ "Fit to width") — never cards |
| Pagination       | infinite scroll, cursor pages, skeleton rows; virtualised > 60 rows (Leads > 40), 10-row overscan                                                  |

## List toolbar

h1 20px/600 with hairline right · tabs (3px track, 28px triggers; overflow → "More ⌄") · search (36px icon, expands on click or "/", 300ms debounce) · "Filters" (count badge when applied + joined ×) · view cluster (eye = columns) · split "New <thing>" button far right (⌄ = other create actions). Views that aren't a column go in a view bar under the toolbar (underlined text tabs).

## Filters popover

Right-aligned to trigger, flips left/up. Header "Filters" + "Clear all"; coloured chip sections per field; always "Created" (Any · Today · Yesterday · Last 7 days · Last 30 days · This month · Custom range) and, where applicable, "Follow-up date" (Any · Overdue · Today · Tomorrow · Next 7 days · Not set · Custom range); footer "Apply filter" (= a table fetch). No skeleton in the popover.

## States (default for every list)

| Surface     | Loading                                                 | Empty                                                                                                                                                                                                                                | Error                                                                                                                                                                 |
| ----------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table       | skeleton rows (#efeff1 bars, czsk shimmer 1.1s)         | centred 18px icon on section-tone tile + title + hint (per-screen strings in each file); with filters applied: icon `search`, hint "Nothing matches these filters. Clear them to see everything again."; fallback "Nothing here yet" | toast "Couldn’t load this list · connection dropped. Showing the last copy." + "Retry" (9s, re-fetches; rows stay; ~5% simulated)                                     |
| Drawer save | button "Saving…" (320–740ms)                            | n/a                                                                                                                                                                                                                                  | footer red "Not saved · your changes are kept", button "Retry save", toast "Couldn’t save · connection dropped. Everything you entered is still here." + "Retry" (9s) |
| Dropdown    | skeleton rows (62/48/70/40% widths) + spinner in search | "Nothing to pick yet"; with a query "No results for “<q>”" + hint "Try a name, phone number or ID" (remote) / "Check the spelling or try fewer letters"                                                                              | n/a — local                                                                                                                                                           |
| Hover card  | hidden until data arrives (no skeleton popover)         | n/a                                                                                                                                                                                                                                  | not shown                                                                                                                                                             |

## Contact card (hover on any person)

Popover placed below → above → right → left of trigger. Tinted header (48px avatar, name link, ID, since, pills) · Edit (`pencil`) · Reach + About sections · footer "+ Lead" · "+ Appointment" · "+ Patient" (only if not a patient). Max height 520px.

## Motion (shared)

| Element       | Property           | Duration           | Easing                    |
| ------------- | ------------------ | ------------------ | ------------------------- |
| Popover / dd  | opacity, transform | 160ms              | cubic-bezier(.2,.8,.2,1)  |
| Drawer panel  | transform          | 340ms              | cubic-bezier(.32,.72,0,1) |
| Backdrop      | background-color   | 340ms              | cubic-bezier(.32,.72,0,1) |
| Drawer ×      | opacity, scale     | 200ms, 200ms delay | ease                      |
| Search expand | width              | 220ms              | cubic-bezier(.2,.8,.2,1)  |

Reduced-motion (implemented, global): every animation and transition runs 1ms with no delay, iteration count 1 (skeleton shimmer stops), no smooth scrolling.
