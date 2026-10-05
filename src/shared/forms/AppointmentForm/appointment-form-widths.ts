/**
 * The appointment form's widths (KICKOFF §6.4 Widths; H:5983, H:4572; the
 * width fix, D33 §7.3) — pure, from the viewport width, the lead-chat width
 * preference and whether the chat column shows (Edit, from `md`).
 */

/** The window the drawer always leaves uncovered (room for the floating ×). */
const GUTTER = 56;
/** The form's own range. */
const FORM_MIN = 560;
const FORM_MAX = 760;
/** The chat column's floor, and what it leaves the form at least. */
const CHAT_MIN = 360;
const CHAT_ROOM = 400;
/** The chat's ceiling: `min(980px, 94vw) − 400px`. */
const CHAT_CEILING = 980;
const CHAT_SHARE = 0.94;
/** The chat column's width when the member never dragged the lead chat (H:4572). */
const DEFAULT_CHAT_WIDTH = 420;

/** What the drawer takes from `md` up: the whole panel, the form's share and the chat's. */
export interface AppointmentFormWidths {
  total: number;
  form: number;
  /** 0 without a chat column. */
  chat: number;
}

/**
 * The drawer's widths at a viewport width (`appointmentFormWidths`):
 *
 * - **without the chat** (New, Reschedule): `min(760, max(560, vw − 56))`;
 * - **with it** (Edit): the chat `max(360, min(pref ‖ 420, min(980, 0.94vw) − 400))`
 *   and the form `min(760, max(560, vw − chat − 56))` — and when the two pass
 *   `vw − 56` (the prototype's 931px at 820, its clipped × at 1024) the panel
 *   is `vw − 56`, the chat `max(360, min(chat, total − 400))` and the form
 *   the rest: 548 + 420 at 1024, 400 + 364 at 820, 352 + 360 at 768; from
 *   1,280 nothing changes (760 + 420 at 1440).
 *
 * Widths are whole pixels, rounded down so the panel never passes the room.
 */
export function appointmentFormWidths(
  viewportWidth: number,
  chatPreference: number | null,
  withChat: boolean,
): AppointmentFormWidths {
  const room = viewportWidth - GUTTER;
  if (!withChat) {
    const form = Math.floor(Math.min(FORM_MAX, Math.max(FORM_MIN, room)));
    return { total: form, form, chat: 0 };
  }
  const ceiling = Math.min(CHAT_CEILING, CHAT_SHARE * viewportWidth) - CHAT_ROOM;
  const wanted = Math.max(
    CHAT_MIN,
    Math.min(chatPreference ?? DEFAULT_CHAT_WIDTH, ceiling),
  );
  const form = Math.min(FORM_MAX, Math.max(FORM_MIN, room - wanted));
  if (form + wanted <= room) {
    const chat = Math.floor(wanted);
    const formWidth = Math.floor(form);
    return { total: formWidth + chat, form: formWidth, chat };
  }
  const total = Math.floor(room);
  const chat = Math.floor(Math.max(CHAT_MIN, Math.min(wanted, total - CHAT_ROOM)));
  return { total, form: total - chat, chat };
}
