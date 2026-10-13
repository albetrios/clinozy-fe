import { HoverCard as HoverCardPrimitive } from 'radix-ui';
import type * as React from 'react';
import { useRef } from 'react';

import { cn } from '@/lib/utils.ts';

function HoverCard({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />;
}

/**
 * The trigger, opening on hover and on keyboard focus — but not again on the focus a click gives
 * it. Radix schedules the open on pointer enter AND on focus, and keeps only the second timer's
 * id: the first outlives a pointer leave (the card opens after the pointer has gone) and an
 * unmount (in a test, a timer that fires after its window is torn down). The pointer already
 * asked for the card; a focus that follows a press on the trigger is not asked twice.
 */
function HoverCardTrigger({
  onPointerDown,
  onFocus,
  onBlur,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  const pressed = useRef(false);
  return (
    <HoverCardPrimitive.Trigger
      data-slot="hover-card-trigger"
      onPointerDown={(event) => {
        pressed.current = true;
        onPointerDown?.(event);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (pressed.current) event.preventDefault();
        pressed.current = false;
      }}
      onBlur={(event) => {
        pressed.current = false;
        onBlur?.(event);
      }}
      {...props}
    />
  );
}

function HoverCardContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal data-slot="hover-card-portal">
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'bg-popover text-popover-foreground data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden',
          className,
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
