import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';

import { ToastBar } from './ToastBar.tsx';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface CustomToastProps {
  id: string | number;
  type: ToastType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  /**
   * The toast has no timer (`duration: Infinity` — "Update available"), so it
   * cannot leave on its own: it gets the bar's dismiss ×. The caller's
   * `onDismiss` rides on the Sonner toast, which fires it once for the × and
   * once for a swipe alike.
   */
  persistent?: boolean;
}

function stopToastPointerBubble(event: React.SyntheticEvent) {
  // Sonner attaches swipe / pointer-capture handlers on `[data-sonner-toast]`.
  event.stopPropagation();
}

/**
 * The toast Sonner renders: the design's bottom bar ({@link ToastBar}). Its
 * action dismisses its own toast the moment the action returns; a loading
 * toast carries no action; a persistent one adds the dismiss ×.
 */
export function CustomToast({
  id,
  type,
  title,
  description,
  action,
  persistent = false,
}: CustomToastProps) {
  const { t } = useTranslation(ERRORS_NS);
  const isLoading = type === 'loading';
  const barAction = isLoading ? undefined : action;
  return (
    <ToastBar
      title={title}
      description={description}
      action={barAction}
      onAction={() => {
        barAction?.onClick();
        toast.dismiss(id);
      }}
      dismiss={
        persistent && !isLoading ? { label: t(ERRORS_KEYS.toast.dismiss) } : undefined
      }
      onDismiss={() => toast.dismiss(id)}
      onButtonPointerDown={stopToastPointerBubble}
    />
  );
}
