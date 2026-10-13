import { describe, expect, it } from 'vitest';

import {
  organizationDayClose,
  organizationPaymentEdit,
  organizationPaymentPay,
  organizationPaymentReceive,
  organizationPayments,
  organizationPaymentsPending,
  organizationPendingCreate,
  organizationPendingEdit,
} from './payments-builders.ts';

describe('the Payments room builders', () => {
  const slug = { organizationSlug: 'acme' };

  it('build the ledger and the drawers over it (S:84–87, S:91)', () => {
    expect(organizationPayments('acme')).toEqual({
      to: '/organization/$organizationSlug/payments',
      params: slug,
    });
    expect(organizationPaymentReceive('acme')).toEqual({
      to: '/organization/$organizationSlug/payments/receive',
      params: slug,
    });
    expect(organizationPaymentPay('acme')).toEqual({
      to: '/organization/$organizationSlug/payments/pay',
      params: slug,
    });
    expect(organizationPaymentEdit('acme', 'P1')).toEqual({
      to: '/organization/$organizationSlug/payments/$paymentId/edit',
      params: { ...slug, paymentId: 'P1' },
    });
    expect(organizationDayClose('acme')).toEqual({
      to: '/organization/$organizationSlug/payments/day-close',
      params: slug,
    });
  });

  it('build Pending and its drawers (S:88–90)', () => {
    expect(organizationPaymentsPending('acme')).toEqual({
      to: '/organization/$organizationSlug/payments/pending',
      params: slug,
    });
    expect(organizationPendingCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/payments/pending/create',
      params: slug,
    });
    expect(organizationPendingEdit('acme', 'C1')).toEqual({
      to: '/organization/$organizationSlug/payments/pending/$creditId/edit',
      params: { ...slug, creditId: 'C1' },
    });
  });
});
