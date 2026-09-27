import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock, patchMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  putMock: vi.fn(),
}));
vi.mock('@/core/http/fetch-client.ts', () => ({
  apiClient: { get: getMock, post: postMock, patch: patchMock, put: putMock },
}));

import {
  getNotificationPreferences,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from './notifications-api.ts';

const NTF = `ntf_${'0'.repeat(20)}1`;
// clinozy-be wire since #964: canonical dotted `type`, `message`, `action_url`.
const WIRE = {
  id: NTF,
  type: 'membership.invite_accepted',
  title: 'T',
  message: 'B',
  data: null,
  action_url: null,
  action_label: null,
  is_read: false,
  read_at: null,
  created_at: '2026-06-23T09:00:00.000Z',
};

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  patchMock.mockReset();
  putMock.mockReset();
});

describe('notifications-api', () => {
  it('lists and maps wire → domain', async () => {
    getMock.mockResolvedValue({ data: [WIRE] });
    const result = await listNotifications();
    expect(getMock).toHaveBeenCalledWith(
      expect.stringContaining('/notify/notifications'),
    );
    expect(result).toEqual([
      {
        id: NTF,
        category: 'member',
        title: 'T',
        body: 'B',
        isRead: false,
        href: null,
        actionLabel: null,
        createdAt: '2026-06-23T09:00:00.000Z',
      },
    ]);
  });

  it('buckets an unknown dotted type by prefix instead of dropping the row', async () => {
    // Forward-compat: a type clinozy-fe doesn't know yet must still reach the bell.
    getMock.mockResolvedValue({
      data: [{ ...WIRE, type: 'billing.refund_issued' }],
    });
    const [row] = await listNotifications();
    expect(row?.category).toBe('billing');
  });

  it('reads the unread-count envelope', async () => {
    getMock.mockResolvedValue({ data: { count: 5 } });
    await expect(getUnreadCount()).resolves.toBe(5);
  });

  it('marks one read via PATCH', async () => {
    patchMock.mockResolvedValue({ data: null });
    await markNotificationRead(NTF);
    expect(patchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/notify/notifications/${NTF}/read`),
      {},
    );
  });

  it('marks all read via POST', async () => {
    postMock.mockResolvedValue({ data: null });
    await markAllNotificationsRead();
    expect(postMock).toHaveBeenCalledWith(
      expect.stringContaining('/notify/notifications/mark-all-read'),
      {},
    );
  });
});

describe('notification preferences', () => {
  it('maps the clinozy-be wire shape (notification_type/IN_APP/is_enabled) to the domain', async () => {
    getMock.mockResolvedValue({
      data: [{ notification_type: 'member', channel: 'IN_APP', is_enabled: true }],
    });
    const prefs = await getNotificationPreferences();
    expect(prefs).toEqual([{ category: 'member', channel: 'inApp', enabled: true }]);
  });

  it('collapses canonical typed rows into the category grid (SMS ignored, ANY wins)', async () => {
    // Since #964 the backend keys rows by canonical dotted types. Rows collapse
    // to category × channel; a category is on when ANY member type is on; SMS
    // has no UI column and is skipped.
    getMock.mockResolvedValue({
      data: [
        { notification_type: 'security.alert', channel: 'SMS', is_enabled: true },
        {
          notification_type: 'billing.payment_failed',
          channel: 'EMAIL',
          is_enabled: true,
        },
        {
          notification_type: 'billing.usage_threshold',
          channel: 'EMAIL',
          is_enabled: false,
        },
        { notification_type: 'system.welcome', channel: 'IN_APP', is_enabled: false },
      ],
    });
    const prefs = await getNotificationPreferences();
    expect(prefs).toEqual([
      { category: 'billing', channel: 'email', enabled: true },
      { category: 'system', channel: 'inApp', enabled: false },
    ]);
  });

  it('fans a category toggle out to every canonical member type on PUT (was a 400)', async () => {
    // Regression: the PUT once sent the bare category slug, which the enum-
    // validated notification_type now rejects. Each category × channel toggle
    // must expand to one row per canonical member type.
    putMock.mockResolvedValue({
      data: [
        { notification_type: 'security.alert', channel: 'WEB_PUSH', is_enabled: false },
      ],
    });
    const result = await updateNotificationPreferences([
      { category: 'security', channel: 'desktop', enabled: false },
      { category: 'member', channel: 'email', enabled: true },
    ]);
    expect(putMock).toHaveBeenCalledWith(
      expect.stringContaining('/users/me/notification-preferences'),
      {
        preferences: [
          { notification_type: 'security.alert', channel: 'WEB_PUSH', is_enabled: false },
          {
            notification_type: 'membership.invite_accepted',
            channel: 'EMAIL',
            is_enabled: true,
          },
        ],
      },
    );
    expect(result).toEqual([
      { category: 'security', channel: 'desktop', enabled: false },
    ]);
  });

  it('expands a multi-type category (billing) to all four canonical types', async () => {
    putMock.mockResolvedValue({ data: [] });
    await updateNotificationPreferences([
      { category: 'billing', channel: 'email', enabled: true },
    ]);
    const body = putMock.mock.calls[0]?.[1] as {
      preferences: { notification_type: string }[];
    };
    expect(body.preferences.map((p) => p.notification_type).sort()).toEqual([
      'billing.payment_failed',
      'billing.payment_succeeded',
      'billing.usage_threshold',
      'subscription.updated',
    ]);
  });
});
