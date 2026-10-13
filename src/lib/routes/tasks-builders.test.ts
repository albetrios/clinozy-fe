import { describe, expect, it } from 'vitest';

import {
  organizationTask,
  organizationTaskCreate,
  organizationTasks,
} from './tasks-builders.ts';

describe('the Tasks room builders', () => {
  it('build the Tasks room and its task drawer route (S:95, S:97)', () => {
    expect(organizationTasks('acme')).toEqual({
      to: '/organization/$organizationSlug/tasks',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationTask('acme', 'T1')).toEqual({
      to: '/organization/$organizationSlug/tasks/$taskId',
      params: { organizationSlug: 'acme', taskId: 'T1' },
    });
    expect(organizationTaskCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/tasks/create',
      params: { organizationSlug: 'acme' },
    });
  });
});
