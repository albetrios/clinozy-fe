import { useTranslation } from 'react-i18next';

import type { TreatmentRecord } from '@/shared/api/app/treatments-contracts.ts';
import {
  ConfirmDialog,
  type ConfirmReasonChoice,
  type ConfirmReasonOption,
} from '@/shared/components/ConfirmDialog/index.ts';
import { REASON_CONFIRM_KEYS } from '@/shared/components/ConfirmDialog/reason-confirm.constants.ts';
import { useReverseTreatment } from '@/shared/hooks/useTreatments/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { TREATMENT_KEYS, TREATMENT_NS } from '../../treatments.constants.ts';

const K = TREATMENT_KEYS.reverse;

/** The reverse's chips; "Other" waits for a note. */
const REVERSE_REASON_OPTIONS: readonly ConfirmReasonOption[] = [
  { value: 'mistake', labelKey: `${TREATMENT_NS}:${K.reasons.mistake}` },
  { value: 'wrong_patient', labelKey: `${TREATMENT_NS}:${K.reasons.wrongPatient}` },
  { value: 'not_done', labelKey: `${TREATMENT_NS}:${K.reasons.notDone}` },
  { value: 'other', labelKey: REASON_CONFIRM_KEYS.reasons.other },
];

/** The API's longest reverse reason. */
const REASON_MAX_LENGTH = 280;

/**
 * The reason the session keeps (free text, 1–280): the chip as shown and the note after it
 * ("Wrong patient · booked under her sister"), or the note alone for "Other".
 */
function reverseReasonOf({ picked, comment }: ConfirmReasonChoice): string {
  const reason =
    picked.value === 'other'
      ? comment
      : [picked.label, comment].filter(Boolean).join(' · ');
  return reason.slice(0, REASON_MAX_LENGTH);
}

/**
 * "Reverse this treatment?" — the design's delete, which the API does not have: a session is
 * reversed with a reason, never deleted (api-integration §5.4). It stays in the file, marked
 * reversed, and a package session it spent comes back (the server gives it back). Final, so
 * "Treatment reversed" offers no Undo (Q7).
 */
export function TreatmentReverseConfirm({
  treatment,
  open,
  onOpenChange,
  onReversed,
}: {
  treatment: TreatmentRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReversed: () => void;
}) {
  const { t } = useTranslation(TREATMENT_NS);
  const reverse = useReverseTreatment();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(K.title)}
      description={t(K.body)}
      confirmLabel={t(K.action)}
      reason={{ record: treatment.name, options: REVERSE_REASON_OPTIONS }}
      onConfirm={async (choice) => {
        await reverse.mutateAsync({ treatment, reason: reverseReasonOf(choice) });
        notify.success(t(K.done));
        onReversed();
      }}
    />
  );
}
