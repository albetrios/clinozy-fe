import { useTranslation } from 'react-i18next';

import type { PinPlace } from '@/shared/app/pin-directory/index.ts';
import { DrawerChips, DrawerField } from '@/shared/components/DrawerField/index.ts';

import {
  PIN_AREA_CHIP_LIMIT,
  PIN_PLACE_KEYS,
  PIN_PLACE_NS,
} from './pin-area-chips.constants.ts';

/** Props of {@link PinAreaChips}. */
export interface PinAreaChipsProps {
  /** What the PIN look-up found (`usePinPlace`): a place, `null` for an unknown PIN, `undefined` before six digits. */
  place: PinPlace | null | undefined;
  /** The Area field's value now. */
  area: string;
  onAreaChange: (area: string) => void;
  /** Prefix of the parts' test ids: `<testId>-pin-unknown`, `<testId>-area-pick`. */
  testId: string;
}

/**
 * What a PIN look-up adds under the address (feat-write-less-2026-10-14-oixr, D13): "We don't
 * know this PIN — type the area, city and state." for an unknown one, or a chip per area when the
 * PIN covers several (up to {@link PIN_AREA_CHIP_LIMIT}) — nothing for a PIN with one area, which
 * the caller writes straight into Area. The clinic setup's location step and Users › Branches
 * share it.
 */
export function PinAreaChips({ place, area, onAreaChange, testId }: PinAreaChipsProps) {
  const { t } = useTranslation(PIN_PLACE_NS);
  if (place === null) {
    return (
      <p className="text-muted-foreground text-xs" data-testid={`${testId}-pin-unknown`}>
        {t(PIN_PLACE_KEYS.unknown)}
      </p>
    );
  }
  const areas = place?.areas ?? [];
  if (areas.length < 2) return null;
  return (
    <DrawerField label={t(PIN_PLACE_KEYS.areaPick)} span="full">
      <DrawerChips<string>
        label={t(PIN_PLACE_KEYS.areaPick)}
        options={areas
          .slice(0, PIN_AREA_CHIP_LIMIT)
          .map((name) => ({ value: name, label: name }))}
        value={area || null}
        onChange={(picked) => onAreaChange(picked ?? '')}
        testId={`${testId}-area-pick`}
      />
    </DrawerField>
  );
}
