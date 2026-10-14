# Brief — a split-screen sign-in built around a live journey dial

## What changes

1. **The frame (`/login`, `/mfa` and the OAuth hand-off `/callback` — every screen `AuthLayout`
   frames).** From `xl` (1280px) the sign-in screen is a split screen:
   - **The stage** on the signed-out canvas — the logo at the top, then the hero, the three reasons
     and the journey dial, over a faint dot grid and two soft room-tone washes.
   - **The form panel**, docked at the inline end and full height (26rem; 28rem from `2xl`, 32rem
     from `3xl`) — the language picker and theme toggle at its top, the product mark above the
     form, the privacy line under it, and "Privacy choices" at its foot. The form has no card of its
     own there: the panel is its surface.
   - Below `xl` it is one column: header → hero → the form's 360px card and the privacy line → the
     dial → the reasons → footer, so the form stays above the fold on a phone.
2. **The hero.** The existing eyebrow, headline and lead, larger and tighter: the headline 38px on a
   phone, 48px from `sm`, 44px at `xl`, 56px at `2xl`, 72px at `3xl`, −0.035em, balanced lines.
   Start-aligned on a phone and from `xl`; centred between `sm` and `xl`.
3. **The journey dial** replaces the row of journey pills. One patient's day as a dial: the seven
   tone-coded stops (Enquiry · Booked · Waiting · With doctor · Treatment · Checkout · Follow-up),
   clockwise from the top on a ring, each named under its icon; the logo's green dot as the
   thread, stepping from stop to stop; the stop it is on named in the centre over "One patient,
   one thread" and a "Live" dot; the seven tones blurred into an aura behind the ring.
   - **Motion — one clock.** One turn is 15.4s: the thread holds 1.54s on a stop and moves 0.66s
     (ease-in-out 0.77, 0, 0.175, 1). The stop it reaches lifts to 116% with a glow in its tone;
     its name rises into the centre; every one of these is timed `stop × 2.2s` into the turn.
   - **The page load.** The dial turns in from −12° out of a blur, the stops pop in round the ring
     60ms apart, the hero's lines, the reasons and the moment cards rise in turn.
4. **The moments.** The three existing moment cards float by the dial from `sm` (stacked under it
   on a phone) and each lifts and rings in its tone as the thread reaches its stop: the arrival at
   Waiting, the invoice at Checkout, the follow-up at Follow-up.
5. **The reasons.** The three value lines become a list with hairline rules, in the hero's column
   from `xl`.
6. **The form's heading.** "Welcome back", "Check your email" and the MFA headings grow from 18px to
   a display size: 24px, 30px from `xl`.

## Why

The sign-in screen is the first thing a clinic owner or a new hire sees. The current one is a washed
panel and a small card floating in empty space, and the patient journey reads as a row of chips.
The redesign gives each side one job — say what Clinozy is, and sign in — and shows the product's
promise (one patient, one thread through every room) as a moving picture rather than a list.

## Affected screens, entities and routes

- Screens: the sign-in screen (`/login`), MFA (`/mfa`) and the OAuth hand-off (`/callback`) — the
  screens `AuthLayout` frames; the shared `PublicFrame` parts (skip link, "Privacy choices") and
  the card heading (`PublicCardHeader`) they use
- Entities: none
- Routes: none — no API route is added, changed or removed; every URL stays as it is

## Rules

- No change to the sign-in flow, its methods, its errors or its test ids; no API, data or
  background change.
- No new copy: every string is the existing `auth` › `showcase.*` text, already in all 11 locales.
- Semantic tokens only (the seven room tones, the zinc neutrals, the logo green); dark mode, every
  preset and the theme axes follow.
- Logical placement throughout: under RTL the page mirrors and the journey runs the other way
  round, with the thread and the aura mirrored to match.
- Reduced motion: the dial stands still with every stop named; the thread, the halos and the
  cycling centre label are not shown.
- Only transform, opacity and a short blur animate; a stop's label is never dimmed.
- The DOM order stays hero → form → showcase, so the keyboard reaches the email field first; the
  form heading stays the page's `h1`.
- The split's grid and the dial's motion ship as CSS with the lazy auth chunk, never on the first
  paint: the initial CSS stays within its budget.

## Acceptance criteria

- [ ] From 1280px the form sits in a full-height panel at the inline end, with the controls at its
      top and "Privacy choices" at its foot; below 1280px the order is hero → form → dial → reasons.
- [ ] The dial shows all seven stops, named, clockwise from the top; the thread steps through them
      on a 15.4s turn and the centre names the stop it is on.
- [ ] Each moment card lifts and rings in its tone when the thread reaches its stop.
- [ ] Arabic mirrors the page and runs the journey counter-clockwise.
- [ ] French — the longest stop names — fits: ring labels clear each other and the centre label
      wraps inside the disc.
- [ ] With reduced motion the dial is still and every stop is named.
- [ ] Light and dark both read correctly; no raw palette colours.
- [ ] Sign-in, the code step and MFA behave exactly as before; every auth test id is kept.
- [ ] Initial CSS stays within the size budget.

## Out of scope

- The sign-in flow, OAuth, passkey, MFA logic and their copy.
- Other public pages (`PublicLayout`, the organization picker, the invitation and the 404), which
  keep `PublicFrame` as it is.
- New or changed translations.
- The Playwright visual baselines of the login page — recorded separately with clinozy-be running.
