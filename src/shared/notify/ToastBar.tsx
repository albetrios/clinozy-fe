import type * as React from 'react';

import { X } from '@/shared/icons/index.ts';

/**
 * The clinic design's toast (KICKOFF L-20; H:2690, H:4539–4542) — the app's
 * one toast: a bar in `primary` with `primary-foreground` text, no icon, the
 * action as a small outline button ("Undo", "Retry"); its width fits the
 * message. The design draws no close button because every one of its toasts
 * leaves on a timer; a toast with no timer ("Update available") gets a small
 * dismiss × after its action. Presentational and free of Sonner, so the
 * immediate host draws the same bar before Sonner's chunk arrives.
 */
export function ToastBar({
  title,
  description,
  action,
  onAction,
  dismiss,
  onDismiss,
  onButtonPointerDown,
  pending = false,
  alert = false,
}: {
  title: string;
  description?: string;
  action?: { label: string };
  onAction?: () => void;
  /** The dismiss ×, for a toast with no timer; `label` is its accessible name. */
  dismiss?: { label: string };
  onDismiss?: () => void;
  /** Pointer-down on the action or the × (Sonner's swipe handlers must not see it). */
  onButtonPointerDown?: (event: React.PointerEvent) => void;
  /**
   * Drawn by the immediate host, before Sonner. It announces the message
   * itself (an `output`, an alert for failures); under Sonner the toaster's
   * own live region does.
   */
  pending?: boolean;
  /** A failure — announced assertively by the immediate host. */
  alert?: boolean;
}) {
  const message = (
    <>
      {title}
      {description ? <span className="opacity-80"> · {description}</span> : null}
    </>
  );
  return (
    <div
      data-slot="toast"
      data-testid="app-toast"
      data-toast-pending={pending || undefined}
      className="bg-primary text-primary-foreground text-body pointer-events-auto mx-auto flex w-fit max-w-full items-center gap-3.5 rounded-lg px-4 py-2.5 shadow-(--elevation-menu)"
    >
      {pending ? (
        <output role={alert ? 'alert' : undefined} className="block min-w-0">
          {message}
        </output>
      ) : (
        <p className="min-w-0">{message}</p>
      )}
      {action ? (
        <button
          type="button"
          data-slot="button"
          data-testid="toast-action"
          onPointerDown={onButtonPointerDown}
          onClick={onAction}
          className="border-disabled text-border-strong hover:text-primary-foreground text-detail flex-none rounded-lg border px-2.5 py-0.75 font-medium transition-colors"
        >
          {action.label}
        </button>
      ) : null}
      {dismiss ? (
        <button
          type="button"
          data-slot="button"
          data-testid="toast-dismiss"
          aria-label={dismiss.label}
          title={dismiss.label}
          onPointerDown={onButtonPointerDown}
          onClick={onDismiss}
          className="text-border-strong hover:text-primary-foreground -me-1.5 flex size-6 flex-none items-center justify-center rounded-md transition-colors"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
