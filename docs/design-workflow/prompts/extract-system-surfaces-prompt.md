# Paste this to Claude Design — overlays & loading

Scope is deliberately narrow: six overlays plus the loading system. Screens are
covered by the app-shell and auth/public briefs.

---

I need two things designed: a small set of overlays that can appear over any
page, and the loading system used everywhere.

**Think about how these fit your design system before designing them.** For each
group, tell me:

1. **What you already have** that covers it — reuse beats invention.
2. **What needs a new pattern**, and why the existing ones don't stretch.
3. **Your proposal** — then the spec.

Where several items are variations of one idea, say so and design the idea once.

Keep each spec brief: structure, copy, states, icons. Light and dark. Say what
changes on mobile.

---

## A. Overlays

Six surfaces that appear over whatever page the user is on.

### 1. Notification centre

A list of notifications. Unread vs read, mark-one-read, mark-all-read, and an
empty state. Consider how the unread count is surfaced on its trigger.

### 2. Session about to expire

A warning that the session ends soon, with **stay signed in** and **sign out
now**. Time-sensitive — it needs a countdown or equivalent urgency without being
alarming. It can appear while the user is mid-task, so it must not steal work.

### 3. Re-authenticate to continue

Shown before a sensitive action when the session is valid but not recent enough.
The user proves identity again, then the original action resumes.

The important part is the **framing**: this isn't an error and isn't a logout —
it's a checkpoint. Copy should make clear that what they were doing is still
there.

### 4. Confirm destructive action

Delete or otherwise irreversible. Needs a clear statement of what is about to
happen, cancel, and a confirm that reads as deliberate.

Consider whether high-stakes deletions need typed confirmation, and whether
that's a separate variant or a prop.

### 5. Cookie / consent notice

First visit. Accept, reject, and a way to see detail. Must not block the page or
trap focus, and needs to sit sensibly with the offline indicator below.

### 6. Offline indicator

Connection lost. Persistent while offline, and it should resolve visibly when
the connection returns rather than just disappearing.

Think about: how it coexists with anything else pinned to the same edge.

**Across all six:** several of these are "a panel over the page". Is that one
pattern with variants, or genuinely different things? Say which, and design the
shared idea once.

Also tell me, for each: **how it's dismissed** (overlay click, Esc, explicit
only), **whether it traps focus**, and **whether it can stack** with another.

---

## B. Loading — seven distinct moments

The most-used pattern in the app and the easiest to leave half-designed. Each
row is a real moment with a different duration and a different amount of known
context. **Design the system, then show each case** — I'd rather have two
primitives applied seven ways than seven unrelated treatments.

| #   | Moment                  | When                                      | What's known                              |
| --- | ----------------------- | ----------------------------------------- | ----------------------------------------- |
| 1   | **App boot**            | First paint, before anything renders      | Nothing — no layout yet                   |
| 2   | **Shell loading**       | The layout chunk itself is still arriving | Nothing, but the frame is about to appear |
| 3   | **Route change**        | Navigating between pages                  | Old page still visible                    |
| 4   | **Region loading**      | A panel or list fetching its data         | Layout known, content unknown             |
| 5   | **Inline / more**       | Infinite scroll fetching the next page    | Existing content stays visible            |
| 6   | **Action pending**      | Button pressed, waiting on the server     | Everything known; one control is busy     |
| 7   | **Blocking transition** | Sign-in completing, redirect in flight    | Full screen, indeterminate                |

Questions I'd like answered, not assumed:

- **Where's the line between spinner and skeleton?** Skeletons need known
  layout; spinners don't. Which moments above get which?
- **Is there a minimum display time?** A skeleton that flashes for 80ms reads as
  a glitch. Say whether you'd hold it, and for how long.
- **What happens after a long wait?** If something takes 10s, does the treatment
  change — a message, a cancel, a reassurance?
- **Does a pending button keep its label?** Swap to "Saving…", keep the label
  with a spinner beside it, or replace with a spinner alone. The width shouldn't
  jump either way.
- **Skeleton shape.** Do they mirror the real content's geometry (avatar circle,
  two text lines, a chip row) or are they generic bars? Mirroring is more work
  but much less jarring.
- **Motion.** Pulse, shimmer, or static? And what happens under reduced-motion —
  this is the one place an animation runs constantly.

Please also cover the **transition out** — content replacing a skeleton is a
moment people notice. A hard swap feels cheap; a crossfade usually doesn't.

### Where each is used today

For grounding — you don't have to match this, but it's what exists:

- App boot and blocking transitions: one full-page spinner
- Shell loading: a dedicated fallback so the frame doesn't flash
- Route change: a thin progress bar at the top of the viewport
- Region loading: skeletons in lists, tables, members, roles, pickers
- Action pending: buttons already disable and mark themselves busy for screen
  readers — the visual side is what I need from you

---

## Please keep in mind

- **Exact copy** for headings, buttons, helper text, and every message.
- **Every state** — including empty, error, and the resolved/success moment.
- **Light and dark.**
- **Mobile** — overlays are what break first at narrow widths.
- **Icon names**, not descriptions.
- Where something is genuinely out of scope for your system, say so plainly
  rather than improvising.

## Order

1. **B. Loading** — appears more often than anything else, and the overlays
   depend on it (each has a pending state)
2. **A. Overlays** — the shared container pattern first, then the six cases

---

## Out of scope

Not needed — already handled, or deliberately unchanged:

settings panels · design primitives · payment · security surfaces · organisation
& people dialogs · toasts and error boundaries · tables, cards and empty states ·
command palette · appearance and language pickers · keyboard-shortcuts reference
