import {
  type Notification,
  notificationCategorySchema,
  type NotificationPreference,
} from '@/shared/api/notification-contracts.ts';

/** Test-only notification preference defaults for component tests. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreference[] =
  notificationCategorySchema.options.flatMap((category) => [
    { category, channel: 'email', enabled: true },
    { category, channel: 'inApp', enabled: true },
    { category, channel: 'desktop', enabled: false },
  ]);

/** Optional sample inbox rows for notification UI tests. */
export const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: 'ntf_000000000000000000001',
    category: 'member',
    title: 'New member joined',
    body: 'Ada Byron accepted your invitation.',
    isRead: false,
    href: '#settings/organization/members',
    actionLabel: 'View members',
    createdAt: '2026-06-23T09:00:00.000Z',
  },
];
