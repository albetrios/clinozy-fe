# Empty states — every section, tab and in-card list

Route: every clinic room under `/organization/:organizationSlug/…` and the `#settings/*` modal
(`_index.md`). Looks and anatomy: `preset.md`. Placement: `shell.md`. Prototype: `empty-states.html`.

## Looks

- **Room** — the 112px illustration, title, line and action, centered in the list's space. For a
  section or a tab.
- **Compact** — the 56px illustration and a one-line title, centered in its card. For an empty list
  inside a populated screen.
- **Filtered** — the room look with the `Search` icon in the list's tone, "No matches", "Try a
  different search or clear the filters." and "Clear filters" (unchanged words). Shown instead of the
  room look whenever a search or filter hides every row.
- **States around it are unchanged:** loading → the list's skeleton; failed → its error with Retry.

## Inventory — the room look

"Existing" means the words already shipped stay as they are. "New" words ship in all eleven locales.
An action shows only for a member allowed to take it.

| #   | Section › tab                       | Tone   | Icon          | Title                                      | Line                                                         | Action                    |
| --- | ----------------------------------- | ------ | ------------- | ------------------------------------------ | ------------------------------------------------------------ | ------------------------- |
| R1  | Today › Enquiries lane              | lav    | UserPlus      | existing "No one here right now."          | —                                                            | —                         |
| R2  | Today › Arriving lane               | sky    | Calendar      | existing                                   | —                                                            | —                         |
| R3  | Today › Waiting lane                | butter | Armchair      | existing                                   | —                                                            | —                         |
| R4  | Today › With doctor lane            | blush  | Stethoscope   | existing                                   | —                                                            | —                         |
| R5  | Today › Treatment lane              | sage   | Sparkles      | existing                                   | —                                                            | —                         |
| R6  | Today › Checkout lane               | butter | Receipt       | existing                                   | —                                                            | —                         |
| R7  | Today › Pharmacy lane               | mint   | Pill          | existing                                   | —                                                            | —                         |
| R8  | Leads › every view                  | lav    | UserPlus      | new "No leads yet"                         | new "Enquiries from calls, WhatsApp and walk-ins land here." | existing "New lead"       |
| R9  | Leads › filtered                    | lav    | Search        | existing "No leads match"                  | —                                                            | existing "Clear filters"  |
| R10 | Appointments › Agenda               | sky    | Calendar      | new "No appointments here"                 | new "Bookings for the days you pick show up here."           | existing "New appointment" (was the "book one" link) |
| R11 | Patients                            | sage   | Users         | existing                                   | existing                                                     | — (as today)              |
| R12 | Patient file › Visits               | sky    | Calendar      | existing "No appointments yet"             | —                                                            | —                         |
| R13 | Patient file › Prescriptions        | sage   | Pill          | existing                                   | —                                                            | —                         |
| R14 | Patient file › Treatments           | lav    | Sparkles      | existing                                   | —                                                            | —                         |
| R15 | Patient file › Photos               | blush  | Camera        | existing "No photos in {album} yet"        | existing                                                     | existing "Upload images"  |
| R16 | Patient file › Reports              | mint   | FileIcon      | existing                                   | —                                                            | —                         |
| R17 | Patient file › Invoices             | peach  | Receipt       | existing                                   | —                                                            | —                         |
| R18 | Patient file › Payments             | peach  | Wallet        | existing                                   | —                                                            | —                         |
| R19 | Patient file › Packages             | mint   | Package       | existing "No packages yet"                 | —                                                            | —                         |
| R20 | Patient file › Team notes           | lav    | MessageSquare | existing "No notes yet"                    | —                                                            | —                         |
| R21 | Medical › Sales                     | blush  | Receipt       | existing                                   | existing hint                                                | existing "New …" per tab  |
| R22 | Medical › Medicines                 | blush  | Pill          | existing                                   | existing hint                                                | existing                  |
| R23 | Medical › Purchases                 | blush  | ShoppingCart  | existing                                   | existing hint                                                | existing                  |
| R24 | Medical › Suppliers                 | blush  | Truck         | existing                                   | existing hint                                                | existing                  |
| R25 | Medical › Manufacturers             | blush  | Factory       | existing                                   | existing hint                                                | existing                  |
| R26 | Medical › MRs                       | blush  | Briefcase     | existing                                   | existing hint                                                | existing                  |
| R27 | Medical › Payments                  | blush  | Wallet        | existing                                   | existing hint                                                | existing                  |
| R28 | Clinic stock › Items                | mint   | Package       | existing                                   | existing hint                                                | existing                  |
| R29 | Clinic stock › Purchases            | mint   | ShoppingCart  | existing                                   | existing hint                                                | existing                  |
| R30 | Clinic stock › Movements            | mint   | ArrowLeftRight| existing                                   | existing hint                                                | existing                  |
| R31 | Clinic stock › Vendors              | mint   | Truck         | existing                                   | existing hint                                                | existing                  |
| R32 | Payments › ledger                   | butter | Wallet        | existing                                   | existing                                                     | existing "Receive payment"|
| R33 | Payments › Pending                  | butter | Hourglass     | existing                                   | existing                                                     | existing                  |
| R34 | Tasks › To do                       | plum   | SquareCheck   | new "All caught up"                        | existing "Nothing needs you right now. …"                    | existing "New task"       |
| R35 | Tasks › Snoozed                     | plum   | Clock         | existing "No snoozed tasks"                | —                                                            | —                         |
| R36 | Tasks › Done                        | plum   | CheckCircle   | existing "Nothing resolved yet today"      | —                                                            | —                         |
| R37 | Offerings                           | sky    | Tag           | existing                                   | existing                                                     | existing "New offering"   |
| R38 | Offerings › Offers                  | sky    | Sparkles      | existing                                   | existing                                                     | existing "New offer"      |
| R39 | Users › Team                        | lav    | UserCog       | existing                                   | existing                                                     | existing                  |
| R40 | Users › Branches                    | lav    | MapPin        | existing                                   | existing                                                     | existing                  |
| R41 | Home with no section switched on    | sky    | Plug          | existing                                   | existing                                                     | —                         |
| R42 | Notifications (bell panel)          | butter | Bell          | existing                                   | existing                                                     | —                         |
| R43 | Settings › Sessions                 | sky    | Laptop        | existing                                   | existing                                                     | —                         |
| R44 | Settings › Members                  | sky    | Users         | existing                                   | existing                                                     | —                         |
| R45 | Settings › Roles                    | lav    | ShieldCheck   | existing                                   | existing                                                     | —                         |
| R46 | Settings › API keys                 | lav    | KeyRound      | existing                                   | existing                                                     | —                         |
| R47 | Settings › Webhooks                 | plum   | Webhook       | existing                                   | existing                                                     | —                         |
| R48 | Settings › Webhook delivery attempts| plum   | Send          | existing                                   | existing                                                     | —                         |

