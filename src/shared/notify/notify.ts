import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { onceAsync } from '@/lib/lazy-module.ts';

import type { ToastType } from './CustomToast.tsx';
import type * as RuntimeModule from './notify-runtime.tsx';

type NotificationRuntime = typeof RuntimeModule;

export interface NotifyAction {
  label: string;
  onClick: () => void;
}

export interface NotifyOptions {
  /** Stable id to de-dupe or replace an existing toast. */
  id?: string | number;
  description?: string;
  /** Omit for the default lifetime; Infinity persists until dismissed. */
  duration?: number;
  action?: NotifyAction;
  onDismiss?: () => void;
}

/**
 * A toast's lifetime when it names none (KICKOFF §6.0 Timers, T14): 5,200ms,
 * and 9,000ms for a failure — long enough to read and reach its "Retry".
 * Loading toasts stay until they are replaced.
 */
export const TOAST_DURATION_MS = { default: 5_200, error: 9_000 } as const;

/**
 * How long an Undo toast stays: the schema's restore window (`POST
 * …/restore` within 10s — `schema-routes.md:1546`, D32).
 */
export const UNDO_TOAST_DURATION_MS = 10_000;

/** {@link notify.undo}'s options: everything but the action and lifetime, which it owns. */
export interface NotifyUndoOptions extends Omit<NotifyOptions, 'action' | 'duration'> {
  /** Puts back what the toast reports gone — runs when Undo is pressed inside the window. */
  onUndo: () => void;
}

interface PendingToast {
  id: string | number;
  type: ToastType;
  message: string;
  options: NotifyOptions;
}

interface QueuedToast {
  preview: PendingToast;
  publish: (runtime: NotificationRuntime, remainingDuration?: number) => void;
  expiresAt?: number;
  timer?: ReturnType<typeof setTimeout>;
}

const loadRuntime = onceAsync(() => import('./notify-runtime.tsx'));
const queued = new Map<string | number, QueuedToast>();
const listeners = new Set<() => void>();
let runtime: NotificationRuntime | undefined;
let active = false;
let loading = false;
let sequence = 0;
let snapshot: {
  runtime: NotificationRuntime | undefined;
  pending: PendingToast[];
} = { runtime: undefined, pending: [] };

function emit() {
  snapshot = { runtime, pending: [...queued.values()].map((item) => item.preview) };
  for (const listener of listeners) listener();
}

function prepareRuntime() {
  if (runtime || loading) return;
  loading = true;
  void loadRuntime().then(
    (loaded) => {
      runtime = loaded;
      loading = false;
      emit();
    },
    () => {
      // The immediate host retains the real messages and actions on failure.
      // onceAsync forgets rejected imports, so a later notification can retry.
      loading = false;
    },
  );
}

function enqueue(item: QueuedToast) {
  if (active && runtime) {
    item.publish(runtime);
    return;
  }
  const id = item.preview.id;
  clearTimeout(queued.get(id)?.timer);
  const duration = item.preview.options.duration ?? TOAST_DURATION_MS.default;
  if (Number.isFinite(duration)) {
    item.expiresAt = Date.now() + duration;
    item.timer = setTimeout(() => expireQueued(id), duration);
  }
  queued.set(id, item);
  emit();
  prepareRuntime();
}

/**
 * A queued toast outlived its duration before any renderer took it, so it only leaves
 * the queue. The renderer never received it (activation clears these timers), so there
 * is nothing to dismiss there. Calling in anyway reached sonner after a test file's
 * jsdom teardown, where its dismiss needs `requestAnimationFrame`.
 */
function expireQueued(id: string | number) {
  queued.delete(id);
  emit();
}

function show(type: ToastType, message: string, options: NotifyOptions = {}) {
  const id = options.id ?? `core-toast-${++sequence}`;
  // Always explicit: the immediate host and Sonner then expire a toast at the
  // same moment, and a same-id write still replaces a loading toast's Infinity.
  const duration =
    options.duration ??
    (type === 'error' ? TOAST_DURATION_MS.error : TOAST_DURATION_MS.default);
  const resolvedOptions = { ...options, id, duration };
  enqueue({
    preview: { id, type, message, options: resolvedOptions },
    publish: (loaded, remainingDuration) =>
      loaded.show(type, message, {
        ...resolvedOptions,
        ...(remainingDuration === undefined ? {} : { duration: remainingDuration }),
      }),
  });
  return id;
}

function dismiss(id?: string | number) {
  if (id === undefined) {
    for (const item of queued.values()) clearTimeout(item.timer);
    queued.clear();
  } else {
    clearTimeout(queued.get(id)?.timer);
    queued.delete(id);
  }
  runtime?.dismiss(id);
  emit();
  return id;
}

function promise<T>(
  value: Promise<T>,
  messages: { loading: string; success: string; error: string },
) {
  const id = `core-toast-${++sequence}`;
  enqueue({
    preview: {
      id,
      type: 'loading',
      message: messages.loading,
      options: { id, duration: Infinity },
    },
    publish: (loaded) => loaded.promise(value, messages, id),
  });
  const settle = (type: 'success' | 'error') => {
    const pending = queued.get(id);
    if (!pending) return;
    show(type, messages[type], { id });
  };
  void value.then(
    () => settle('success'),
    () => settle('error'),
  );
  return Object.assign(id, { unwrap: () => value });
}

/** Stable notification API; renderer loading never blocks IDs or actions. */
export const notify = {
  success: (message: string, opts?: NotifyOptions) => show('success', message, opts),
  error: (message: string, opts?: NotifyOptions) => show('error', message, opts),
  info: (message: string, opts?: NotifyOptions) => show('info', message, opts),
  warning: (message: string, opts?: NotifyOptions) => show('warning', message, opts),
  loading: (message: string, opts?: NotifyOptions) =>
    show('loading', message, { duration: Infinity, ...opts }),
  /**
   * "<record> removed" with an Undo button, kept up for the restore window
   * ({@link UNDO_TOAST_DURATION_MS}). For a write that already happened and
   * can be reversed (soft delete → restore); a write that waits for the window
   * to close is `notifyDeferredCommit`.
   */
  undo: (message: string, { onUndo, ...opts }: NotifyUndoOptions) =>
    show('success', message, {
      ...opts,
      duration: UNDO_TOAST_DURATION_MS,
      action: {
        label: i18n.t(ERRORS_KEYS.toast.undo, { ns: ERRORS_NS }),
        onClick: onUndo,
      },
    }),
  promise,
  dismiss,
};

/** The host subscribes before draining messages into the optional renderer. */
export const notificationBridge = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => snapshot,
  activate() {
    if (!runtime) return () => {};
    active = true;
    for (const item of queued.values()) {
      clearTimeout(item.timer);
      const remaining =
        item.expiresAt === undefined ? undefined : item.expiresAt - Date.now();
      if (remaining === undefined || remaining > 0) item.publish(runtime, remaining);
    }
    queued.clear();
    emit();
    return () => {
      active = false;
    };
  },
};
