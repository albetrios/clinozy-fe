import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';

import { RX_KEYS, RX_NS, RX_TEST_IDS } from '../../prescriptions.constants.ts';
import type { RxAllergyMatch } from './rx-allergy.ts';

const K = RX_KEYS;
const ID = RX_TEST_IDS.allergyConfirm;

/** Props of {@link RxAllergyConfirm}. */
export interface RxAllergyConfirmProps {
  open: boolean;
  matches: readonly RxAllergyMatch[];
  /** "Go back": the drawer keeps the form as it stands. */
  onCancel: () => void;
  /** "Save anyway": the save the member pressed (approve, or sell). */
  onConfirm: () => void;
}

/**
 * The save's confirm when a line matches the patient's allergies
 * (feat-prescription-composer D8; `BRIEF.md:30–33`, `:75–77`): "Prescribe
 * despite the allergy?" with every matching line — it warns, never blocks:
 * "Save anyway" saves as asked.
 */
export function RxAllergyConfirm({
  open,
  matches,
  onCancel,
  onConfirm,
}: RxAllergyConfirmProps) {
  const { t } = useTranslation(RX_NS);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={t(K.allergyConfirm.title)}
      description={
        <span className="flex flex-col gap-1.5">
          <span>{t(K.allergyConfirm.body, { count: matches.length })}</span>
          <span className="flex flex-col">
            {matches.map((match) => (
              <span
                key={`${match.index}:${match.medicineName}`}
                data-testid={`${ID}-match`}
                className="text-destructive font-medium"
              >
                {t(
                  K.sidekick.matches,
                  isolateValues({
                    medicine: match.medicineName,
                    allergies: match.allergies.join(', '),
                  }),
                )}
              </span>
            ))}
          </span>
        </span>
      }
      cancelLabel={t(K.allergyConfirm.back)}
      confirmLabel={t(K.allergyConfirm.confirm)}
      destructive
      testIds={{ dialog: ID, cancel: `${ID}-cancel`, accept: `${ID}-accept` }}
      onConfirm={onConfirm}
    />
  );
}
