# Brief — the phone tab bar floats, as a glass capsule in the style of the latest iPhone tab bar

## What changes

1. **A floating capsule (`shell`, phones below `md`).** The tab bar no longer runs edge to edge on
   the bottom of the screen with a top hairline. It becomes a fully rounded capsule, 62px tall,
   inset 20px from each side (at most 448px wide, centred), lifted off the bottom edge: 12px above
   it, or — on a phone with a home indicator — the safe-area inset less 12px, whichever is larger
   (22px on a 34px inset), the way the current iPhone tab bar sits over the home indicator.
2. **Glass material.** The capsule is translucent: the card colour at about 72% over the page, with
   a background blur and a saturation lift, so the room scrolling behind it shows through, softly
   blurred. A hairline edge, a soft top highlight and a soft floating shadow lift it off the page,
   in light and dark. Where the browser cannot blur, the capsule is near opaque instead.
3. **A scroll edge.** Under the capsule, the bottom of the screen fades softly into the page colour,
   so the capsule stays legible over a busy table or a photo. The fade takes no taps.
4. **A sliding selection lens.** One rounded lens sits behind the current room's slot — icon and
   label together — in that room's tone (today's 46×28 icon pill colour), and slides to the next
   room when the current room changes, in 320ms on an ease-out curve (`cubic-bezier(0.32, 0.72, 0,
   1)`), its colour crossfading as it moves. The current slot's icon and label are in the tone's
   ink, the label at 600. When no slot is current the lens fades out. "More" naming an unpinned
   current room carries the lens. While the All sections sheet is open from "More" and "More" is
   not current, its slot shows a muted pressed capsule.
5. **Larger slots.** Icons grow to 22px (from 16px inside the pill; the "More" compass from 18px),
   the 10.5px label sits 2px under the icon, and each slot is 54px tall. While pressed a slot's
   content dips to 92% scale (100ms) and springs back on release.
6. **The bottom stack follows.** Everything that rides above the tab bar — the notice pills, the
   floating "New", the upload tray, the toasts, the offline and update pills, the consent card and
   the feedback trigger — keeps its gap above the capsule's new top edge, and a room's last row can
   still be scrolled clear of the capsule.

## Why

- Every other app on a clinic team's phones now has the floating, translucent tab bar of the current
  iPhone; Clinozy's edge-to-edge bar with a hairline reads a generation old.
- A floating capsule over a scrolling room keeps more of the room visible, and a lens in the room's
  own colour makes "where am I" obvious at a glance.

## Affected screens, entities and routes

- Screens: shell (the phone tab bar and the phone bottom stack)
- Entities: none
- Routes: none — no API route is added, changed or removed; no frontend URL changes

## Rules

- Phones only: from `md` up the header nav stays as it is and there is no tab bar.
- The bar keeps its slots, their order, labels, test ids and semantics: `nav` "Sections", four pinned
  rooms + "More", `aria-current="page"` on the current slot, "More" opening All sections as a bottom
  sheet (`aria-haspopup="dialog"`).
- Semantic tokens only: the glass is mixed from the card, border, foreground and page tokens, so
  every preset and dark mode follow it. The theme axes still own the bar: under the Sharp shape the
  capsule and the lens are square, and the elevation axis owns its shadow.
- Motion respects reduced motion: no slide and no press dip — the lens moves at once.
- Right-to-left mirrors the bar: the lens slides the other way.
- Every slot is at least 44px tall; the bar is never covered by and never covers the surfaces of the
  bottom stack.
- No new string, no new route, no backend change.

## Acceptance criteria

- [ ] Below `md` the tab bar is a fully rounded capsule, 62px tall, 20px from each side (centred at
      most 448px wide), its bottom 12px above the screen edge without a safe-area inset and the
      inset less 12px with one (22px on a 34px inset); from `md` there is no tab bar.
- [ ] The capsule is translucent with a background blur over the page in light and dark, with a
      hairline edge and a floating shadow, and is near opaque where blur is unsupported.
- [ ] A soft fade into the page colour sits under the capsule at the bottom of the screen and does
      not take taps.
- [ ] One lens, in the current room's tone, covers the current slot's icon and label and slides to
      the new slot in 320ms when the room changes; it fades out when no slot is current and carries
      to "More" when "More" names the current room.
- [ ] Icons are 22px, labels 10.5px, slots 54px tall; the current label is 600 and no label changes
      width when the current room changes.
- [ ] With reduced motion the lens does not slide and slots do not dip on press.
- [ ] In right-to-left the lens sits under the right slot and slides mirrored.
- [ ] Under the Sharp shape the capsule and the lens are square.
- [ ] Every surface of the phone bottom stack (notice pills, floating "New", upload tray, toasts,
      offline and update pills, consent card, feedback trigger) sits above the capsule's top edge
      at 390 × 844 with and without a safe-area inset, and a room's last row scrolls clear of it.
- [ ] Test ids, roles, `aria-current` and the "More" sheet behave as before; the tab bar has no axe
      violations.
- [ ] The frontend's static gates, unit tests and bundle budgets pass.

## Out of scope

- The iPhone tab bar's minimize-on-scroll (the bar shrinking to the current tab while scrolling).
- A separate floating search button beside the bar.
- Glass refraction (the lens bending the content behind it) — CSS can blur, not refract.
- The All sections bottom sheet itself, the header nav on tablet and desktop, which rooms are pinned.
- Any backend route, table, job, seed or permission change.
