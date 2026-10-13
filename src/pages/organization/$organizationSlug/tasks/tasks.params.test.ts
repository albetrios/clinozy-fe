import { describe, expect, it } from 'vitest';

import { taskListQuery } from '@/shared/api/app/tasks-api.ts';

import { taskListQueryOf } from './tasks.params.ts';

describe('taskListQueryOf', () => {
  it('reads To do, Mine, every type, no search and every branch when nothing is set', () => {
    expect(taskListQueryOf({})).toEqual({ tab: 'open', scope: 'mine', type: [], q: '' });
  });

  it('hands the URL’s view, scope, types and search to the list read', () => {
    expect(
      taskListQueryOf({ tab: 'done', scope: 'everyone', type: ['by_hand'], q: 'Rhea' }),
    ).toEqual({ tab: 'done', scope: 'everyone', type: ['by_hand'], q: 'Rhea' });
  });

  it('narrows the read to the header’s branches (D32)', () => {
    const query = taskListQueryOf({}, ['brn_vesu', 'brn_adajan']);
    expect(query.branchIds).toEqual(['brn_vesu', 'brn_adajan']);
    expect(taskListQuery(query)).toMatchObject({
      tab: 'open',
      scope: 'mine',
      branch_id: 'brn_adajan,brn_vesu',
    });
    expect(taskListQuery(taskListQueryOf({})).branch_id).toBeUndefined();
  });

  it('sends the type filter as the API’s rules and kinds (T6)', () => {
    expect(
      taskListQuery(taskListQueryOf({ type: ['by_hand', 'confirm', 'reply'] })),
    ).toMatchObject({ rule_key: 'reply,confirm', kind: 'follow_up,manual' });
  });
});
