# `pages/organization/$organizationSlug/today` — Today

Route: `/organization/$organizationSlug/today`. The clinic floor now — who is enquiring,
arriving, waiting, with the doctor, in treatment, at checkout and at the pharmacy — with the
desk's work queue beside it (KICKOFF §6.2; L-48).

Gated like every clinic room: membership (`organization:read`) and the `app-today` module
(on in production since Today and Tasks left `FIXTURE_BACKED_APP_MODULES`, D155), then
`requireOrgStatus`; every role sees Today. In-room actions follow `useAppAccess`
(KICKOFF §3.7): "New booking" needs Leads Create, "Book" Leads View, "Check in" and "Send in"
Appointments Edit, "Walk-in" Appointments Create, "Open session" Patients View and the treatments gate (Doctor, Therapist),
"Checkout" Patients View and `payment:create`, "Dispense" Medical Create — each is hidden
without it. With doctor has no action (L-64): the consult is the patient's own page. The work
queue needs `task:read` (the Accountant holds no task code) and its outcomes their own codes (`task:update` and each outcome's record
codes — `visibleTaskOutcomes`); a View-as preview reads it and runs none. The lanes follow
codes too (D163, `readableTodayLanes`): Enquiries needs `lead:read`, the six floor lanes
`appointment:read`; a lane the member cannot read has no tile and reads nothing (Marketing sees
Enquiries alone), and a member with neither (the Accountant) gets one line —
`today-no-lanes` — in place of the tiles and the panel.

The screen (change-today-command-center): the greeting is its h1 — no other title ("Good
morning, <first name>" on the clinic-local clock, `greetingFor`; "there" without a name) — over
the pulse after a live dot ("● <n> in clinic · <n> waiting · <n> arriving · <day>, <time>"); at
the inline end the floor finder, the keyboard button (the app's shortcuts list), "Walk-in" (→ ⌘K)
and the primary "New booking" (→ `/leads/create`). Then **Needs you now** — the people who need
someone now, ranked (`today.attention.ts`): late arrivals (5 min past the start; hot from 15),
arrivals due in the next 10 minutes, waits from 15 min (hot 30), consults from 30 (hot 45),
everyone at checkout ("₹n to pay"), an approved Rx, enquiries with no reply for 30 min (hot
2 h); hot, then warm, then soon, the longest overdue first. Only the member's focus lanes (Owner
and Admin: every readable lane). A row: the urgency chip, the name (opens them, as a card's), the
lane chip (opens the lane and spotlights the card) and the lane's own action; three rows, then
"Show n more"; nothing urgent, "All calm — no one is waiting on you.". Then the **journey strip**
— up to seven lane tiles joined by chevrons in one row (each at least 116px from `md`, a snap
strip of 128px tiles below it; the row scrolls with snap where seven do not fit), each tile's
count wearing an alert badge for its late, long-waiting, long-in-room or unanswered people
(blush when any is hot) — over the selected lane's panel of visit cards; lanes outside the
member's role focus recede — the fill
at 60%, the text a step lighter at AA contrast (`todayFocus`: the union of their clinic roles,
the View-as role while previewing; Owner and Admin dim nothing). The default lane is the first in focus with people, else the first with
people, else the first lane shown; a picked lane lives in the URL for the session (`?lane=`).
An Arriving card says "Late n min", "Due now" or "In n min" (within the hour) before Confirmed;
a Waiting or With-doctor card carries a wait meter (sage → butter → blush, full at the hot
mark) and a hot wait's flag turns blush. The **floor finder** ("Find on the floor") is a combobox
over the floor: a name's word from its start (accents ignored) or 3+ phone digits, up to eight
results with their lane and time; ↑ ↓ Enter Escape; a pick opens the lane and spotlights the
card (scrolled into view, focus on its name, a 2s ring); no match offers "Search all contacts"
(⌘K). Keys on Today (`hooks/useTodayShortcuts/`): `/` find, `[` `]` the previous and next lane
(round the ends), `N` New booking, `W` Walk-in — never in a field, an open list or a dialog, never
with a modifier; the app's `?`, `G`, digits and ⌘K keep theirs, and its shortcuts list names the
Today rows. The work
queue (`?queue=everyone`; Mine by default — the member's tasks and the unowned ones in their
roles' queues, the server's `scope=mine`) is the Tasks room's one task model: its open tasks by
due time and the ones closed today, the type's pill and the outcomes the member can run, the
shared due labels, the owner by name from the team ("Riya (you)", "Kiran P."), a role's queue
("Front desk", research-tasks Q3) or "Anyone"; "<n> open" counts every open task, whoever owns
it. An outcome runs the Tasks room's plan (`useTaskOutcome`: the record writes, then the
task's resolve or snooze), closes the card in place ("✓ <result>", or "Snoozed · <label>"; each
line a text step lighter — the design's 70%, kept at AA contrast; a task the server closed reads
"Done by Clinozy" as its due label alone) and toasts "<name>: <result>" — no Undo, the API has
no way back (Q7); a task someone — or the rules — closed first says so and reads the queue
again. A booking follow-on stacks the shared appointment form over Today
(`components/TodayBooking/`) for the person's contact (`who=con_…`), a record follow-on (a
check-in or review on the patient file, the person's file or lead) navigates. "What’s next"
chains only in the Tasks room.

Data — clinozy-be (`src/shared/api/app/today-api.ts`, api-integration §5.1, D149): every
page of the day's scheduled, confirmed and checked-in bookings (`GET /app/appointments`, the
header's branches from the member's preferences, D32), the doctors' and rooms' names (one
read per set, cached) and — for a member holding `patient_prescription:read` — the pharmacy
queue's approved Rx by appointment; the enquiries awaiting a reply whose latest activity is
today (`GET /app/leads`, for a member who sees Leads). Both poll every 60s, wait for the
member's access, and are refetched by every booking or lead write. The work queue reads
`GET /app/tasks?tab=open&scope=mine|everyone` and today's `tab=done` (every page, the header's
branches as `branch_id`, each page's people from `GET /app/contacts?ids=`) and "<n> open" from
`GET /app/tasks?tab=open&scope=everyone&limit=1` (`useTaskList`, `useOpenTaskCount`; polled every
60s); owner names from the team directory (`GET /app/memberships`), "(you)" from the member's
membership. A check-in, its Undo and every booking write ask the server's rules to run, so the
queue reads its tasks again 1.5s after them (`useRefreshTasksAfterRules`, D81 T7) — an
Arriving task closes, a rebook opens. A card's lane is its
booking's `status` and `visit_stage` (`todayLaneOf`); the pulse is counted from the floor. "Check
in" is `POST …/check-in` (the server opens the patient file and moves the open lead to
Clinic visited) with an Undo (`POST …/undo-check-in`, while the visit waits); "Send in" is
`POST …/stage` to `with_doctor` — forward only, so no Undo; each carries the action's
idempotency key and a refusal toasts the server's words. "Open session" and "Checkout" open
the patient's own page with the visit flow (`patients/$patientId/timeline?visit=open&from=today`,
§6.6), and the flow's Pause / Complete visit come back here, focus on the card's action
(`today.focus.ts`). The design's first visit, pack, dues, allergies and the enquiry's words
have no field in the API and are not shown (G1). A Checkout card — and its Needs-you-now row —
says "₹1,500 to pay": what the person still owes on today's open invoices at the header's
branches, read while anyone is at checkout (`hooks/useCheckoutDues/`, `payment:read`; G-P17). The role focus
still reads the member's clinic roles from the Users room's staff profiles (fixtures until
Users moves, G5) — it only dims lanes. A failed read toasts "Couldn’t load this list · connection dropped. Showing
the last copy." with Retry and keeps the last copy; the first load wears the in-place skeleton.

