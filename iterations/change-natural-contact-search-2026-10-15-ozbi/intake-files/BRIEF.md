# Brief — What was typed becomes the contact, the picker drops its repeated words, and search reads like the desk talks

## What changes

The shared contact picker (`ContactQuickPick`) — New lead's Contact step, the appointment's who, New
task's For, Receive payment's and the Invoice's patient — changes in three ways.

1. **What was typed becomes the contact, by kind.** When the person is not found and the desk adds
   them, every value in the search lands in the field it belongs to, so nothing is typed twice:
   - letters → **Name** · a number (any format: `98250 11241`, `+91-98250-11241`, `098250 11241`) →
     **Mobile** · `@meera.iyer` or `instagram.com/meera.iyer` → **Instagram** (where the host keeps a
     handle: New lead, New task's For, Receive payment / Invoice)
   - an email or a contact / record number (`C-12345`, `#2371`) is never taken for a name.
   - The add row shows the values it will use, each in its own small chip — "New contact · Meera
     Iyer · +91 98250 11241 · @meera.iyer" — and the quick add opens with them filled in (an
     Instagram field appears only when a handle was typed). "More details" carries them into the
     contact editor.
2. **No repeated "Use contact".** Rows and Recent chips no longer say "Use contact" (or "Use
   patient"): picking a person uses them — the words said nothing. Rows that do something else keep
   their words: New lead's "Open lead" and "Re-create lead".
3. **Search the way the desk types.** With clinozy-be's sibling change (every typed word matched, in
   any order, names and numbers together), "iyer meera", "mee iy", "Meera 98250" or
   "+91 98250-11241 meera" find Meera Iyer; the picker marks **every** typed word in the name, not
   only a whole phrase.

## Why

The desk reviewed the compact picker: "if user has written something — please have that value in
contact as per the input so they won't need to enter it again — also remove use contact keyword — it's
repetitive, not necessary — and search should be very easy, natural."

## Affected screens, entities and routes

- Screens: leads (New lead), appointments (the appointment form's who), tasks (New task's For),
  payments (Receive payment), invoices (the Invoice drawer) — through the shared picker
- Entities: Contact (a new one may now carry an Instagram handle from the search)
- Routes: `GET /app/contacts` (`q` — every word, clinozy-be's sibling); `POST /app/contacts`,
  `POST /app/leads` unchanged in shape

## Rules

- The search's threshold stays (3 letters, 4 digits, a whole `C-12345`); the add row's ↵, the quick
  add's checks (a name; New lead's 10-digit mobile) and every pick's outcome stay.
- Instagram: one handle, 1–30 of `a–z 0–9 . _`, stored as typed with its `@` (the contact editor's
  rule). The appointment form keeps a new person's name and mobile only (it has no handle) — its add
  row and quick add show only those.
- An email in the search is left out of the new contact: contacts in the app have no email field (an
  open question for the user).
- Every new string ships in all 11 locales; strings no longer used are removed from all of them.

## Acceptance criteria

- [ ] Typing "Meera Iyer 98250 11241 @meera.iyer" and adding: Name "Meera Iyer", Mobile 98250 11241, Instagram @meera.iyer — in the quick add and, on "Add contact", in the contact made (New task's For) or the person set (New lead).
- [ ] "+91-98250-11241" fills Mobile only; "meera@example.com" fills nothing; "C-12345" fills nothing.
- [ ] The add row shows each value it will use as a chip; nothing is typed twice.
- [ ] No row or chip says "Use contact" or "Use patient"; "Open lead" and "Re-create lead" stay.
- [ ] "iyer meera" lists Meera Iyer with both words marked; "Meera 98250" lists her.
- [ ] The picker, host and locale suites pass; every gate is green.

## Out of scope

An email field on contacts; the contact editor's own fields; the backend (its sibling iteration);
lists' own search boxes (Leads, Patients pages).
