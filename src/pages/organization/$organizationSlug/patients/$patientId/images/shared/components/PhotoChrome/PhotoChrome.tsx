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
}

/**
 * The chrome's zoom group: − · the level (it resets) · + (H:2683). Hidden on a phone, where the
 * pinch zooms.
 */
export function PhotoZoomGroup({
  level,
  onZoomIn,
  onZoomOut,
  onReset,
  testIds,
}: PhotoZoomGroupProps) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const { formatNumber } = useLocaleFormat();
  return (
    <fieldset
      aria-label={t(K.zoom)}
      className="border-canvas/20 m-0 flex h-9.5 min-w-0 flex-none items-center overflow-hidden rounded-lg border p-0 max-md:hidden"
    >
      <button
        type="button"
        onClick={onZoomOut}
        aria-label={t(K.zoomOut)}
        title={t(K.zoomOutHint)}
        data-testid={testIds.zoomOut}
        className="hover:bg-canvas/10 h-full w-9 text-base"
      >
        −
      </button>
      <button
        type="button"
        onClick={onReset}
        title={t(K.zoomReset)}
        data-testid={testIds.zoomReset}
        className="border-canvas/20 hover:bg-canvas/10 h-full min-w-14 border-x px-2 text-xs font-semibold tabular-nums"
      >
        {formatNumber(level, { style: 'percent', maximumFractionDigits: 0 })}
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        aria-label={t(K.zoomIn)}
        title={t(K.zoomInHint)}
        data-testid={testIds.zoomIn}
        className="hover:bg-canvas/10 h-full w-9 text-base"
      >
        +
      </button>
    </fieldset>
  );
}
