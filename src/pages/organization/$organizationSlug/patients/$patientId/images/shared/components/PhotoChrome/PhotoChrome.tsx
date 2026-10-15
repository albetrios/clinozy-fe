import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../../shared/patient-photos.constants.ts';

const K = PATIENT_PHOTOS_KEYS.viewer;

/** Props of {@link PhotoRoundButton}. */
export interface PhotoRoundButtonProps {
  label: string;
  hint: string;
  onClick: () => void;
  /** Delete: the hover turns destructive. */
  danger?: boolean;
  testId: string;
  className?: string;
  children: ReactNode;
}

/**
 * A 40px round control on the photos' dark chrome (H:2683–2684) — the viewer's and the
 * comparison's Close, Edit, Delete and ‹ ›.
 */
export function PhotoRoundButton({
  label,
  hint,
  onClick,
  danger = false,
  testId,
  className,
  children,
}: PhotoRoundButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={hint}
      data-testid={testId}
      data-slot="pill"
      className={cn(
        'bg-canvas/12 text-canvas flex size-10 flex-none items-center justify-center rounded-full transition-colors',
        danger ? 'hover:bg-destructive' : 'hover:bg-canvas/20',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** The zoom group's three test ids. */
export interface PhotoZoomGroupTestIds {
  zoomOut: string;
  zoomReset: string;
  zoomIn: string;
}

/** Props of {@link PhotoZoomGroup}. */
export interface PhotoZoomGroupProps {
  /** The zoom, 1 = 100%. */
  level: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  testIds: PhotoZoomGroupTestIds;
  /**
   * `bar` — the chrome's group, hidden on a phone where the pinch zooms; `panel` — the
   * glass pill on one photo of the comparison (Separate), on every screen.
   */
  variant?: 'bar' | 'panel';
  /** The group's name — "Zoom" by default; a panel names its photo. */
  label?: string;
}

const ZOOM_GROUP_LOOK = {
  bar: { step: 'w-9 text-base', level: 'min-w-14 px-2 text-xs' },
  panel: { step: 'w-7 text-sm', level: 'min-w-11 px-1 text-tiny' },
} as const;

/**
 * The chrome's zoom group: − · the level (it resets) · + (H:2683). The bar's is hidden on a
 * phone, where the pinch zooms; a comparison panel's shows everywhere
 * (change-photo-compare-zoom D7, D12).
 */
export function PhotoZoomGroup({
  level,
  onZoomIn,
  onZoomOut,
  onReset,
  testIds,
  variant = 'bar',
  label,
}: PhotoZoomGroupProps) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const { formatNumber } = useLocaleFormat();
  const look = ZOOM_GROUP_LOOK[variant];
  return (
    <fieldset
      aria-label={label ?? t(K.zoom)}
      data-slot={variant === 'panel' ? 'pill' : undefined}
      className={cn(
        'm-0 flex min-w-0 flex-none items-center overflow-hidden p-0',
        variant === 'panel'
          ? 'bg-overlay/60 text-canvas h-7 rounded-full backdrop-blur-sm'
          : 'border-canvas/20 h-9.5 rounded-lg border max-md:hidden',
      )}
    >
      <button
        type="button"
        onClick={onZoomOut}
        aria-label={t(K.zoomOut)}
        title={t(K.zoomOutHint)}
        data-testid={testIds.zoomOut}
        className={cn('hover:bg-canvas/10 h-full', look.step)}
      >
        −
      </button>
      <button
        type="button"
        onClick={onReset}
        title={t(K.zoomReset)}
        data-testid={testIds.zoomReset}
        className={cn(
          'border-canvas/20 hover:bg-canvas/10 h-full border-x font-semibold tabular-nums',
          look.level,
        )}
      >
        {formatNumber(level, { style: 'percent', maximumFractionDigits: 0 })}
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        aria-label={t(K.zoomIn)}
        title={t(K.zoomInHint)}
        data-testid={testIds.zoomIn}
        className={cn('hover:bg-canvas/10 h-full', look.step)}
      >
        +
      </button>
    </fieldset>
  );
}
