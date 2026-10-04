import { describe, expect, it } from 'vitest';

import { taskDrawerColumns } from './task-drawer-columns.ts';

describe('taskDrawerColumns (KICKOFF §6.10; tasks.md › Task drawer › Size)', () => {
  it('splits 900 into 480 + 420 at 1440 and 1024', () => {
    expect(taskDrawerColumns(1440)).toEqual({
      total: 900,
      task: 480,
      chat: 420,
    });
    expect(taskDrawerColumns(1024)).toEqual({
      total: 900,
      task: 480,
      chat: 420,
    });
  });

  it('narrows the chat on a tablet: 780 = 409 + 371 at 820, 728 = 368 + 360 at 768', () => {
    expect(taskDrawerColumns(820)).toEqual({
      total: 780,
      task: 409,
      chat: 371,
    });
    expect(taskDrawerColumns(768)).toEqual({
      total: 728,
      task: 368,
      chat: 360,
    });
  });

  it('follows the width last dragged in the lead drawer, inside the room it has', () => {
    expect(taskDrawerColumns(1440, 500)).toEqual({
      total: 900,
      task: 400,
      chat: 500,
    });
    expect(taskDrawerColumns(1440, 680).chat).toBe(580);
    expect(taskDrawerColumns(1440, 360).chat).toBe(360);
  });
});
