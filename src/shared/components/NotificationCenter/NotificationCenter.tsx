import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Notification } from '@/shared/api/notification-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { settingsHash } from '@/shared/components/SettingsModal/settings-hash-grammar.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/shared/hooks/useNotifications/index.ts';
import { Bell, BellOff, Settings } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { NOTIFICATION_CATEGORY_LOOK } from '@/shared/notifications/category-look.ts';

/** Mark-all-read header action — hidden entirely when the inbox is empty. */
function MarkAllReadButton({
  count,
  unread,
  pending,
  onMarkAll,
}: {
  count: number;
  unread: number;
  pending: boolean;
  onMarkAll: () => void;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  if (count === 0) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-caption text-muted-foreground-strong h-7 px-2"
      disabled={unread === 0 || pending}
      onClick={onMarkAll}
      data-testid="notification-mark-all"
    >
      {t(LAYOUT_KEYS.app.notifications.markAllRead)}
    </Button>
  );
}

/** The bell's unread count — nothing at zero, capped at "9+". */
function UnreadBadge({ unread }: { unread: number }) {
  if (unread <= 0) return null;
  return (
    <span
      data-slot="pill"
      className="bg-primary text-primary-foreground text-tiny absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-semibold tabular-nums"
      data-testid="notification-badge"
    >
      {unread > 9 ? '9+' : unread}
    </span>
  );
}

/**
 * One inbox row, as an All sections row (`shell.md:43`): the category's 28px
 * tone tile, the title 13px (600 while unread, with the green unread dot), the
 * body 11.5px muted, and when — by the rooms' one time rule ("10:30 am",
 * "Yesterday 4:10 pm", "24 Sep").
 */
function NotificationRow({
  item,
  onClick,
}: {
  item: Notification;
  onClick: (item: Notification) => void;
}) {
  const clock = useClinicClock();
  const look = NOTIFICATION_CATEGORY_LOOK[item.category];
  return (
    <li>
      <button
        type="button"
        data-slot="menu-item"
        onClick={() => onClick(item)}
        className="hover:bg-muted flex w-full min-w-0 items-start gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors duration-120 outline-none"
        data-testid={`notification-${item.id}`}
      >
        <span
          className={cn(
            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg',
            TONE_CLASSES[look.tone].surface,
          )}
          aria-hidden="true"
        >
          <look.icon className="size-3.5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span
              dir="auto"
              className={cn(
                'text-body min-w-0 flex-1 truncate leading-[1.35]',
                item.isRead ? 'font-medium' : 'font-semibold',
              )}
            >
              {item.title}
            </span>
            {item.isRead ? null : (
              <span
                className="bg-success size-1.5 shrink-0 rounded-full"
                aria-hidden="true"
              />
            )}
          </span>
          <span className="text-caption text-muted-foreground line-clamp-2 leading-[1.4]">
            {item.body}
          </span>
          <span className="text-micro text-muted-foreground tabular-nums">
            <time dateTime={item.createdAt}>{clock.moment(item.createdAt)}</time>
          </span>
        </span>
      </button>
    </li>
  );
}

