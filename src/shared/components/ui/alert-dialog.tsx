/**
 * Vendored shadcn/ui primitive, TRIMMED — re-apply after a shadcn refresh.
 * `pnpm dlx shadcn@latest add alert-dialog` regenerates the full file; delete
 * the parts nothing composes again (knip flags them).
 *
 * Only the root, the title and the description remain. Every confirm draws its
 * own frame (`ConfirmDialog/confirm-panel.tsx`: the end panel from `md`, a
 * bottom sheet below), so the centred content, its header and footer, and the
 * action and cancel buttons (with this file's old `isLoading` edit) left with
 * the last centred confirm (L-65).
 */
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils.ts';

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export { AlertDialog, AlertDialogDescription, AlertDialogTitle };
