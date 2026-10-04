import { describe, expect, it } from 'vitest';

import {
  CHAT_WIDTH_STEP,
  clampChatWidth,
  leadDrawerWidths,
} from './lead-drawer-widths.ts';

describe('leadDrawerWidths (KICKOFF §6.3, H:4572)', () => {
  it('splits 980 at 1440 into 560 + 420, 963 at 1024 into 543 + 420, 771 at 820 into 400 + 371', () => {
    expect(leadDrawerWidths(1440)).toEqual({ total: 980, details: 560, chat: 420 });
    expect(leadDrawerWidths(1024)).toEqual({ total: 963, details: 543, chat: 420 });
    expect(leadDrawerWidths(820)).toEqual({ total: 771, details: 400, chat: 371 });
  });

  it('takes the dragged width, keeping 400 for the details and at least 360 for the chat', () => {
    expect(leadDrawerWidths(1440, 500)).toEqual({ total: 980, details: 480, chat: 500 });
    expect(leadDrawerWidths(1440, 680)).toEqual({ total: 980, details: 400, chat: 580 });
    expect(leadDrawerWidths(1440, 200)).toEqual({ total: 980, details: 620, chat: 360 });
    expect(leadDrawerWidths(700, 420).chat).toBe(360);
  });
});

describe('clampChatWidth', () => {
  it('holds drag, keys and ARIA to one clamp, 360–680, whole pixels', () => {
    expect(clampChatWidth(300)).toBe(360);
    expect(clampChatWidth(720)).toBe(680);
    expect(clampChatWidth(433.4)).toBe(433);
    expect(CHAT_WIDTH_STEP).toBe(20);
  });
});
