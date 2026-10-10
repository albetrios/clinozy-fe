import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { dayCloseQueryKeys } from '@/shared/api/clinic/day-close-api.ts';
import {
  ConfirmDialog,
  type ConfirmReasonChoice,
  type ConfirmReasonOption,
} from '@/shared/components/ConfirmDialog/index.ts';
import { REASON_CONFIRM_KEYS } from '@/shared/components/ConfirmDialog/reason-confirm.constants.ts';
import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';
import { notify } from '@/shared/notify/index.ts';

import { useReopenDay } from '../../hooks/useDayClose/index.ts';
import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../payments.constants.ts';

const K = PAYMENTS_KEYS.dayClose;

/** Why a closed day opens again — the chips; "Other" waits for a note. */
const REOPEN_REASONS: readonly ConfirmReasonOption[] = [
  { value: 'miscounted', labelKey: `${PAYMENTS_NS}:${K.reopen.reasons.miscounted}` },
  { value: 'missed', labelKey: `${PAYMENTS_NS}:${K.reopen.reasons.missed}` },
  { value: 'wrong_entry', labelKey: `${PAYMENTS_NS}:${K.reopen.reasons.wrongEntry}` },
  { value: 'other', labelKey: REASON_CONFIRM_KEYS.reasons.other },
];

/** The API's longest reason (`reason` 1–280). */
const REASON_MAX_LENGTH = 280;

/**
 * The reason the reopen keeps (free text, 1–280 — the `reopened` step shows it): the chip as
 * shown and the note after it ("Counted wrong · two ₹500 notes stuck together"), or the note
 * alone for "Other".
 */
function reopenReasonOf({ picked, comment }: ConfirmReasonChoice): string {
  const reason =
    picked.value === 'other'
      ? comment
      : [picked.label, comment].filter(Boolean).join(' · ');
  return reason.slice(0, REASON_MAX_LENGTH);
}

/** The closed day the confirm reopens. */
export interface DayCloseReopenTarget {
  /** `dcl_…`. */
  closeId: string;
  /** The record pill: "Vesu · Oct 9". */
  label: string;
}

/** Props of {@link DayCloseReopenConfirm}. */
export interface DayCloseReopenConfirmProps {
  /** The day to reopen; the confirm is open while one is set. */
  target: DayCloseReopenTarget | null;
  /** "Keep it", the ×, the backdrop, Esc — and the confirm closing after the write or a refusal. */
  onClose: () => void;
}

/**
 * "Reopen this day?" (`POST /app/day-closes/:day_close_id/reopen`, `payment:delete`): the shared
 * reason confirm with the day as its pill — clinozy-be wants why (1–280) and keeps it on the
 * `reopened` step; the count is cleared, the day's money unlocks and the next close recomputes.
 * "Day reopened". A day someone reopened meanwhile (`409 transition_not_allowed`) closes the
 * confirm, says so and re-reads the day; a 400 on the reason shows at the field; any other
 * failure keeps it open.
 */
export function DayCloseReopenConfirm({ target, onClose }: DayCloseReopenConfirmProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const queryClient = useQueryClient();
  const reopen = useReopenDay({ notifyOnError: false });

  /** Tell the refusal apart: it closes the confirm and refreshes the day. */
  const reportFailure = (error: unknown) => {
    if (apiErrorReason(error) === 'transition_not_allowed') {
      notify.error(t(K.refusals.alreadyOpen));
      queryClient
        .invalidateQueries({ queryKey: dayCloseQueryKeys.all })
        .catch(() => undefined);
      onClose();
      return;
    }
    // The confirm shows a 400 on the reason at its field.
    if (!(isHttpError(error) && error.status === 400)) notify.error(mapApiError(error));
  };

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(K.reopen.title)}
      description={t(K.reopen.effect)}
      confirmLabel={t(K.reopen.action)}
      reason={{ record: target?.label ?? '', options: REOPEN_REASONS }}
      onConfirm={async (choice) => {
        if (!target) return;
        try {
          await reopen.mutateAsync({
            closeId: target.closeId,
            reason: reopenReasonOf(choice),
          });
          notify.success(t(K.reopened));
        } catch (error) {
          reportFailure(error);
          throw error;
        }
      }}
    />
  );
}
