import { type CSSProperties, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';

import { notificationBridge, notify, TOAST_DURATION_MS } from './notify.ts';
import { ToastBar } from './ToastBar.tsx';

/**
 * The stack's bottom edge: 16px above whatever a phone pins to the bottom —
 * the tab bar, a showing notice pill, a mounted floating "New" (the bottom
 * stack in `index.css`, D30) — plus the safe area. From `md` those variables
 * are zero, so it is 16px from the edge.
 */
const BOTTOM_OFFSET =
  'calc(1rem + var(--floating-bottom-offset, 0rem) + var(--floating-notice-height, 0rem) + var(--floating-fab-height, 0rem) + env(safe-area-inset-bottom, 0rem))';
/** The same edge as a whole literal for the immediate host (`AppToaster.test.tsx` pins the two together). */
const PENDING_BOTTOM =
  'bottom-[calc(1rem+var(--floating-bottom-offset,0rem)+var(--floating-notice-height,0rem)+var(--floating-fab-height,0rem)+env(safe-area-inset-bottom,0rem))]';
/** On a phone a toast spans the width less 12px a side — max `calc(100% - 24px)`. */
const PHONE_INSET = '0.75rem';
/**
 * Sonner's stack is 356px wide and our toast 20rem; left as is, a centred
 * toast sat 18px left of centre. The stack takes the toast's width instead
 * (a CSS variable Sonner sets inline, so only its `style` prop reaches it).
 */
const STACK_WIDTH = { '--width': '20rem' } as CSSProperties;

type Pending = ReturnType<typeof notificationBridge.getSnapshot>['pending'];

/** The immediate host: queued toasts, shown with their real actions until Sonner is ready. */
function PendingToasts({
  pending,
  dismissLabel,
}: {
  pending: Pending;
  dismissLabel: string;
}) {
  return (
    <section
      data-sonner-toaster
      className={`pointer-events-none fixed z-[999999999] flex w-[calc(100vw-1.5rem)] flex-col gap-2.5 sm:w-[min(100vw-2rem,20rem)] ${PENDING_BOTTOM} start-1/2 -translate-x-1/2 rtl:translate-x-1/2`}
    >
      {pending.slice(-4).map(({ id, type, message, options }) => (
        <ToastBar
          key={id}
          pending
          alert={type === 'error'}
          title={message}
          description={options.description}
          action={type === 'loading' ? undefined : options.action}
          onAction={() => {
            options.action?.onClick();
            notify.dismiss(id);
          }}
          dismiss={
            options.duration === Number.POSITIVE_INFINITY && type !== 'loading'
              ? { label: dismissLabel }
              : undefined
          }
          onDismiss={() => {
            options.onDismiss?.();
            notify.dismiss(id);
          }}
        />
      ))}
    </section>
  );
}

/**
 * Immediate notification content, upgraded to Sonner once its host is ready.
 * Every toast is the design's bottom bar, centred at the bottom (KICKOFF L-20).
 *
 * The toasts are the top layer: above every drawer, sheet and dialog (Sonner's
 * own `z-index`, matched by the immediate host), and — once the renderer is
 * loaded — inside its layer branch, so a press on a toast ("Undo", "Retry", a
 * swipe) never dismisses the open drawer underneath as an outside press.
 */
export function AppToaster() {
  const { t } = useTranslation(ERRORS_NS);
  const state = useSyncExternalStore(
    notificationBridge.subscribe,
    notificationBridge.getSnapshot,
    notificationBridge.getSnapshot,
  );
  const Renderer = state.runtime?.renderer;
  const Layer = state.runtime?.layer;
  useEffect(() => {
    if (Renderer) return notificationBridge.activate();
  }, [Renderer]);

  const toasts = (
    <>
      {Renderer ? (
        <Renderer
          position="bottom-center"
          gap={10}
          visibleToasts={4}
          duration={TOAST_DURATION_MS.default}
          style={STACK_WIDTH}
          offset={{ bottom: BOTTOM_OFFSET }}
          mobileOffset={{ bottom: BOTTOM_OFFSET, left: PHONE_INSET, right: PHONE_INSET }}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                'pointer-events-auto w-full max-w-[min(100vw-2rem,20rem)] touch-auto max-[600px]:max-w-none',
            },
          }}
        />
      ) : null}
      {state.pending.length > 0 ? (
        <PendingToasts
          pending={state.pending}
          dismissLabel={t(ERRORS_KEYS.toast.dismiss)}
        />
      ) : null}
    </>
  );

  return createPortal(
    Layer ? <Layer data-slot="toast-layer">{toasts}</Layer> : toasts,
    document.body,
  );
}
