import { describe, expect, it } from 'vitest';

import {
  organizationInvoice,
  organizationInvoiceCreate,
  organizationInvoiceEdit,
} from './invoice-builders.ts';

describe('invoice route builders (KICKOFF §6.9, S:92–94)', () => {
  it('build New invoice', () => {
    expect(organizationInvoiceCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/invoices/create',
      params: { organizationSlug: 'acme' },
    });
  });

  it('build an invoice’s preview and its Edit invoice', () => {
    const params = { organizationSlug: 'acme', invoiceId: 'I1' };
    expect(organizationInvoice('acme', 'I1')).toEqual({
      to: '/organization/$organizationSlug/invoices/$invoiceId',
      params,
    });
    expect(organizationInvoiceEdit('acme', 'I1')).toEqual({
      to: '/organization/$organizationSlug/invoices/$invoiceId/edit',
      params,
    });
  });
});
