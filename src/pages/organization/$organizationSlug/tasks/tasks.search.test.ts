import { describe, expect, it } from 'vitest';

import {
  LISTED_TASK_RULES,
  TASK_SCOPES,
  TASK_TABS,
} from '@/shared/api/clinic/tasks-contracts.ts';

import {
  TASK_SCOPE_VALUES,
  TASK_TYPE_VALUES,
  TASK_VIEWS,
  taskListQueryOf,
  validateTasksSearch,
} from './tasks.search.ts';

describe('the contract’s values, declared for the entry chunk', () => {
  it('match the contract’s views, scopes and the listed rules', () => {
    expect(TASK_VIEWS).toEqual(TASK_TABS);
    expect(TASK_SCOPE_VALUES).toEqual(TASK_SCOPES);
    expect(TASK_TYPE_VALUES).toEqual(LISTED_TASK_RULES);
  });
});

describe('validateTasksSearch (S:95)', () => {
  it('keeps what the URL can hold and answers every key', () => {
    expect(
      validateTasksSearch({
        tab: 'snoozed',
        q: '  Priti ',
        type: 'confirm,rebook',
        scope: 'everyone',
      }),
    ).toEqual({
      tab: 'snoozed',
      q: 'Priti',
      type: ['confirm', 'rebook'],
      scope: 'everyone',
    });
  });

  it('drops what it can’t hold — never an error', () => {
    expect(
      validateTasksSearch({
        tab: 'archived',
        q: '   ',
        type: ['payment', 'recall', 'nonsense'],
        scope: 'team',
      }),
    ).toEqual({ tab: undefined, q: undefined, type: undefined, scope: undefined });
  });

  it('cuts the search to 80 characters (`tasks.md:66`)', () => {
    expect(validateTasksSearch({ q: 'x'.repeat(100) }).q).toHaveLength(80);
  });
});

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
