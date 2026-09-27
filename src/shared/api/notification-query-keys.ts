/**
 * TanStack Query keys for the notifications domain (inbox + unread badge).
 *
 * Notifications are tenant-scoped on clinozy-be — a notification belongs to a
 * `(user, organization)` pair, so the same endpoint returns different rows per
 * active org. The inbox + unread count therefore carry the active organization
 * id so switching orgs cannot surface the previous tenant's notifications.
 * `preferences` is genuinely user-scoped (`/users/me/...`) and stays org-free.
 * The bare `all` prefix still invalidates the whole domain.
 */
export const notificationQueryKeys = {
  all: ['notifications'] as const,
  list: (organizationId: string | null) =>
    [...notificationQueryKeys.all, organizationId, 'list'] as const,
  unreadCount: (organizationId: string | null) =>
    [...notificationQueryKeys.all, organizationId, 'unread-count'] as const,
  preferences: () => [...notificationQueryKeys.all, 'preferences'] as const,
};
