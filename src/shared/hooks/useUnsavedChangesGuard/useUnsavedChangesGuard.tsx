import { useBlocker } from '@tanstack/react-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ConfirmDialog,
  isConfirmedWriteRunning,
} from '@/shared/components/ConfirmDialog/index.ts';

import { UNSAVED_CHANGES_KEYS, UNSAVED_CHANGES_NS } from './unsaved-changes.constants.ts';

/** Options of {@link useUnsavedChangesGuard}: when to guard, and the prompt's copy. */
export interface UseUnsavedChangesGuardOptions {
  /** When true, in-app navigation, tab close and `confirmDiscard` ask first. */
  when: boolean;
  /** Prompt title; defaults to the shared "Discard changes?" copy. */
  title?: string;
  /** Prompt body; defaults to the shared copy. */
  description?: string;
  /** Destructive action label; defaults to "Discard". */
  confirmLabel?: string;
  /** Label that keeps the user where they are; defaults to "Keep editing". */
  cancelLabel?: string;
}

/**
 * Asks before unsaved changes are thrown away. While `when` is true it blocks
 * SPA navigation (the browser Back included) and the tab's unload, and
 * `confirmDiscard(exit)` guards the surface's OWN exits — a drawer's ×, Cancel,
 * backdrop and Esc — running `exit` at once when there is nothing to lose, or
 * after the user picks Discard. Renders a {@link ConfirmDialog} the caller must
 * mount (`guardDialog`).
 *
 * `when` is read through a ref, so the blocker registers once and always sees
 * the latest committed value; a confirmed discard also lets the navigation its
 * own `exit` starts through, instead of asking a second time. So does an exit a
 * confirm's write starts — a drawer closing after its record was deleted,
 * cancelled or voided was answered by that confirm (L-64: one confirm).
 */
export function useUnsavedChangesGuard({
  when,
  title,
  description,
  confirmLabel,
  cancelLabel,
}: UseUnsavedChangesGuardOptions) {
  const { t } = useTranslation(UNSAVED_CHANGES_NS);
  const whenRef = useRef(when);
  const discardedRef = useRef(false);
  const [pendingExit, setPendingExit] = useState<(() => void) | null>(null);

  useLayoutEffect(() => {
    whenRef.current = when;
    // A discard only covers the exit it confirmed: once the surface is clean
    // again (closed, saved or reset) the next change is guarded afresh.
    if (!when) discardedRef.current = false;
  }, [when]);

  const shouldBlockFn = useCallback(
    () => whenRef.current && !discardedRef.current && !isConfirmedWriteRunning(),
    [],
  );

  const { proceed, reset, status } = useBlocker({
    shouldBlockFn,
    withResolver: true,
    enableBeforeUnload: when,
  });

  const routeBlocked = status === 'blocked';
  const open = routeBlocked || pendingExit !== null;

  const confirmDiscard = useCallback((exit: () => void) => {
    if (!whenRef.current || isConfirmedWriteRunning()) {
      exit();
      return;
    }
    setPendingExit(() => exit);
  }, []);

  const handleConfirm = useCallback(() => {
    if (routeBlocked) {
      proceed?.();
      return;
    }
    const exit = pendingExit;
    setPendingExit(null);
    discardedRef.current = true;
    exit?.();
  }, [routeBlocked, proceed, pendingExit]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) return;
      if (routeBlocked) reset?.();
      setPendingExit(null);
    },
    [routeBlocked, reset],
  );

  const guardDialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title ?? t(UNSAVED_CHANGES_KEYS.title)}
      description={description ?? t(UNSAVED_CHANGES_KEYS.description)}
      confirmLabel={confirmLabel ?? t(UNSAVED_CHANGES_KEYS.discard)}
      cancelLabel={cancelLabel ?? t(UNSAVED_CHANGES_KEYS.keepEditing)}
      destructive
      onConfirm={handleConfirm}
    />
  );

  return { guardDialog, isBlocked: open, confirmDiscard };
}
