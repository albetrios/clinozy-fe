import { useBlocker } from '@tanstack/react-router';
import { useCallback } from 'react';

import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';

export interface UseUnsavedChangesGuardOptions {
  /** When true, in-app navigation and tab close are blocked until confirmed. */
  when: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Blocks SPA navigation and browser unload when `when` is true. Renders a
 * {@link ConfirmDialog} the caller must mount (`guardDialog`).
 */
export function useUnsavedChangesGuard({
  when,
  title = 'Discard unsaved changes?',
  description = 'You have unsaved changes. Leave without saving?',
  confirmLabel = 'Discard',
  cancelLabel = 'Stay',
}: UseUnsavedChangesGuardOptions) {
  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: () => when,
    withResolver: true,
    enableBeforeUnload: when,
  });

  const open = status === 'blocked';

  const handleConfirm = useCallback(async () => {
    proceed?.();
  }, [proceed]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) return;
      reset?.();
    },
    [reset],
  );

  const guardDialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      destructive
      onConfirm={handleConfirm}
    />
  );

  return { guardDialog, isBlocked: open };
}
