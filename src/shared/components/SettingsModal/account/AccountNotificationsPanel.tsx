import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPreference,
} from '@/shared/api/notification-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { PanelSkeleton } from '@/shared/components/PanelSkeleton/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import { Switch } from '@/shared/components/ui/switch.tsx';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/shared/hooks/useNotifications/index.ts';
import { NOTIFICATION_CATEGORY_LOOK } from '@/shared/notifications/category-look.ts';
import { requestDesktopPermission } from '@/shared/notifications/desktop.ts';

import { SETTINGS_KEYS, SETTINGS_NS } from '../settings.constants.ts';
import { SectionHeader } from '../SettingsPanelShell.tsx';

/**
 * Category and channel rows carry translation KEYS, not English. The labels are
 * resolved at render, so switching locale re-renders them like everything else —
 * a module-level string would have stayed English forever (X-9).
 */
const CATEGORIES: {
  id: NotificationCategory;
  labelKey: string;
  descriptionKey: string;
}[] = [
  {
    id: 'system',
    labelKey: SETTINGS_KEYS.panels.notifications.categories.system,
    descriptionKey: SETTINGS_KEYS.panels.notifications.categories.systemDescription,
  },
  {
    id: 'member',
    labelKey: SETTINGS_KEYS.panels.notifications.categories.member,
    descriptionKey: SETTINGS_KEYS.panels.notifications.categories.memberDescription,
  },
  {
    id: 'billing',
    labelKey: SETTINGS_KEYS.panels.notifications.categories.billing,
    descriptionKey: SETTINGS_KEYS.panels.notifications.categories.billingDescription,
  },
  {
    id: 'security',
    labelKey: SETTINGS_KEYS.panels.notifications.categories.security,
    descriptionKey: SETTINGS_KEYS.panels.notifications.categories.securityDescription,
  },
];

const CHANNELS: { id: NotificationChannel; labelKey: string }[] = [
  { id: 'email', labelKey: SETTINGS_KEYS.panels.notifications.channels.email },
  { id: 'inApp', labelKey: SETTINGS_KEYS.panels.notifications.channels.inApp },
  { id: 'desktop', labelKey: SETTINGS_KEYS.panels.notifications.channels.desktop },
];

/**
 * The matrix's grid, as Roles & access draws its own (H:1133): the kind of
 * update, then one 72px column per channel. It keeps its width and scrolls
 * sideways inside its bordered box on a phone.
 *
 * The matrix is an ARIA table on grid `div`s: every row is a CSS grid, and
 * native `<table>` parts lose their table semantics once their `display` is
 * changed — so the `NOSONAR(S6819)` marks on `role="table"`, `row`,
 * `columnheader`, `rowheader` and `cell` below are deliberate.
 */
const MATRIX_GRID = 'grid grid-cols-[minmax(200px,1fr)_repeat(3,72px)] items-center';

function prefKey(category: NotificationCategory, channel: NotificationChannel): string {
  return `${category}:${channel}`;
}

/** Merge the server matrix with local edits into a full set for full-replace. */
function buildMatrix(
  base: NotificationPreference[],
  overrides: Record<string, boolean>,
): NotificationPreference[] {
  const map = new Map<string, NotificationPreference>();
  for (const p of base) map.set(prefKey(p.category, p.channel), { ...p });
  for (const [key, enabled] of Object.entries(overrides)) {
    const [category, channel] = key.split(':') as [
      NotificationCategory,
      NotificationChannel,
    ];
    map.set(key, { category, channel, enabled });
  }
  return [...map.values()];
}

/**
 * Put one key back the way it was before the failed edit. `undefined` means the
 * key had no override at all, so it must be REMOVED — writing the old value back
 * would pin the switch to a stale copy of server truth instead of following it.
 */
function withRestoredOverride(
  current: Record<string, boolean>,
  key: string,
  previous: boolean | undefined,
): Record<string, boolean> {
  const next = { ...current };
  if (previous === undefined) delete next[key];
  else next[key] = previous;
  return next;
}

/** Drop the keys a successful save committed; anything still local is kept. */
function withoutCommitted(
  current: Record<string, boolean>,
  committedKeys: string[],
): Record<string, boolean> {
  const next = { ...current };
  for (const key of committedKeys) delete next[key];
  return next;
}

