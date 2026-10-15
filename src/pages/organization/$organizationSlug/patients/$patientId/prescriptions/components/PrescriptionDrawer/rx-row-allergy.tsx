import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { ShieldCheck, TriangleAlert } from '@/shared/icons/index.ts';

import { RX_KEYS, RX_NS, RX_TEST_IDS } from '../../prescriptions.constants.ts';
import type { RxAllergyMatch } from './rx-allergy.ts';

const K = RX_KEYS;
const ID = RX_TEST_IDS.rowAllergy;

/** Props of {@link RxRowAllergy}. */
export interface RxRowAllergyProps {
  match: RxAllergyMatch;
  /** Kept knowingly: the warning quietens to one line that says so. */
  kept: boolean;
  /** View only: the warning, no buttons. */
  readOnly: boolean;
  /** The first warning not yet answered after a held save (D7): ringed. */
  emphasized: boolean;
  /** A held save asks for this warning now: it scrolls into view and Keep takes the focus. */
  focusNow: boolean;
  /** The focus was given — the request is spent, so a later warning never takes it unasked. */
  onFocused: () => void;
  onKeep: (kept: boolean) => void;
  onRemove: () => void;
}

/**
 * The allergy warning under its row (change-prescription-writing D7; was the
 * save's dialog): "Septran DS — allergic to Sulfa drugs", Remove and Keep.
 * Kept, it quietens to "Kept knowingly despite the Sulfa drugs allergy" with
 * Undo. A save with a warning not yet answered brings the first one here.
 */
export function RxRowAllergy({
  match,
  kept,
  readOnly,
  emphasized,
  focusNow,
  onFocused,
  onKeep,
  onRemove,
}: RxRowAllergyProps) {
  const { t } = useTranslation(RX_NS);
  const rootRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const allergies = match.allergies.join(', ');

  useEffect(() => {
    if (!focusNow) return;
    rootRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    keepRef.current?.focus({ preventScroll: true });
    onFocused();
  }, [focusNow, onFocused]);

  if (kept) {
    return (
      <div
        data-testid={ID}
        data-kept="true"
        className="text-caption text-muted-foreground flex min-h-7.5 items-center gap-1.5 px-1"
      >
        <ShieldCheck aria-hidden="true" className="size-3.5 flex-none" />
        <span className="min-w-0 flex-1">
          {t(K.rowAllergy.kept, isolateValues({ allergies }))}
        </span>
        {readOnly ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onKeep(false)}
            data-testid={`${ID}-undo`}
            className="text-caption h-7 px-2"
          >
            {t(K.rowAllergy.undo)}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      role="alert"
      data-testid={ID}
      data-kept="false"
      data-emphasized={emphasized || undefined}
      className={cn(
        'bg-destructive/8 border-destructive/30 text-destructive flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border px-2.5 py-1.5',
        emphasized && 'ring-destructive/40 ring-[3px]',
      )}
    >
      <TriangleAlert aria-hidden="true" className="size-3.5 flex-none" />
      <p className="text-detail min-w-48 flex-1">
        <span className="font-semibold">{match.medicineName}</span>
        {' — '}
        {t(K.rowAllergy.warning, isolateValues({ allergies }))}
      </p>
      {readOnly ? null : (
        <span className="ms-auto flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t(
              K.rowAllergy.removeLabel,
              isolateValues({ medicine: match.medicineName }),
            )}
            onClick={onRemove}
            data-testid={`${ID}-remove`}
            className="border-destructive/40 text-destructive hover:bg-destructive-tint hover:text-destructive h-7 px-2.5 shadow-none pointer-coarse:h-9"
          >
            {t(K.rowAllergy.remove)}
          </Button>
          <Button
            ref={keepRef}
            type="button"
            variant="outline"
            size="sm"
            aria-label={t(
              K.rowAllergy.keepLabel,
              isolateValues({ medicine: match.medicineName }),
            )}
            onClick={() => onKeep(true)}
            data-testid={`${ID}-keep`}
            className="h-7 px-2.5 shadow-none pointer-coarse:h-9"
          >
            {t(K.rowAllergy.keep)}
          </Button>
        </span>
      )}
    </div>
  );
}
