# Brief — the photo comparison zooms every photo together or each on its own, and remembers it

## What changes

The patient file's photo comparison (Photos → Select → Compare; `?compare=` on the Photos URL)
today moves every panel with one zoom: a scroll, a pinch, a drag or the zoom buttons move all
photos alike. Photos taken weeks apart are rarely framed the same — one is closer, one sits higher —
so the doctor cannot line up the same spot.

1. **Linked or Separate.** The comparison's bar gains a two-way switch, "Linked" (a chain) and
   "Separate" (a broken chain):
   - **Linked** — what it does today: every gesture and the bar's zoom group move every photo
     together.
   - **Separate** — a scroll, a pinch, a double-click or a drag on a photo moves that photo only.
     Each photo carries its own small zoom group (− · its level · +) in the stage's bottom end
     corner; its level resets that photo. The bar's zoom group gives way to "Reset all".
2. **Alignment survives the switch.** Switching never resets anything: a doctor places each photo in
   Separate, then switches to Linked and zooms them all together — each photo keeps its own offset
   (Linked moves every photo by the same step from where it stands).
3. **Remembered on this device.**
   - The mode (Linked or Separate) and the layout the user picked (One row or Grid) stay for every
     later comparison; until a layout is picked it follows the count (one row up to four).
   - Each comparison remembers where every photo stands — zoom and position — so opening the same
     photos again shows them as they were left. A photo back at 100% and centred is forgotten.
   - The position is kept as a share of the photo's panel, so it holds when the layout or the
     window changes size.
4. The keyboard keeps + − 0: in either mode they zoom every photo (each from its own level) and 0
   resets all.

## Why

Before/after photos are taken at different distances and angles. To judge progress the doctor needs
to put the same spot of each photo side by side — zoom and place each one, then zoom them together —
and not redo it every time the comparison is opened again.

## Affected screens, entities and routes

- Screens: the patient file's Photos comparison (`…/patients/$patientId/images?compare=`)
- Entities: none
- Routes: none

## Rules

- The photo viewer (one photo, `…/images/$imageId`) is unchanged: one photo, its swipe, each photo
  starts at 100%.
- Remembering is per device (the device preferences store), never server state; no patient data is
  stored, only photo ids and numbers. It keeps a bounded number of comparisons (the oldest is
  dropped first).
- Zoom stays 100–600%; at 100% a photo is centred (no pan).
- On a phone the bar's switch is icon-only (each radio keeps its name); the per-photo zoom group shows
  on a phone too.
- Every string in the 11 locales; semantic tokens, named radii, `data-slot="pill"`, logical
  properties; the first-paint CSS stays within its 36 kB budget.

## Acceptance criteria

- [ ] The bar shows Linked / Separate; Linked is the default and behaves as before.
- [ ] In Separate, a gesture or a photo's own zoom group moves that photo only; "Reset all" resets
      every photo.
- [ ] Switching Separate → Linked keeps each photo where it was; a Linked zoom then moves every photo
      from its own level.
- [ ] Closing and reopening the same comparison restores each photo's zoom and position; the mode and
      the picked layout are restored for any comparison.
- [ ] A photo back at 100% is forgotten; the memory is bounded.
- [ ] The viewer behaves as before.
- [ ] Existing tests pass; the gates pass.

## Out of scope

The Overview, uploads, selection, the comparison's order and "+N days", the viewer, clinozy-be.
