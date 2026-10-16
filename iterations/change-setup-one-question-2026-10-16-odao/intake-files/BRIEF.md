# Brief — Clinic setup asks one question at a time and keeps moving

<!--
Written 2026-10-16 from the user's answers in the planning conversation:
(1) "let's design step wise only 1 question at a time and keep going ahead? … it would be faster right?"
(2) "Branch name default should be organization name as main branch correct? go ahead and implement it"
The two open choices were left to the default: the clinic type stays a multi-pick (one Consultation
per specialty), and "No" goes live with the guide's "Invite your doctor" as today.
-->

## What changes

The setup drawer that opens the first time an Owner or Admin lands in a new clinic (on Today, or on
any room) asks **one question per screen** and moves ahead by itself, instead of three step cards
where the second is a form of eight fields.

```
 BEFORE  ① What kind of clinic? ── ② Where is your clinic? ──────────────────── ③ Do you see patients?
                                      PIN · area · city · state · address ·          ○ Doctor ○ Therapist ○ No
                                      phone · email · branch name · hours line        [Go live]
         three step cards: one open, the done ones folded into a ✓ peek, "Next: <step> →"

 AFTER   Q1 What kind of clinic is it?        specialty chips (1–6) ............... [Next]
         Q2 What's your clinic's PIN code?     six digits — moves on by itself at the sixth
         Q3 What's the street address?         one line; "Adajan · Surat · Gujarat" under it, from
                                               the PIN (Edit opens area, city and state)
         Q4 What's the clinic's phone number?  +91 ............ [Next] — the main branch is made here
         Q5 Do you see patients yourself?      Doctor · Therapist · No — a tap goes live
          ✓ You're live                        <clinic> branch · Open Mon–Sat 10:00–20:00 · <email>
                                               [Change] · Consultation ₹500 · you as doctor
```

### 1. One question per screen (screen: shell — every room)

- The drawer shows the open question only: its title, the one line that says why it is asked, and
  its answer. No step cards, no folded peeks, no locked steps to press.
- **Header:** "Set up <clinic name>", sub-line "About a minute · Question <n> of 5", the progress
  bar filling with each question.
- **Footer:** "Explore first" (closes, as today), **Back** from Q2 on (the question before, answers
  kept), and the primary — "Next" on Q1–Q4, "Go live" on Q5.
- **Moving on by itself:** the PIN's sixth digit moves to Q3; a tap on Q5's answer goes live.
  Enter is Next on every question.
- **Asked once:** a question whose answer is saved is not asked again — the drawer opens on the first
  unanswered one (Q2 when the clinic type is saved and no main branch exists; Q5 when a main branch
  exists).

### 2. The questions

```
 #   Question                             Answer                                    Saved
 ──  ───────────────────────────────────  ────────────────────────────────────────  ─────────────────────────────
 Q1  What kind of clinic is it?           Skin Hair Dental Gynac Physio General     the clinic's specialties +
                                          (1 to 6)                                  the step answered (as today)
 Q2  What's your clinic's PIN code?       six digits; a known PIN fills area, city  kept in the drawer
                                          and state from the bundled list
 Q3  What's the street address?           the address line; area · city · state     kept in the drawer
                                          shown under it (Edit to change them;
                                          shown as fields when the PIN is unknown);
                                          several areas → the area chips
 Q4  What's the clinic's phone number?    +91 phone (ten digits)                    the main branch: name = the
                                                                                    clinic's name (up to 60), email =
                                                                                    the owner's, hours Mon–Sat
                                                                                    10:00–20:00, the PIN, address and
                                                                                    phone answered
 Q5  Do you see patients yourself?        Doctor · Therapist · No (one tap)         as today, then Go live
```

- **The branch name is the clinic's name** — the clinic's first branch is its main branch, named
  after the clinic. The owner's email and the default hours are not asked; "You're live" shows them.

### 3. "You're live" shows the defaults

- "We set up:" lists the main branch — its name, then "Open Mon–Sat · 10:00–20:00 · <email>" — with
  **Change**, which opens that branch's drawer in the Branches room; then each Consultation with its
  price and "you as doctor/therapist", as today.
- "Book your first appointment" and "Done" stay as they are; so does "How did you hear about us?".

### 4. "Finish setup · n of 5"

The account menu's row and ⌘K count questions while the clinic is not live: the clinic type is one,
the main branch three (PIN, address, phone), the "you" answer one. After going live they count the
guide's three items, as today.

## Why

- **Faster to finish on a phone.** Step 2 was eight fields on one card: switching keyboards,
  scrolling, fixing errors. One question per screen keeps one keyboard open and nothing to scroll.
- **Fewer things asked.** The branch name, email and hours are defaults nobody needs to type on day
  one; they are shown at the end with Change instead of asked.
- **It keeps moving.** The PIN and the last answer move on by themselves; the owner taps, types the
  PIN, the street and the phone, and is live.

## Affected screens, entities and routes

- Screens: the app shell on every room (the setup drawer, the account menu's "Finish setup", the
  command menu's "Finish setup")
- Entities: none changed — Branch (created as today, at Q4 instead of the end of step 2),
  Organization (specialties, as today)
- Routes: none — the drawer keeps its hash (`#setup/clinic-type`, `#setup/location` for Q2–Q4,
  `#setup/you`, `#setup/live`, `#setup/guide`); no API change

## Rules

- **Who:** unchanged — members holding `organization:update`, never in a View-as preview.
- **Never trapped:** "Explore first", ×, Esc and the backdrop close the drawer, as today; Back never
  loses an answer.
- **Safe to repeat:** Q4 reads the setup first and makes no branch when a main branch exists (made
  meanwhile in the Branches room or by another admin) — as today.
- **PIN:** an unknown PIN fills nothing and blocks nothing — Q3 then shows area, city and state as
  fields to type.
- **Required:** PIN (six digits), the address line, area, city, phone (a valid ten-digit number).
  State stays optional. An error is shown on the question that holds it.
- **Accessible:** focus moves to each question's answer; "Question n of 5" is announced; every
  control works by keyboard; the phone layout is the full-screen sheet; all copy in every locale.

## Acceptance criteria

- [ ] A new clinic's Owner sees the drawer at Q1 with "Question 1 of 5"; each screen shows one
      question.
- [ ] Q1 saves the specialties and moves to Q2.
- [ ] Typing the sixth digit of a PIN moves to Q3 by itself; a known PIN shows area, city and state
      under the address; an unknown PIN shows them as fields.
- [ ] Back from Q3 shows Q2 with the PIN kept; Back from Q2 shows Q1.
- [ ] Q4's Next creates exactly one main branch named after the clinic, with the owner's email and
      Mon–Sat 10:00–20:00; a main branch made meanwhile is used, not duplicated.
- [ ] A tap on Q5's answer goes live; "You're live" shows the branch, its hours and email with
      Change, the Consultation and "you as doctor".
- [ ] Change opens the main branch's drawer.
- [ ] The account menu reads "Finish setup · n of 5" while not live.
- [ ] Closing at any question is "Explore first", as today.
- [ ] Works by keyboard alone, at 375px and 1440px, with no critical or serious accessibility
      finding.

## Out of scope

- The guide after going live, Settings › Clinic, the branch drawer, the members' notice, and the
  create-action guard — unchanged.
- Any clinozy-be change: the same routes, the same writes.
- Asking for the doctor's email when the owner answers "No" (left as the guide's "Invite your
  doctor").
- A single main specialty in place of the multi-pick.
