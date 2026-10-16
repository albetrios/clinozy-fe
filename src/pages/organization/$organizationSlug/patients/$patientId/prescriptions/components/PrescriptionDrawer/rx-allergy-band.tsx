import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { TriangleAlert } from '@/shared/icons/index.ts';

import { RX_KEYS, RX_NS, RX_TEST_IDS } from '../../prescriptions.constants.ts';
import type { RxAllergyMatch } from './rx-allergy.ts';

const K = RX_KEYS;

/** Props of {@link RxAllergyBand}. */
export interface RxAllergyBandProps {
  /** The patient's allergies — the band shows only when there are some. */
  allergies: readonly string[];
  matches: readonly RxAllergyMatch[];
}

/**
 * The allergy band under the drawer's header (feat-prescription-composer
 * §6.5; `BRIEF.md:30–35`): the patient's allergies in the danger tone on
 * every tier, and each line that matches one named under them as it is
 * written — announced, politely, as it appears.
 */
export function RxAllergyBand({ allergies, matches }: RxAllergyBandProps) {
  const { t } = useTranslation(RX_NS);
  return (
    <div
      data-testid={RX_TEST_IDS.allergyBand}
      className="bg-destructive-tint text-destructive border-destructive-border flex items-start gap-2 border-b px-(--drawer-pad-x) py-2"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 flex-none" />
      <div className="text-detail flex min-w-0 flex-col gap-0.5">
        <p>
          <span className="font-semibold">{t(K.allergyBand.label)}</span>
          <span aria-hidden="true">: </span>
          <span data-testid={`${RX_TEST_IDS.allergyBand}-list`}>
            {allergies.join(' · ')}
          </span>
        </p>
        <ul aria-live="polite" className="flex flex-col">
          {matches.map((match) => (
            <li
              key={`${match.index}:${match.medicineName}`}
              data-testid={`${RX_TEST_IDS.allergyBand}-match`}
              className="font-medium"
            >
              {t(
                K.sidekick.matches,
                isolateValues({
                  medicine: match.medicineName,
                  allergies: match.allergies.join(', '),
                }),
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
