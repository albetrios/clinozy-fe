# `pages/organization/$organizationSlug/today` — Today

Route: `/organization/$organizationSlug/today`. The clinic floor now — who is enquiring,
arriving, waiting, with the doctor, in treatment, at checkout and at the pharmacy — with the
desk's work queue beside it (KICKOFF §6.2; L-48).

Gated like every clinic room: membership (`organization:read`) and the `clinic-today` module,
then `requireOrgStatus`; every role sees Today. In-room actions follow `useClinicAccess`
(KICKOFF §3.7): "New booking" needs Leads Create, "Book" Leads View, "Check in" and "Send in"
Appointments Edit, the three Visit actions their tab's access (`canUseVisitTab`, §6.13) and
"Dispense" Medical Create — each is hidden without it.

The screen: the greeting is its h1 — no other title ("Good morning, <first name>" on the
clinic-local clock, `greetingFor`; "there" without a name) — then the pulse ("<n> in clinic ·
<n> waiting · <n> arriving · <day>, <time>"), "New booking" (→ `/leads/create`) and "Walk-in"
(→ ⌘K). Seven lane tiles (a grid from `md`, a snap strip of 128px tiles below it) over the
selected lane's panel of visit cards; lanes outside the member's role focus sit at 60%
(`todayFocus`: the union of their clinic roles, the View-as role while previewing; Owner and
Admin dim nothing). The default lane is the first in focus with people, else the first with
people, else Enquiries; a picked lane lives in the URL for the session (`?lane=`). The work
queue (`?queue=everyone`; Mine by default — the tasks the member owns) is the Tasks room's one
task model: its open tasks by due time and the ones closed today, the rule's pill and
outcomes, the shared due labels; an outcome closes the card in place ("✓ <result>", 70%) and
toasts "<name>: <result>" with Undo; a booking follow-on stacks the shared appointment form
over Today (`components/TodayBooking/`), a record follow-on navigates. "What’s next" chains
only in the Tasks room.

Data: `listTodayFloor` (today's bookings joined with their visit, first visit, dues, today's
bill, pack and unfilled Rx) and the open enquiries of today, in the header's branches (the
D32 branch preference), polled every 60s and refetched by every booking, visit, lead or task
write — `src/shared/api/clinic/today-api.ts` on the fixture server (REPLACE_WITH_API). The
lane rule (`todayLaneOf`) is shared with the server; the pulse is derived. "Check in" is the
shared status move (`useSetAppointmentStatus`, optimistic, Undo reverts its side effects);
"Send in" moves the D18 Visit's stage (`useSetVisitStage`, optimistic, Undo — the Visit is
plan-only, `src/shared/api/clinic/visits-*`); "Open consult" · "Open session" · "Checkout"
open the Visit sheet (`../visits/`, L-49) on their tab, and when it closes focus goes back to
the card's action (`today.focus.ts`). A failed read toasts "Couldn’t load this list ·
connection dropped. Showing the last copy." with Retry and keeps the last copy; the first load
wears the in-place skeleton.

## Files

| File                        | Responsibility                                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `today.route.tsx`           | Route marker — exports `Component` rendering `TodayPage`.                                                                                                                                                        |
| `today.manifest.ts`         | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-today`, nav section `today`.                                                                                                           |
| `today.search.ts`           | URL schema (`validateSearch`): `lane` (one of the seven), `queue` (`mine`, `everyone`) — entry-resident, so built on `src/lib/routes/search-params.ts` only.                                                     |
| `today.constants.ts`        | `TODAY_NS` / `TODAY_KEYS` (the `today` namespace; the work queue's rule copy is the `tasks` namespace's), `TODAY_TEST_IDS`.                                                                                      |
| `today.lanes.ts`            | Pure: the lanes' tones and actions, the tile paint, `groupTodayLanes`, `todayFocus` / `isLaneInFocus`, `defaultTodayLane`, `laneHint`, `laneFaces`, `todayPulse`.                                                |
| `today.flags.ts`            | Pure: a card's flags from its record (`todayCardFlags`) and their tones.                                                                                                                                         |
| `today.focus.ts`            | The card whose lane action opened the Visit sheet, remembered for its panel to focus again (memory only, handed out once).                                                                                       |
| `TodayPage.tsx`             | Room page — greeting row, tiles, panel, work queue, the stacked booking form. Owns `data-testid="today-page"`.                                                                                                   |
| `components/TodayGreeting/` | The greeting (the page's h1), the pulse, "New booking" and "Walk-in".                                                                                                                                            |
| `components/LaneTiles/`     | The seven tiles: count, faces, hint, focus dimming; grid from `md`, snap strip below.                                                                                                                            |
| `components/LanePanel/`     | The selected lane's panel and its visit cards (`components/LanePanel/use-card-service-line.ts` words the second line).                                                                                           |
| `components/WorkQueue/`     | The work queue aside: header, Mine · Everyone, task cards with their outcomes or result.                                                                                                                         |
| `components/TodayBooking/`  | The shared appointment form stacked over Today for a work-queue booking follow-on (lazy chunk, warmed after paint).                                                                                              |
| `hooks/useTodayFloorView/`  | The floor in the header's branches → lanes, pulse, loading; the list-error toast.                                                                                                                                |
| `hooks/useFloorActions/`    | The cards' lane actions (gated) and the name-area open.                                                                                                                                                          |
| `hooks/useWorkQueue/`       | The work queue's rows (queue + closed today), Mine, the outcome write, its toast and follow-on.                                                                                                                  |
| `__tests__/integration/`    | The room end to end on the fixture world (`__tests__/integration/today-room.test.tsx`), its router (`__tests__/integration/today-test-router.tsx`) and row builders (`__tests__/integration/today-fixtures.ts`). |

## Test ids

`today-page`, `today-greeting`, `today-pulse`, `today-new-booking`, `today-walk-in`,
`today-lanes`, `today-lane-<lane>` (`enquiries`, `arriving`, `waiting`, `with-doctor`,
`treatment`, `checkout`, `pharmacy`; `aria-pressed`, `data-dimmed`), `today-panel`
(`data-lane`), `today-card` (`data-card-id`), `today-card-open`, `today-card-action`
(`data-action`), `today-empty`, `today-queue`, `today-queue-scope-<mine|everyone>`,
`today-queue-card` (`data-task-id`, `data-closed`), `today-queue-outcome` (`data-outcome`),
`today-queue-empty`, `today-booking-error` — listed in `docs/reference/e2e-testids-inventory.md`
› Today.