/**
 * Notifications preferences — a category × channel (email / in-app / desktop)
 * grid backed by the preferences API (FE-30, full-replace on each change).
 * Local edits are kept as overrides over the server matrix (derived during
 * render — no prop→state effect). Enabling **desktop** first asks for the OS
 * permission (FE-64); if it isn't granted the toggle stays off and a hint shows.
 */
export function AccountNotificationsPanel() {
  const { t } = useTranslation(SETTINGS_NS);
  const {
    data: serverPrefs = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [desktopDenied, setDesktopDenied] = useState(false);
  // Synchronous twin of `update.isPending` — see applyToggle.
  const savingRef = useRef(false);
  // The latest committed values, readable AFTER an await. Everything captured
  // in the render closure is a snapshot of the moment the OS permission prompt
  // opened, and this API is a FULL REPLACE: a matrix built from that snapshot
  // rewrites every other preference back to how it looked before the prompt.
  const overridesRef = useRef<Record<string, boolean>>({});
  const serverPrefsRef = useRef<NotificationPreference[]>(serverPrefs);
  useEffect(() => {
    serverPrefsRef.current = serverPrefs;
  }, [serverPrefs]);

  /** The one write path for the override map — rendered state and ref in step. */
  function commitOverrides(next: Record<string, boolean>): void {
    overridesRef.current = next;
    setOverrides(next);
  }

  function isEnabled(
    category: NotificationCategory,
    channel: NotificationChannel,
  ): boolean {
    const override = overrides[prefKey(category, channel)];
    if (override !== undefined) return override;
    return serverPrefs.some(
      (p) => p.category === category && p.channel === channel && p.enabled,
    );
  }

  async function applyToggle(
    category: NotificationCategory,
    channel: NotificationChannel,
    value: boolean,
  ): Promise<void> {
    // `update.isPending` only disables the switches after React re-renders, so
    // the grid stays live for the frame after the first flick. A second flick in
    // that window paints an override whose write never goes out — the
    // single-flight guard in `useAppMutation` joins the in-flight request rather
    // than sending the new matrix — leaving the UI claiming a preference the
    // server was never told about. This ref flips synchronously and drops it.
    if (savingRef.current) return;

    // Claimed BEFORE the permission prompt, not after it. The prompt is an await
    // the user can leave open indefinitely, and the grid stays live behind it —
    // so a flick landing in that window used to pass this guard and send its own
    // full-replace matrix. This call's continuation then resumed on a pre-prompt
    // snapshot and either (a) rebuilt the matrix without the edit that had just
    // landed, reverting it on the server and visibly flipping the switch back
    // when the seeded cache came through, or (b) — with that save still in
    // flight — raced it with a second full-replace the mutation layer may join
    // and discard rather than send, stranding the optimistic override on a
    // Desktop switch claiming a preference the server never stored.
    savingRef.current = true;
    try {
      if (channel === 'desktop' && value) {
        const permission = await requestDesktopPermission();
        if (permission !== 'granted') {
          setDesktopDenied(true);
          savingRef.current = false;
          return;
        }
        setDesktopDenied(false);
      }

      // Read back through the refs rather than the closure: by the time the
      // prompt resolves, `overrides` and `serverPrefs` above are history.
      const latestOverrides = overridesRef.current;
      const key = prefKey(category, channel);
      // What this key was showing before the flick — restored verbatim if the
      // save fails, including "no override at all".
      const previous = latestOverrides[key];
      const nextOverrides = { ...latestOverrides, [key]: value };
      const committedKeys = Object.keys(nextOverrides);

      commitOverrides(nextOverrides);
      update.mutate(buildMatrix(serverPrefsRef.current, nextOverrides), {
        onSuccess: () => {
          savingRef.current = false;
          // The hook seeded the query cache with the SAVED matrix, so these
          // overrides have done their job. Left behind they shadow server truth
          // for the rest of the session — every later refetch is painted over by
          // a local copy of an edit that already landed.
          commitOverrides(withoutCommitted(overridesRef.current, committedKeys));
        },
        onError: () => {
          savingRef.current = false;
          // The save failed, so the switch must go back to what it was showing.
          // `useAppMutation`'s rollback restores the QUERY CACHE; it knows nothing
          // about this local map, so without this the toggle stays where the user
          // flicked it and silently claims a preference that was never stored.
          commitOverrides(withRestoredOverride(overridesRef.current, key, previous));
        },
      });
    } catch (error) {
      // Every exit releases the latch — including a permission request that
      // rejects. A latch released only on the paths that happen to be exercised
      // leaves the whole grid dead: every later flick returns at the check above
      // and the panel silently stops saving until it remounts.
      savingRef.current = false;
      throw error;
    }
  }

  function handleToggle(
    category: NotificationCategory,
    channel: NotificationChannel,
    value: boolean,
  ): void {
    applyToggle(category, channel, value).catch(() => undefined);
  }

  const panel = SETTINGS_KEYS.panels.notifications;
  return (
    <div className="flex flex-col gap-4" data-testid="settings-section-notifications">
      <SectionHeader title={t(panel.title)} description={t(panel.description)} />
      <SettingsCard
        title={t(panel.deliveryTitle)}
        description={t(panel.deliveryDescription)}
      >
        {isLoading ? <PanelSkeleton testId="notifications-prefs-loading" /> : null}

        {isError ? (
          <div data-testid="notification-prefs-error">
            <RetryError
              message={t(panel.loadFailed)}
              onRetry={() => {
                void refetch();
              }}
              isRetrying={isFetching}
            />
          </div>
        ) : null}

        {!(isLoading || isError) ? (
          <>
            {/* The Roles & access matrix (`users.md:59–69`; H:1131–1136): each
                kind of update a row — its 26px tone tile, name and description —
                and a switch per channel. */}
            <div className="[scrollbar-width:thin] overflow-x-auto rounded-xl border">
              <div // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
                role="table"
                aria-label={t(panel.deliveryTitle)}
                className="min-w-110"
              >
                <div // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
                  role="row"
                  tabIndex={-1}
                  className={cn(
                    MATRIX_GRID,
                    'bg-canvas text-tiny text-muted-foreground h-9 border-b px-3 font-semibold tracking-[0.04em] uppercase',
                  )}
                >
                  <span // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
                    role="columnheader"
                    tabIndex={-1}
                  >
                    {t(panel.kind)}
                  </span>
                  {CHANNELS.map((ch) => (
                    <span // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
                      key={ch.id}
                      role="columnheader"
                      tabIndex={-1}
                      className="text-center"
                    >
                      {t(ch.labelKey)}
                    </span>
                  ))}
                </div>
                {CATEGORIES.map((cat) => {
                  const look = NOTIFICATION_CATEGORY_LOOK[cat.id];
                  return (
                    <div // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
                      key={cat.id}
                      role="row"
                      tabIndex={-1}
                      className={cn(
                        MATRIX_GRID,
                        'border-b-muted hover:bg-canvas min-h-12 border-b px-3 transition-colors duration-150 last:border-b-0',
                      )}
                    >
                      <span // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
                        role="rowheader"
                        tabIndex={-1}
                        className="flex min-w-0 items-center gap-2.5 py-1.5"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex size-6.5 shrink-0 items-center justify-center rounded-md',
                            TONE_CLASSES[look.tone].surface,
                          )}
                        >
                          <look.icon className="size-3.5" />
                        </span>
                        <span className="flex min-w-0 flex-col leading-[1.3]">
                          <span className="text-body leading-[1.3] font-semibold">
                            {t(cat.labelKey)}
                          </span>
                          <span className="text-caption text-muted-foreground truncate">
                            {t(cat.descriptionKey)}
                          </span>
                        </span>
                      </span>
                      {CHANNELS.map((ch) => (
                        <span // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
                          key={ch.id}
                          role="cell"
                          className="flex justify-center"
                        >
                          <Switch
                            checked={isEnabled(cat.id, ch.id)}
                            onCheckedChange={(value) =>
                              handleToggle(cat.id, ch.id, value)
                            }
                            // The whole grid, not just this switch: the API is a
                            // full replace, so a second edit mid-save has no
                            // payload of its own to send.
                            disabled={update.isPending}
                            aria-label={`${t(cat.labelKey)} — ${t(ch.labelKey)}`}
                            data-testid={`notify-${cat.id}-${ch.id}`}
                          />
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
            {desktopDenied ? (
              <output className="text-muted-foreground block text-xs leading-[1.45]">
                {t(panel.desktopDenied)}
              </output>
            ) : null}
          </>
        ) : null}
      </SettingsCard>
    </div>
  );
}
