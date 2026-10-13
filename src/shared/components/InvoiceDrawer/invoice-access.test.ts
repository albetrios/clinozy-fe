import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppAction } from '@/shared/api/app/access-contracts.ts';
import type { Section } from '@/shared/api/app/app-schema.ts';
import type { AppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { invoiceRecord } from '@/tests/utils/payments-doubles.ts';

/** The codes in force for the test, and whether they have answered yet. */
const access = vi.hoisted(() => ({
  resolved: true,
  codes: new Set<string>(),
  sections: new Set<string>(),
}));

vi.mock('@/shared/hooks/useAppAccess/index.ts', () => ({
  useAppAccess: (): AppAccess => ({
    previewRole: null,
    isResolved: access.resolved,
    can: (section: Section, action: AppAction) =>
      access.resolved && access.sections.has(`${section}:${action}`),
    canCode: (code: string) => access.resolved && access.codes.has(code),
    viewableSections: [],
  }),
}));

import { canPayment, useInvoiceAccess } from './invoice-access.ts';

const hold = (...codes: string[]) => {
  access.codes = new Set(codes);
};

describe('canPayment', () => {
  it('is false until the access resolves — "not known yet" is never "allowed"', () => {
    const canCode = vi.fn(() => true);
    expect(canPayment({ isResolved: false, canCode }, 'payment:create')).toBe(false);
    expect(canCode).not.toHaveBeenCalled();
    expect(canPayment({ isResolved: true, canCode }, 'payment:create')).toBe(true);
    expect(canCode).toHaveBeenCalledWith('payment:create');
  });
});

describe('useInvoiceAccess — what the invoice drawer allows', () => {
  beforeEach(() => {
    access.resolved = true;
    access.codes = new Set();
    access.sections = new Set();
  });

  it('lets a member with payment:create bill a new invoice — nothing to delete yet', () => {
    hold('payment:create', 'payment:delete');
    const { result } = renderHook(() => useInvoiceAccess(null, false));
    expect(result.current).toEqual({
      resolved: true,
      readOnly: false,
      locked: null,
      canDelete: false,
      floorVisible: false,
      addOffering: false,
      addMedicine: false,
    });
  });

  it('reads a new invoice "View only" without payment:create — payment:update is not enough', () => {
    hold('payment:read', 'payment:update');
    const { result } = renderHook(() => useInvoiceAccess(null, false));
    expect(result.current.readOnly).toBe(true);
  });

  it('asks payment:update of a saved invoice, and payment:delete for Delete', () => {
    const saved = invoiceRecord();
    hold('payment:create');
    expect(renderHook(() => useInvoiceAccess(saved, false)).result.current).toMatchObject(
      {
        readOnly: true,
        canDelete: false,
      },
    );
    hold('payment:update', 'payment:delete');
    expect(renderHook(() => useInvoiceAccess(saved, false)).result.current).toMatchObject(
      {
        readOnly: false,
        locked: null,
        canDelete: true,
      },
    );
  });

  it('locks a settled invoice for everyone, the owner too — and offers no Delete', () => {
    hold('payment:update', 'payment:delete', 'payment:create');
    const settled = invoiceRecord({ isSettled: true });
    expect(
      renderHook(() => useInvoiceAccess(settled, false)).result.current,
    ).toMatchObject({
      readOnly: true,
      locked: 'settled',
      canDelete: false,
    });
  });

  it('locks a Medical sale’s invoice — Medical changes it, settled or not', () => {
    hold('payment:update', 'payment:delete');
    const sale = invoiceRecord({ type: 'medical', isSettled: true });
    expect(renderHook(() => useInvoiceAccess(sale, false)).result.current).toMatchObject({
      readOnly: true,
      locked: 'sale',
      canDelete: false,
    });
  });

  it('asks Medical’s create of a new sale — never payment:create', () => {
    hold('payment:create');
    expect(renderHook(() => useInvoiceAccess(null, true)).result.current.readOnly).toBe(
      true,
    );
    access.codes = new Set();
    access.sections = new Set(['medical:create']);
    expect(renderHook(() => useInvoiceAccess(null, true)).result.current).toMatchObject({
      readOnly: false,
      addMedicine: true,
    });
  });

  it('names the lowest price and offers "New offering" only for their own codes', () => {
    hold('payment:create', 'offering:lower_price:read');
    expect(renderHook(() => useInvoiceAccess(null, false)).result.current).toMatchObject({
      floorVisible: true,
      addOffering: false,
    });
    hold('payment:create', 'offering:create');
    expect(renderHook(() => useInvoiceAccess(null, false)).result.current).toMatchObject({
      floorVisible: false,
      addOffering: true,
    });
  });

  it('is not "View only" before the access answers — and allows nothing yet', () => {
    access.resolved = false;
    hold('payment:create', 'payment:delete', 'offering:create');
    access.sections = new Set(['medical:create']);
    const saved = invoiceRecord();
    expect(renderHook(() => useInvoiceAccess(saved, false)).result.current).toEqual({
      resolved: false,
      readOnly: false,
      locked: null,
      canDelete: false,
      floorVisible: false,
      addOffering: false,
      addMedicine: false,
    });
    // A lock is the invoice's own: it holds before the access answers.
    const settled = invoiceRecord({ isSettled: true });
    expect(
      renderHook(() => useInvoiceAccess(settled, false)).result.current,
    ).toMatchObject({
      readOnly: true,
      locked: 'settled',
    });
  });
});
