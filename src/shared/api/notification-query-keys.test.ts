import { describe, expect, it } from 'vitest';

import { notificationQueryKeys } from './notification-query-keys.ts';

describe('notificationQueryKeys', () => {
  it('scopes the inbox + unread count by organization id', () => {
    expect(notificationQueryKeys.list('org_a')).toEqual([
      'notifications',
      'org_a',
      'list',
    ]);
    expect(notificationQueryKeys.unreadCount('org_a')).toEqual([
      'notifications',
      'org_a',
      'unread-count',
    ]);
  });

  it('produces different keys per tenant so notifications never bleed across orgs', () => {
    expect(notificationQueryKeys.list('org_a')).not.toEqual(
      notificationQueryKeys.list('org_b'),
    );
    expect(notificationQueryKeys.unreadCount('org_a')).not.toEqual(
      notificationQueryKeys.unreadCount('org_b'),
    );
  });

  it('keeps preferences user-scoped (org-free) — they live under /users/me', () => {
    expect(notificationQueryKeys.preferences()).toEqual(['notifications', 'preferences']);
  });

  it('exposes a bare prefix that still matches every scoped key for invalidation', () => {
    expect(notificationQueryKeys.list('org_a').slice(0, 1)).toEqual([
      ...notificationQueryKeys.all,
    ]);
    expect(notificationQueryKeys.unreadCount(null).slice(0, 1)).toEqual([
      ...notificationQueryKeys.all,
    ]);
  });
});
