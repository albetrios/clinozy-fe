# Screens

| Slug         | Route          | Purpose                                                                              |
| ------------ | -------------- | ------------------------------------------------------------------------------------ |
| splash       | / (boot)       | Branded ~3.7s load sequence before the app fades in                                  |
| today        | /today         | The clinic floor now: arrivals, waiting, with doctor, checkout                       |
| leads        | /leads         | Enquiries and their conversations, until they become patients                        |
| appointments | /appointments  | Bookings by doctor, room and machine (day, week, list)                               |
| patients     | /patients      | Registered patients list                                                             |
| patient-file | /patients/:id  | One patient: clinical notes, Rx, treatments, images, billing, team                   |
| medical      | /medical/:tab  | Medicine store: sales, medicines, purchases, suppliers, manufacturers, MRs, payments |
| clinic-stock | /stock/:tab    | Consumables used in procedures (not for sale): items, movements, purchases, vendors  |
| payments     | /payments/:tab | Ledger of money in/out, pending credits, day close                                   |
| tasks        | /tasks         | Follow-ups, feedback calls, reminders with owner and due time                        |
| offerings    | /offerings     | What the clinic sells: offerings, packages, offers, prices                           |
| users        | /users         | Team, roles & access, branches                                                       |

Routes are proposed — the prototype is a single page switching `room` state.

Shared: `_patterns.md` (drawer, dropdown, table, toolbar, filters, delete confirm, contact card) · `_report.md` (self-check).
