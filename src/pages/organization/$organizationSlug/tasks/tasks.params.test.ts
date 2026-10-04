import { describe, expect, it } from 'vitest';

import { taskListQueryOf } from './tasks.params.ts';

describe('taskListQueryOf', () => {
  it('reads To do, Mine, every rule and no search when the URL says nothing', () => {
    expect(taskListQueryOf({})).toEqual({ tab: 'queue', scope: 'mine', type: [], q: '' });
  });

  it('hands the URL’s view, scope, rules and search to the list read', () => {
    expect(
      taskListQueryOf({ tab: 'done', scope: 'everyone', type: ['manual'], q: 'Rhea' }),
    ).toEqual({ tab: 'done', scope: 'everyone', type: ['manual'], q: 'Rhea' });
  });
});
