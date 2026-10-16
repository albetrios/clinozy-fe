import { Tooltip as TooltipPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils.ts';

/**
 * Local changes to the shadcn tooltip (re-apply after a shadcn refresh): the
 * app's one tooltip (design H:426, H:4467–4472; KICKOFF §3.5). It shows 160ms
 * after hover, never below `md` (H:94 — the aria-label carries the name), for
 * 1,400ms on a touch press, and hides on scroll, wheel, any key or a click.
 * Callers keep the stock API. Its motion (change-motion-consistency): in over
 * 120ms on the strong ease-out from its trigger, out in 100ms, and a tooltip
 * opened while another shows (Radix's `instant-open`) appears with no
 * animation — the delay and the motion are paid once per toolbar.
 */

/** How long a touch press keeps a tooltip up (H:4470). */
const TOUCH_SHOW_MS = 1400;

/** Opens the tooltip for a touch press — set by `Tooltip`, called by its trigger. */
const TouchShowContext = React.createContext<(() => void) | null>(null);

function TooltipProvider({
  delayDuration = 160,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const touchTimer = React.useRef<number | undefined>(undefined);

  const setOpen = React.useCallback(
    (next: boolean) => {
      window.clearTimeout(touchTimer.current);
      if (openProp === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const showForTouch = React.useCallback(() => {
    setOpen(true);
    touchTimer.current = window.setTimeout(() => setOpen(false), TOUCH_SHOW_MS);
  }, [setOpen]);

  // Radix already hides on scroll, Escape and a click; the design also hides on
  // the wheel and on any key (H:4472).
  React.useEffect(() => {
    if (!open) return;
    const hide = () => setOpen(false);
    document.addEventListener('wheel', hide, { capture: true, passive: true });
    document.addEventListener('keydown', hide, { capture: true });
    return () => {
      document.removeEventListener('wheel', hide, { capture: true });
      document.removeEventListener('keydown', hide, { capture: true });
    };
  }, [open, setOpen]);

  React.useEffect(() => () => window.clearTimeout(touchTimer.current), []);

  return (
    <TouchShowContext.Provider value={showForTouch}>
      <TooltipPrimitive.Root
        data-slot="tooltip"
        open={open}
        onOpenChange={setOpen}
        {...props}
      />
    </TouchShowContext.Provider>
  );
}

function TooltipTrigger({
  onPointerDown,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const showForTouch = React.useContext(TouchShowContext);
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      onPointerDown={(event) => {
        onPointerDown?.(event);
        // Radix ignores touch; a press shows the tooltip for a moment instead.
        if (event.pointerType === 'touch' && !event.defaultPrevented) showForTouch?.();
      }}
      {...props}
    />
  );
}

function TooltipContent({
  className,
  // 8px from the control (H:4467): Radix adds the 4px arrow to this offset.
  sideOffset = 4,
  collisionPadding = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'bg-primary text-primary-foreground text-caption animate-in fade-in-0 slide-in-from-bottom-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-[2px] z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-2 py-1.25 font-medium whitespace-nowrap duration-120 ease-out data-[state=closed]:duration-100 data-[state=instant-open]:animate-none max-md:hidden',
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow width={8} height={4} className="fill-primary" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