/** The popover's scrolling body: loading, error (with retry), empty, or the list. */
function NotificationInbox({
  items,
  isLoading,
  isError,
  isFetching,
  onRetry,
  onItemClick,
}: {
  items: Notification[] | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
  onItemClick: (item: Notification) => void;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <div className="max-h-[24rem] overflow-y-auto overscroll-contain">
      {isLoading ? (
        // The rows' own shape in flat bars: a tile, the title and a line.
        <div className="flex flex-col gap-0.5 p-1.5" data-testid="notifications-loading">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              aria-hidden="true"
              className="flex items-start gap-2.5 px-2.5 py-2"
            >
              <SkeletonBar shape="field" className="size-7 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                <SkeletonBar index={index} />
                <SkeletonBar index={index + 1} className="h-[0.6em]" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {isError ? (
        <div className="p-4" data-testid="notifications-query-error">
          <RetryError
            message={t(LAYOUT_KEYS.app.notifications.loadError)}
            onRetry={onRetry}
            isRetrying={isFetching}
          />
        </div>
      ) : null}

      {items && items.length === 0 ? (
        <EmptyState
          tone="stone"
          className="pt-7 pb-8"
          icon={<BellOff />}
          title={t(LAYOUT_KEYS.app.notifications.emptyTitle)}
          description={t(LAYOUT_KEYS.app.notifications.emptyDescription)}
        />
      ) : null}

      {items && items.length > 0 ? (
        <ul className="flex flex-col gap-0.5 p-1.5" data-testid="notifications-list">
          {items.map((item) => (
            <NotificationRow key={item.id} item={item} onClick={onItemClick} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Notification center — header bell with an unread badge that opens a **popover**
 * inbox. Each row carries a category glyph (tinted while unread), title, body, and
 * locale-formatted time; unread rows mark themselves read on click. Data: useNotifications.
 */
export function NotificationCenter({
  open: openProp,
  onOpenChange,
  children,
}: {
  /** Controlled open state — a shell with no bell opens the inbox from a menu row. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * The element the inbox anchors to INSTEAD of the bell (the section bar has
   * no bell: its Account menu row opens the inbox under the avatar).
   */
  children?: ReactNode;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };
  const navigate = useNavigate();
  const {
    data: items,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useNotifications({
    isInboxOpen: open,
  });
  const { data: unread = 0 } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  // One row, one PATCH. `markRead.isPending` is React state and is shared by
  // every row anyway, so it can neither stop a double-click on one row nor
  // allow a legitimate click on another. The ref is per id and flips
  // synchronously (agent-os/rules/fe-resilient-interactions.mdc section 1).
  const markingRef = useRef(new Set<string>());

  function handleItemClick(item: Notification) {
    if (item.isRead || markingRef.current.has(item.id)) return;
    markingRef.current.add(item.id);
    markRead.mutate(item.id, {
      onSettled: () => markingRef.current.delete(item.id),
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {children === undefined ? (
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              unread > 0
                ? t(LAYOUT_KEYS.app.notifications.ariaWithUnread, { count: unread })
                : t(LAYOUT_KEYS.app.notifications.ariaDefault)
            }
            data-testid="notification-bell"
          >
            <Bell className="h-4 w-4" />
            <UnreadBadge unread={unread} />
          </Button>
        </PopoverTrigger>
      ) : (
        <PopoverAnchor asChild>{children}</PopoverAnchor>
      )}

      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        // A design popover (the Team / Contact card's frame, `_patterns.md:216`):
        // 12px corners, the panel elevation, a hairline head and a canvas foot.
        className="data-[state=open]:animate-dropdown-in w-88 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl p-0"
        data-testid="notification-popover"
      >
        <div className="flex items-center justify-between gap-2 border-b px-3.5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <p className="text-field leading-[1.3] font-semibold">
              {t(LAYOUT_KEYS.app.notifications.title)}
            </p>
            {unread > 0 ? (
              <TonePill tone="inverse" size="xs" className="tabular-nums">
                {t(LAYOUT_KEYS.app.notifications.newBadge, { count: unread })}
              </TonePill>
            ) : null}
          </div>
          <MarkAllReadButton
            count={items?.length ?? 0}
            unread={unread}
            pending={markAll.isPending}
            onMarkAll={() => markAll.mutate()}
          />
        </div>

        <NotificationInbox
          items={items}
          isLoading={isLoading}
          isError={isError}
          isFetching={isFetching}
          onRetry={() => {
            void refetch();
          }}
          onItemClick={handleItemClick}
        />

        {items && items.length > 0 ? (
          <div className="bg-canvas border-t p-1.5">
            <button
              type="button"
              data-slot="menu-item"
              onClick={() => {
                setOpen(false);
                void navigate({
                  to: '.',
                  hash: settingsHash('account', 'notifications'),
                });
              }}
              className="text-muted-foreground-strong hover:text-foreground hover:bg-muted text-caption flex w-full items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-colors outline-none"
              data-testid="notification-settings-link"
            >
              <Settings className="size-3.5" aria-hidden="true" />
              {t(LAYOUT_KEYS.app.notifications.settingsLink)}
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
