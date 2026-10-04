import { LEAD_CHAT_WIDTH } from '@/shared/store/useDevicePrefsStore/index.ts';

/** The two panes' widths, in px. */
export interface LeadDrawerWidths {
  total: number;
  details: number;
  chat: number;
}

/** The drawer's cap and its share of the window (H:4572). */
const MAX_TOTAL = 980;
const VIEWPORT_SHARE = 0.94;
/** What the details pane keeps whatever the chat is dragged to. */
const MIN_DETAILS = 400;

/**
 * The lead drawer's panes (KICKOFF §6.3; H:4572, H:6126): total
 * `round(min(980, 0.94 × vw))`; chat `max(360, min(pref ‖ 420, total − 400))`;
 * details the rest — 560 + 420 at 1440, 543 + 420 at 1024, 400 + 371 at 820.
 */
export function leadDrawerWidths(
  viewportWidth: number,
  preferredChat: number | null = null,
): LeadDrawerWidths {
  const total = Math.round(Math.min(MAX_TOTAL, VIEWPORT_SHARE * viewportWidth));
  const chat = Math.max(
    LEAD_CHAT_WIDTH.min,
    Math.min(preferredChat ?? LEAD_CHAT_WIDTH.initial, total - MIN_DETAILS),
  );
  return { total, details: total - chat, chat };
}

/** One step of the resize handle's arrow keys (`leads.md:131`). */
export const CHAT_WIDTH_STEP = 20;

/** A chat width within the one clamp for drag, keys and ARIA: 360–680px (§7.3). */
export function clampChatWidth(width: number): number {
  return Math.min(LEAD_CHAT_WIDTH.max, Math.max(LEAD_CHAT_WIDTH.min, Math.round(width)));
}
