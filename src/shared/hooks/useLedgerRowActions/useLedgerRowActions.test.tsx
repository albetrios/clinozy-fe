import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { ledgerRow } from '@/tests/utils/payments-doubles.ts';

import { useLedgerRowActions } from './useLedgerRowActions.ts';

/** Every code an Owner holds in the ledger. */
const ALL: readonly OrganizationPermission[] = [
  'organization:read',
  'payment:read',
  'payment:create',
  'payment:update',
  'payment:delete',
];

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The hook for a member holding `codes`, with Reverse offered unless `reverse` is false. */
function renderActions(codes: readonly OrganizationPermission[], reverse = true) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions([...codes]);
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onReverse = vi.fn();
  const hook = renderHook(
    () =>
      useLedgerRowActions({
        onEdit,
        onDelete,
        onReverse: reverse ? onReverse : undefined,
      }),
    { wrapper },
  );
  return { ...hook, onEdit, onDelete, onReverse };
}

const ids = (actions: readonly { id: string }[]) => actions.map((action) => action.id);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
});

describe('useLedgerRowActions (payments.md:34)', () => {
  it('offers Edit and Delete on an open day’s entry; Delete names what the invoice goes back to', async () => {
    const entry = ledgerRow();
    const { result, onEdit, onDelete } = renderActions(ALL);
    await waitFor(() => expect(result.current(entry)).toHaveLength(2));
    const [edit, remove] = result.current(entry);
    expect(edit).toMatchObject({ id: 'edit', label: 'Edit' });
    expect(remove).toMatchObject({ id: 'delete', label: 'Delete', destructive: true });
    edit?.onSelect();
    expect(onEdit).toHaveBeenCalledWith(entry);
    remove?.onSelect();
    // Invoice #5's ₹100 due, with this receipt's ₹150 back on it.
    expect(onDelete).toHaveBeenCalledWith({ entry, dueAfter: 250 });
  });

  it('gates each action on its own code: Edit on payment:update, Delete on payment:delete', async () => {
    const entry = ledgerRow();
    const { result } = renderActions(['payment:read', 'payment:update']);
    await waitFor(() => expect(ids(result.current(entry))).toEqual(['edit']));
    const deleter = renderActions(['payment:read', 'payment:delete']);
    await waitFor(() => expect(ids(deleter.result.current(entry))).toEqual(['delete']));
  });

  it('offers a refund or a reversal on its day only Delete — its money is fixed', async () => {
    const { result } = renderActions(ALL);
    await waitFor(() =>
      expect(ids(result.current(ledgerRow({ kind: 'reversal' })))).toEqual(['delete']),
    );
    expect(ids(result.current(ledgerRow({ kind: 'refund', direction: 'paid' })))).toEqual(
      ['delete'],
    );
  });

  it('offers Reverse on a closed day’s entry — once, never on a reversal, with payment:delete', async () => {
    const settled = ledgerRow({ isSettled: true });
    const { result, onReverse } = renderActions(ALL);
    await waitFor(() => expect(ids(result.current(settled))).toEqual(['reverse']));
    const [reverse] = result.current(settled);
    expect(reverse).toMatchObject({ destructive: true });
    reverse?.onSelect();
    expect(onReverse).toHaveBeenCalledWith(settled);
    expect(
      result.current({ ...settled, reversedByPaymentId: 'pay_4xxwn45a73pygol64wr2b' }),
    ).toEqual([]);
    expect(result.current({ ...settled, kind: 'reversal' })).toEqual([]);
    // A pending credit's entry on an open day offers nothing: it is the credit's.
    expect(result.current(ledgerRow({ pendingCreditSeq: 1 }))).toEqual([]);
    const reader = renderActions(['payment:read', 'payment:update']);
    await waitFor(() =>
      expect(ids(reader.result.current(ledgerRow()))).toEqual(['edit']),
    );
    expect(reader.result.current(settled)).toEqual([]);
  });

  it('offers no Reverse where none is asked for (Day close’s review)', async () => {
    const { result } = renderActions(ALL, false);
    await waitFor(() => expect(result.current(ledgerRow())).toHaveLength(2));
    expect(result.current(ledgerRow({ isSettled: true }))).toEqual([]);
  });
});