## Files

| File                        | Responsibility                                                                                                                                                                                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `today.route.tsx`           | Route marker — exports `Component` rendering `TodayPage`.                                                                                                                                                                                                                                                   |
| `today.manifest.ts`         | Manifest — `kind: 'leaf'`, permission `organization:read`, module `app-today`, nav section `today`.                                                                                                                                                                                                         |
| `today.search.ts`           | URL schema (`validateSearch`): `lane` (one of the seven), `queue` (`mine`, `everyone`) — entry-resident, so built on `src/lib/routes/search-params.ts` only.                                                                                                                                                |
| `today.constants.ts`        | `TODAY_NS` / `TODAY_KEYS` (the `today` namespace; the work queue's rule copy is the `tasks` namespace's), `TODAY_TEST_IDS`.                                                                                                                                                                                 |
| `today.lanes.ts`            | Pure: the lanes' tones and actions, the tile paint, `groupTodayLanes`, `todayFocus` / `isLaneInFocus`, `defaultTodayLane`, `laneHint`, `laneFaces`, `todayPulse`.                                                                                                                                           |
| `today.flags.ts`            | Pure: a card's flags from its record (`todayCardFlags`: channel, new lead, late / due now / in n min, confirmed, minutes waiting or in the room, the Rx) and their tones; the clocks (`minutesToStart`, `stageMinutes`, `waitMinutes`), wait levels and the wait meter.                                     |
| `today.attention.ts`        | Pure: Needs you now (`todayAttention`: items, tiers, ranking, the focus filter) and the strip's alert badges (`todayLaneAlerts`).                                                                                                                                                                           |
| `today.finder.ts`           | Pure: the floor finder's matching (`findOnFloor`: a name's word from its start, accents ignored, or phone digits).                                                                                                                                                                                          |
| `today.focus.ts`            | The card whose lane action opened the patient's visit flow, remembered for its panel to focus again (memory only, handed out once).                                                                                                                                                                         |
| `TodayPage.tsx`             | Room page — greeting row, Needs you now, the strip, panel, work queue, the stacked booking form; the floor navigation (a pick spotlights its card, `[` `]` step lanes), the page's checkout-bills read and the keys. Owns `data-testid="today-page"`.                                                       |
| `components/TodayGreeting/` | The greeting (the page's h1), the live dot and pulse, the finder slot, the keyboard button, "Walk-in" and the primary "New booking".                                                                                                                                                                        |
| `components/NeedsYouNow/`   | Needs you now: the ranked rows (chip, name, lane chip, context, the lane's action), "Show n more", the calm line.                                                                                                                                                                                           |
| `components/FloorFinder/`   | The floor finder: a combobox on the rooms' `RoomSearchField` over a listbox of results; no match → "Search all contacts".                                                                                                                                                                                   |
| `components/LaneTiles/`     | The journey strip: seven tiles joined by chevrons in one row — count and its alert badge, faces, hint, focus dimming; snap where it scrolls.                                                                                                                                                                |
| `components/LanePanel/`     | The selected lane's panel and its visit cards — timing flags, the wait meter, the spotlight (`data-spotlight`).                                                                                                                                                                                             |
| `hooks/useCardServiceLine/` | A card's second line (service and room or doctor, an Rx's medicines, an enquiry's interest) — shared by the panel, Needs you now and the finder.                                                                                                                                                            |
| `hooks/useTodayShortcuts/`  | Today's keys: `/`, `[`, `]`, `N`, `W` (`todayShortcut` pure), never in a field, a list or a dialog.                                                                                                                                                                                                         |
| `components/WorkQueue/`     | The work queue aside: header, Mine · Everyone, task cards with the outcomes the member can run, or their result.                                                                                                                                                                                            |
| `components/TodayBooking/`  | The shared appointment form stacked over Today for a work-queue booking follow-on (lazy chunk, warmed after paint).                                                                                                                                                                                         |
| `hooks/useTodayFloorView/`  | The floor in the header's branches → lanes, pulse, loading; the list-error toast.                                                                                                                                                                                                                           |
| `hooks/useFloorActions/`    | The cards' lane actions (gated) and the name-area open; Dispense opens New sale on the Rx and its patient (`?prescription=&customer=`, Today the way back); the saved sale refreshes the floor, so the card loses Dispense.                                                                                 |
| `hooks/useCheckoutDues/`    | Today's open bills by person — the Checkout cards' "₹n to pay" (one read while the lane is open, `payment:read`).                                                                                                                                                                                           |
| `hooks/useWorkQueue/`       | The work queue on clinozy-be: To do and today's Done in the scope and the header's branches, "<n> open", the outcome write (no Undo), its toast, the refusal's words and the follow-on.                                                                                                                     |
| `__tests__/integration/`    | The room end to end over doubles of the floor's and the queue's api modules (`__tests__/integration/today-room.test.tsx`), its router — View-as a role or a member by codes (`__tests__/integration/today-test-router.tsx`) — and the floor and queue builders (`__tests__/integration/today-fixtures.ts`). |

## Test ids

`today-page`, `today-greeting`, `today-pulse`, `today-new-booking`, `today-walk-in`,
`today-shortcuts`, `today-finder`, `today-finder-input`, `today-finder-results`,
`today-finder-result`, `today-finder-none`, `today-finder-everyone`, `today-attention`,
`today-attention-row` (`data-kind`, `data-tier`), `today-attention-open`, `today-attention-jump`,
`today-attention-action`, `today-attention-more`, `today-attention-calm`,
`today-lanes`, `today-lane-<lane>` (`enquiries`, `arriving`, `waiting`, `with-doctor`,
`treatment`, `checkout`, `pharmacy`; `aria-pressed`, `data-dimmed`), `today-lane-alert`
(`data-hot`), `today-panel` (`data-lane`), `today-card` (`data-card-id`, `data-spotlight`),
`today-card-open`, `today-card-wait` (`data-level`), `today-card-action` (`data-action`),
`today-empty`, `today-queue`, `today-queue-scope-<mine|everyone>`,
`today-queue-card` (`data-task-id`, `data-closed`), `today-queue-outcome` (`data-outcome`),
`today-queue-empty`, `today-booking-error`, `today-no-lanes` — listed in `docs/reference/e2e-testids-inventory.md`
› Today.
