/** The task drawer's width: `min(900px, 100vw − 40px)` (`tasks.md` › Task drawer › Size). */
export const TASK_DRAWER_MAX_WIDTH = 900;

/** What the drawer always leaves of the viewport (room for the floating ×). */
const VIEWPORT_GUTTER = 40;

/** The chat column's default and narrowest widths (the lead drawer's, 360–680). */
const CHAT_DEFAULT = 420;
const CHAT_MIN = 360;

/** The task column never takes the chat's share below this (H:4322: `− 400`). */
const TASK_RESERVE = 400;

/** The drawer's widths at a viewport width: the whole, the task column and the chat column. */
export interface TaskDrawerColumns {
  total: number;
  task: number;
  chat: number;
}

/**
 * The task drawer's two columns from `md` up (KICKOFF §6.10; H:4322): the
 * drawer is `min(900, vw − 40)`; the chat column is the lead drawer's last
 * dragged width (else 420), held to `round(min(980, 0.94 × vw)) − 400` and
 * never under 360; the task column takes the rest. 1440 and 1024: 900 = 480 +
 * 420; 820: 780 = 409 + 371; 768: 728 = 368 + 360.
 */
export function taskDrawerColumns(
  viewportWidth: number,
  chatWidth: number | null = null,
): TaskDrawerColumns {
  const total = Math.min(TASK_DRAWER_MAX_WIDTH, viewportWidth - VIEWPORT_GUTTER);
  const room = Math.round(Math.min(980, 0.94 * viewportWidth)) - TASK_RESERVE;
  const chat = Math.max(CHAT_MIN, Math.min(chatWidth ?? CHAT_DEFAULT, room));
  return { total, task: total - chat, chat };
}
