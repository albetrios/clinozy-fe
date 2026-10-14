import { useTranslation } from 'react-i18next';

import { Button } from '@/shared/components/ui/button.tsx';
import { Columns, X } from '@/shared/icons/index.ts';

import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../shared/patient-photos.constants.ts';
import { PHOTO_SELECTION_BAR_TEST_IDS } from './photo-selection-bar.constants.ts';

const K = PATIENT_PHOTOS_KEYS.select;

/** Props of {@link PhotoSelectionBar}. */
export interface PhotoSelectionBarProps {
  /** How many are picked. */
  count: number;
  /** Two to eight picked: Compare is on. */
  comparable: boolean;
  onClear: () => void;
  onCompare: () => void;
  /** Leave selection ("Done"). */
  onDone: () => void;
}

/**
 * The selection bar (change-patient-overview-photos `BRIEF.md:32–36`): pinned
 * to the bottom of the Photos section while selecting, above the phone's tab
 * bar — × (leave), "3 selected", "Pick 2 to 8 photos to compare" (from `sm`),
 * Clear, and Compare, on from two photos. Its count is announced as it changes.
 */
export function PhotoSelectionBar({
  count,
  comparable,
  onClear,
  onCompare,
  onDone,
}: PhotoSelectionBarProps) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  return (
    <section
      aria-label={t(K.bar)}
      data-testid={PHOTO_SELECTION_BAR_TEST_IDS.root}
      data-slot="card"
      className="bg-card animate-dropdown-up sticky bottom-[calc(var(--floating-bottom-offset,0rem)+0.75rem)] z-10 mx-auto flex w-fit max-w-full items-center gap-2 rounded-xl border p-1.5 ps-2 shadow-(--elevation-fab)"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDone}
        aria-label={t(K.done)}
        title={t(K.done)}
        data-testid={PHOTO_SELECTION_BAR_TEST_IDS.done}
        className="text-muted-foreground-strong size-8 flex-none"
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
      <span className="flex min-w-0 flex-col pe-1">
        <output
          aria-live="polite"
          data-testid={PHOTO_SELECTION_BAR_TEST_IDS.count}
          className="text-body font-semibold whitespace-nowrap tabular-nums"
        >
          {t(K.count, { count })}
        </output>
        <span className="text-muted-foreground hidden text-xs whitespace-nowrap sm:block">
          {t(K.hint)}
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        onClick={onClear}
        disabled={count === 0}
        data-testid={PHOTO_SELECTION_BAR_TEST_IDS.clear}
        className="flex-none"
      >
        {t(K.clear)}
      </Button>
      <Button
        type="button"
        onClick={onCompare}
        disabled={!comparable}
        data-testid={PHOTO_SELECTION_BAR_TEST_IDS.compare}
        className="flex-none gap-1.5"
      >
        <Columns aria-hidden="true" className="size-4" />
        {t(K.compare)}
      </Button>
    </section>
  );
}
