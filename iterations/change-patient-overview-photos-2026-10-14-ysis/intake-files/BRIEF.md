# Brief — a structured patient Overview, effortless photo upload, and side-by-side photo comparison

## What changes

1. **The patient file's Overview (`/patients/<id>/timeline`, the default section).** The cards stop
   floating in a dense, ragged grid and sit in fixed rows, every card in a row the same height:
   - **Row 1 — Clinical**, full width: the smart note over the four lists (Complaints · Diagnosis ·
     Suggested · Later), each list its own soft panel with its dot, its name and its count; a
     chip wraps to two lines instead of being cut to one; an empty list says "Nothing added yet".
   - **Row 2 — Care**: Visits · Treatments · Packages · Prescriptions — one column on a phone, two
     from 560px of the content column, four from 1180px.
   - **Row 3 — Photos and Reports**: Photos two thirds wide and Reports one third from 900px;
     stacked below.
   - **Row 4 — Billing and Team notes**: two columns from 640px.
   - Then the activity timeline, as today.
   - **Empty cards** no longer show a large illustration: the card keeps a dashed slot in its
     section's tone filling the card's free space, with the small icon and the existing empty line;
     when the card has an add action, the slot runs it ("Book", "New prescription", …).
2. **The Overview's Photos card is an upload target.** The first tile is a dashed "Add photos" tile
   (it opens the file picker); files dropped anywhere on the card upload to General, and an image
   pasted while the Overview is open uploads too. With no photos the card is one large dashed drop
   zone: "Drop photos here or click to upload" over "JPG or PNG up to 10 MB · paste works too".
3. **Photos (`/patients/<id>/images`) — upload made obvious.**
   - A dashed **upload strip** at the top of the grid, always visible to a member who may upload:
     "Drop photos here" · "or paste a copied image" · **Choose photos** and, on a touch device,
     **Take photo** (opens the camera) — the album on screen named as the target ("Adds to General").
   - The empty album is the same drop zone, large, instead of the empty illustration.
   - While files are dragged over the section, a veil says "Drop to add to General".
   - An image pasted anywhere in the section (focus not in a field) uploads to the album on screen.
4. **Photos — a compact grid.** The days no longer each take a full row: day groups flow side by
   side and wrap, so five single-photo days sit in one row; tiles keep their S / M / L sizes.
5. **Photos — selection.** "Select" in the toolbar (and a check circle on every tile on hover)
   turns selection on; a tap then selects instead of opening. Selected tiles carry a ring and a
   filled check. A bar at the bottom of the section says "3 selected · Pick 2 to 8 photos to
   compare", with **Clear** and **Compare**. At most **8** photos: the ninth is refused with "You
   can compare up to 8 photos at a time". Esc or "Done" leaves selection.
6. **Photos — compare.** **Compare** (2 to 8 selected) opens a full-screen comparison on the dark
   viewer chrome, on its own URL (`?compare=<id>,<id>,…`, so Back closes it and a link reopens it):
   - The photos side by side, oldest first; each panel names its photo, its day, its body part and
     stage pills, and its distance from the first ("+21 days"; the first says "Start").
   - **One row** (the default up to 4 photos) or **Grid** (the default from 5: two rows); a phone
     shows two columns.
   - **Zoom and pan are shared**: zooming or dragging any panel moves every panel the same way
     (buttons − 100% +, the wheel, double-click, pinch), so the same spot is compared across visits.
   - × on a panel removes it from the comparison while more than two remain; Esc closes.

## Why

The Overview is the first screen of every patient file, and today it reads as a scatter: cards of
every height leave holes, and five large empty illustrations push the real records out of view.
Photos are how a skin, hair or laser clinic proves progress, but uploading is hidden behind a
split button and a drag the screen never advertises, the grid wastes a row on every visit day, and
there is no way to put Session 1 next to Session 6 — staff open one photo, close it, open the next.

## Affected screens, entities and routes

- Screens: patient file › Overview (`timeline`), patient file › Photos (`images`) and its new
  compare view; the photo viewer's chrome (shared zoom controls)
- Entities: none — patient images as they are (`PatientPhoto`)
- Routes: none — the existing `GET/POST /app/patients/:patient_id/images`, `GET …/images/:id` and
  `/uploads`; the comparison is a search param on the existing Photos URL

## Rules

- Upload follows today's rules: `patient:update` to upload, JPG or PNG only, 10 MB each (the shared
  upload tray), filed in the album on screen (General from the Overview); a drop or paste with no
  JPG or PNG says "Drop image files".
- Paste is ignored while focus is in a text field, and only image files count.
- Selection and compare are read-only: they need no write code; the Private album stays behind its
  own code.
- Compare takes 2 to 8 photos; a link with fewer valid ids opens no comparison, extra ids are cut.
- No API, data or background change; no new route; every existing test id is kept.
- Semantic tokens only; named radius steps; `data-slot="pill"` on round surfaces; dark mode, RTL and
  every preset follow; all copy through i18n in all 11 locales.

## Acceptance criteria

- [ ] Overview: each row's cards share one height at 1440px and 390px; no gaps between cards.
- [ ] Overview: an empty card shows the dashed slot, no large illustration; its slot runs the add.
- [ ] Overview: the Photos card's "Add photos" tile opens the picker; a dropped JPG uploads to General.
- [ ] Photos: the upload strip is visible to a writer with photos and without; "Choose photos" opens
      the picker; a dropped or pasted JPG lands in the album on screen.
- [ ] Photos: single-photo days sit side by side.
- [ ] Photos: "Select" → tapping tiles selects; the bar counts; the ninth is refused with the toast.
- [ ] Compare opens on `?compare=` with 2–8 photos side by side, oldest first, with "+N days".
- [ ] Zooming or dragging one panel moves every panel; × removes a panel down to two; Esc closes.
- [ ] One row ↔ Grid switches; a phone shows two columns.
- [ ] Existing Overview, Photos and viewer tests pass; new units are tested.

## Out of scope

- Reordering photos, editing several photos at once, deleting several at once.
- A comparison across patients, or an export / print of the comparison.
- Any clinozy-be change; the Activity column, the rail and the other sections.