## Inventory — the compact look

| #   | Where                                         | Tone          | Icon           | Title                                |
| --- | --------------------------------------------- | ------------- | -------------- | ------------------------------------ |
| C1  | Today › work queue                            | plum          | SquareCheck    | existing                             |
| C2  | Patient overview › Complaints                 | blush         | MessageSquare  | existing "Nothing added yet"         |
| C3  | Patient overview › Diagnosis                  | lav           | Stethoscope    | existing                             |
| C4  | Patient overview › Treatment suggestions      | sage          | Sparkles       | existing                             |
| C5  | Patient overview › Future suggestions         | sky           | Compass        | existing                             |
| C6  | Patient overview › Feedback (the logging card)| butter        | Star           | existing, keeps its line and its tap |
| C7  | Patient timeline › each card                  | the card's section tone | the section's icon | existing                 |
| C8  | Patient timeline › Activity                   | sage          | History        | existing                             |
| C9  | Patient file › offering ideas                 | lime          | Sparkles       | existing                             |
| C10 | Payments › Day close › the day's entries      | peach         | Receipt        | existing                             |
| C11 | Users › Roles › role workspace                | lav           | ShieldCheck    | existing                             |
| C12 | Settings › Passkeys                           | lav           | Fingerprint    | existing                             |
| C13 | Settings › Billing › payment methods          | peach         | CreditCard     | existing                             |
| C14 | Settings › Webhook form › events              | plum          | Zap            | existing                             |
| C15 | Chat column › an empty thread (the dashed card)| sky          | MessageSquare  | existing, keeps its chips            |

## Phone (375px)

The same looks. A room look in a table card centers in the card; in a scrolling view it keeps 48px
above and below. Titles and lines wrap, centered; the action stays one button.

## Accessibility

The illustration is decorative (`aria-hidden`); the title keeps its heading level (h3 in a room, h1
where the empty state is the page); a compact title is a paragraph. Colors are decorative — no
meaning rides on them — so no contrast floor applies to the art; the title and line keep their
existing text colors.
