import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type * as React from 'react';

import { closeControlClassName } from '@/lib/icon-surface.ts';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/shared/components/ui/button.tsx';

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        // The design's centred-dialog backdrop (the command menu's, H:2669):
        // rgb(9 9 11 / .35) fading in over 150ms.
        'data-[state=open]:animate-fade data-[state=closed]:animate-out data-[state=closed]:fade-out-0 bg-overlay/35 fixed inset-0 z-50',
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // The design's one centred dialog frame (the command menu, H:2669–
          // 2671): 12px corners, a hairline, the dialog elevation (preset) and
          // the popover entrance (czddin, 160ms).
          'bg-background data-[state=open]:animate-dropdown-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border p-6 shadow-lg duration-200 outline-none sm:max-w-lg',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              closeControlClassName,
              // `end-4`, not upstream's `right-4`. This directory is exempt from
              // `validate:logical` as vendored shadcn, which is why a physical
              // inset survived here — but the exemption is about not churning
              // vendored code, not about opting dialogs out of RTL. Pinned
              // physically, the button stayed on the right in Arabic and Hebrew
              // while every consumer reserved room for it on the logical end,
              // so the two were on opposite sides and content ran under the X.
              'ring-offset-background focus-visible:ring-ring absolute end-4 top-4 focus-visible:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
            )}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

/**
 * The header band, as a drawer's (`_patterns.md:32`): title and sub line on a
 * hairline, flush with the frame's edges (it undoes the content's `p-6`), the
 * close button's corner kept clear at the inline end.
 */
function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        '-mx-6 -mt-6 flex flex-col gap-1 border-b px-6 py-4 pe-12 text-start',
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // The footer band (`_patterns.md:35`, the confirm's `canvas` strip):
        // a hairline, actions at the inline end — sharing the row on a phone.
        'bg-canvas -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t px-6 py-3 max-sm:*:flex-1 sm:gap-2.5',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-tight font-semibold tracking-[-0.01em]', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-body text-pretty', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
