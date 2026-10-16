# Brief — one motion system, Emil Kowalski's, applied everywhere it moves

## What changes

1. **Three curves, each with one name, for the whole app.** The strong ease-out
   `--ease-out-strong` (`cubic-bezier(0.23, 1, 0.32, 1)`) for anything that enters, leaves or
   answers a press; a new strong ease-in-out `--ease-in-out-strong`
   (`cubic-bezier(0.77, 0, 0.175, 1)`) for anything that travels on screen from one resting place
   to another; the sheet curve `--ease-sheet` (`cubic-bezier(0.32, 0.72, 0, 1)`) for drawers and
   sheets. Tailwind's `ease-out` and `ease-in-out` utilities and the default transition curve
   resolve to the two strong curves. Every older curve and every literal copy reads a name instead:
   the dropdown, reveal, pop, fade, accordion and page-rise keyframes, the room search field, the
   bug report, the sign-in dial, onboarding's step motion (a script twin of the three tokens) and
   the refresh settle. A change of colour alone keeps `ease`.
2. **Selections travel like movement.** The room tracks' thumb, the section bar's lens, the phone
   tab bar's lens and the switch's thumb move on the strong ease-in-out — 240ms for every glide
   (the phone lens from 320ms on the sheet curve), 200ms for the switch. The selected label's ink
   changes on the same 240ms curve, so its text darkens as the thumb arrives rather than before it.
3. **One press.** Every button but a text link, and now Today's lane tiles, sink to 97% while held;
   the phone tab bar's icons dip to 95% (from 92%) — 160ms on the strong ease-out.
4. **Keyboard-first means no animation.** The command palette (Ctrl+K, many times a day) opens and
   closes at once: no backdrop fade, no drop.
5. **Tooltips are instant after the first.** The first tooltip still waits and fades in (≈125ms,
   from its trigger); once one is open, the next opens with no delay and no animation.
6. **Exits are faster than entrances.** Menus, popovers, hover cards and tooltips leave in 100ms
   (they enter in 150ms) on the strong ease-out. The Sheet primitive opens in 340ms on the sheet
   curve and closes in 200ms (it was 500ms in, 300ms out, on ease-in-out).
7. **Retuned to the standards.** The count roll runs 240ms (from 280ms); Today's lane cascade
   staggers 30ms between the first four cards (from 25ms over six), 200ms each; the checkbox's
   tick starts at 90% (from 65%).
8. **Reduced motion is gentler, not zero.** Movement still lands at once, but the fades that
   explain a change stay, at 160ms: a count crossfades instead of rolling, lane cards and the tick
   fade in without rising or scaling, a refreshed list still settles from half opacity, and the
   lens still crossfades its tone where it lands.
9. **No `transition: all`.** The last four — the progress bar, the accordion trigger, the OTP slot
   and the lead's copy chip — name the properties they animate.

## Why

The first motion iteration (`change-motion-polish`) added motion; this one makes all of the app's
motion speak one language, measured against Emil Kowalski's design-engineering standards
(`agent-os/skills/emil-design-eng`, `review-animations/STANDARDS.md`): the right curve for the
kind of motion, durations matched to how often it is seen, no animation on keyboard-first actions,
interruptible transitions, exits faster than entrances, gentler-not-zero reduced motion. The app
already held Emil's curves as scattered literals beside weaker defaults; a person moving between
rooms should feel one product.

## Affected screens, entities and routes

- Screens: every room's tab track and the section bar (desktop and phone); Today (lane tiles,
  lane panel, work queue); every button, checkbox, switch, tooltip, menu, popover, hover card and
  sheet; the command palette; the sign-in screen and onboarding (curve names only — no change in
  timing); the bug report (curve names only)
- Entities: none
- Routes: none — no API route, URL or search param changes

## Rules

- Easing by kind: entering, leaving or answering a press → strong ease-out; moving on screen →
  strong ease-in-out; drawers and sheets → the sheet curve; colour only → `ease`; constant motion
  (spinners, progress sweeps) keeps its own.
- Durations: presses 160ms; tooltips and small popovers 125–150ms in, 100ms out; glides 240ms;
  drawers and sheets 340ms in; every UI element under 300ms.
- Only `transform`/`translate`/`scale`, opacity, a short blur and colours animate — plus the one
  absolutely placed glide thumb's width and height, which move no layout. The thumb is placed by
  its own `translate`, `width` and `height`, never by custom properties.
- Nothing new moves on a keyboard shortcut or a hover; hover motion stays behind
  `(hover: hover) and (pointer: fine)`.
- Reduced motion: no movement; opacity and colour fades that carry meaning stay, at 160ms.
- The first-paint CSS stays within its 36.0 kB budget; no new dependency; no test id, role or
  copy changes; light, dark, every preset and right-to-left behave as before at rest.

## Acceptance criteria

- [ ] `index.css` declares the three curves once; no literal `cubic-bezier` remains in app code
      outside them (the route-progress sweep excepted); Tailwind's `ease-out` / `ease-in-out` and
      the default transition curve resolve to the strong curves.
- [ ] Every glide (room tracks, section bar, phone tab bar) and the switch thumb travel on the
      strong ease-in-out; glides take 240ms; the selected label darkens in step with the thumb.
- [ ] Holding a button or a lane tile scales it to 97%; a phone tab icon dips to 95%.
- [ ] Ctrl+K opens and closes the command palette with no animation.
- [ ] A second tooltip opened while one is showing appears at once, with no animation.
- [ ] Menus, popovers and tooltips leave faster than they enter; the Sheet opens in 340ms.
- [ ] Count roll 240ms; lane cascade 30ms apart for four cards; tick from 90%.
- [ ] With reduced motion: no movement, but counts crossfade, cards and ticks fade in, refreshed
      lists settle, and tones crossfade.
- [ ] No `transition-all` in app code.
- [ ] Initial CSS within 36.0 kB; every existing test passes; light, dark and Arabic unchanged at
      rest.

## Out of scope

- The drawers' exit (still none — opened and closed all day) and the keyboard-shortcuts drawer
  (it is a drawer, and slides like one).
- The room search field's width morph (a layout animation on an occasional action — kept, its
  curve named), the route progress sweep and the OTP error shake (kept as they are).
- New motion of any kind beyond what is listed; the sign-in dial's and onboarding's timings.
- The Playwright visual baselines — recorded separately with clinozy-be running.
