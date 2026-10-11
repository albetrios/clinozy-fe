import { fetchPayment, updatePayment } from '@/shared/api/app/payments-api.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';

/** Each entry's attach in flight — an entry's photos are filed one after another. */
const attaching = new Map<string, Promise<unknown>>();

/**
 * File an uploaded bill photo on an entry — the storage key the upload tray confirmed: the entry
 * is read and its `attachment_keys` changed to carry the key too (`PATCH /app/payments/:id`, with
 * the read's `updated_at`). A key already on it is not added twice (the tray's Retry); the server
 * refuses a sixth. Attaches to one entry run one at a time, so two photos landing together never
 * overwrite each other.
 */
export function attachPaymentFile({
  paymentId,
  key,
}: {
  paymentId: string;
  key: string;
}): Promise<LedgerRow> {
  const attach = async () => {
    const record = await fetchPayment(paymentId);
    if (record.attachmentKeys.includes(key)) return record;
    return updatePayment({
      record,
      patch: { attachmentKeys: [...record.attachmentKeys, key] },
      idempotencyKey: `payment-file:${paymentId}:${key}`,
    });
  };
  const previous = attaching.get(paymentId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(attach);
  attaching.set(paymentId, next);
  void next
    .catch(() => undefined)
    .finally(() => {
      if (attaching.get(paymentId) === next) attaching.delete(paymentId);
    });
  return next;
}
