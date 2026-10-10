import { describe, expect, it } from 'vitest';

import {
  normalizeTaskListQuery,
  TASK_SCOPES,
  TASK_TABS,
  TASK_TYPE_VALUES,
} from '@/shared/api/clinic/tasks-contracts.ts';

import {
  TASK_SCOPE_VALUES,
  TASK_TYPE_FILTER_VALUES,
  TASK_VIEWS,
  validateTasksSearch,
} from './tasks.search.ts';

describe('the contract’s values, declared for the entry chunk', () => {
  it('match the contract’s views, scopes and types', () => {
    expect(TASK_VIEWS).toEqual(TASK_TABS);
    expect(TASK_SCOPE_VALUES).toEqual(TASK_SCOPES);
    expect(TASK_TYPE_FILTER_VALUES).toEqual(TASK_TYPE_VALUES);
  });

  it('cut the search where the list query does', () => {
    const long = 'x'.repeat(100);
    expect(validateTasksSearch({ q: long }).q).toBe(
      normalizeTaskListQuery({ q: long }).q,
    );
  });
});

describe('validateTasksSearch (S:95)', () => {
  it('keeps what the URL can hold and answers every key', () => {
    expect(
      validateTasksSearch({
        tab: 'snoozed',
        q: '  Priti ',
        type: 'confirm,by_hand',
        scope: 'everyone',
      }),
    ).toEqual({
      tab: 'snoozed',
      q: 'Priti',
      type: ['confirm', 'by_hand'],
      scope: 'everyone',
    });
  });

  it('drops what it can’t hold — never an error', () => {
    expect(
      validateTasksSearch({
        tab: 'archived',
        q: '   ',
        // The design's old rule ids are gone with the API's keys (route map §4 #22).
        type: ['payment', 'recall', 'manual', 'follow'],
        scope: 'team',
      }),
    ).toEqual({ tab: undefined, q: undefined, type: undefined, scope: undefined });
  });

  it('reads the old To do id `queue` as To do — the default, out of the URL', () => {
    expect(validateTasksSearch({ tab: 'queue' }).tab).toBeUndefined();
    expect(validateTasksSearch({ tab: 'open' }).tab).toBe('open');
  });
});
