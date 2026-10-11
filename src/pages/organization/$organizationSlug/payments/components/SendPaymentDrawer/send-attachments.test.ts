import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchPayment, updatePayment } from '@/shared/api/app/payments-api.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import { ledgerRow, TEST_PAYMENT_ID } from '@/tests/utils/payments-doubles.ts';

import { attachPaymentFile } from './send-attachments.ts';

vi.mock('@/shared/api/app/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPayment: vi.fn(),
  updatePayment: vi.fn(),
}));

/** The entry on the server: each PATCH adds its keys, each read answers what is stored. */
let stored: LedgerRow;

beforeEach(() => {
  stored = ledgerRow({ attachmentKeys: [] });
  vi.mocked(fetchPayment)
    .mockReset()
    .mockImplementation(async () => stored);
  vi.mocked(updatePayment)
    .mockReset()
    .mockImplementation(async ({ record, patch }) => {
      stored = {
        ...record,
        attachmentKeys: patch.attachmentKeys ?? record.attachmentKeys,
        updatedAt: new Date().toISOString(),
      };
      return stored;
    });
});

describe('attachPaymentFile', () => {
  it('adds the key to what the entry carries now, with the read’s record', async () => {
    stored = ledgerRow({ attachmentKeys: ['org/first.jpg'] });
    await attachPaymentFile({ paymentId: TEST_PAYMENT_ID, key: 'org/second.jpg' });
    expect(updatePayment).toHaveBeenCalledWith({
      record: expect.objectContaining({ attachmentKeys: ['org/first.jpg'] }),
      patch: { attachmentKeys: ['org/first.jpg', 'org/second.jpg'] },
      idempotencyKey: `payment-file:${TEST_PAYMENT_ID}:org/second.jpg`,
    });
  });

  it('files two photos landing together one after the other, neither lost', async () => {
    await Promise.all([
      attachPaymentFile({ paymentId: TEST_PAYMENT_ID, key: 'org/a.jpg' }),
      attachPaymentFile({ paymentId: TEST_PAYMENT_ID, key: 'org/b.jpg' }),
    ]);
    expect(stored.attachmentKeys).toEqual(['org/a.jpg', 'org/b.jpg']);
  });

  it('adds nothing for a key the entry already carries (the tray’s Retry)', async () => {
    stored = ledgerRow({ attachmentKeys: ['org/a.jpg'] });
    await attachPaymentFile({ paymentId: TEST_PAYMENT_ID, key: 'org/a.jpg' });
    expect(updatePayment).not.toHaveBeenCalled();
  });
});
