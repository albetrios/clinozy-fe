# Shell — where an empty state sits

The shell itself (header, section bar, phone tab bar, chat column) does not change. This file says
where the empty state goes inside it.

- **A room's table** (Leads, Appointments › Agenda, Patients, Medical, Clinic stock, Payments, Pending,
  Offerings, Offers, Users › Team, Branches, the patient file's table sections): the table card keeps
  its header row; the empty state fills the card's body and sits in its **vertical middle**, centered
  across the visible width (not the table's scroll width). The footer count and the "All … loaded" end
  line do not show for an empty list.
- **A room view without a table card** (Tasks' views, the patient file's Photos, Packages and Team
  notes): the empty state fills the view's remaining height and sits in its middle; on a phone, where
  the page scrolls, it keeps 48px above and below.
- **Today's lane panel**: the empty state fills the panel below its heading and sits in its middle, the
  panel keeping its own tint; the work queue beside it uses the compact look.
- **Inside a populated screen** (the patient overview's cards, the timeline's cards and activity, the
  offering ideas, the day-close list, the roles workspace): the compact look, centered in its card.
- **The settings modal** (`#settings/*`): its panels keep the room look they have, in a colorful tone
  instead of grey; its one-line lists (passkeys, payment methods, webhook events) take the compact look.
- **The phone tab bar** never covers it: a view's empty state sits above the bar's offset like every
  other content.
- **Motion:** none added. The empty state appears with the list's existing reveal, if any.
