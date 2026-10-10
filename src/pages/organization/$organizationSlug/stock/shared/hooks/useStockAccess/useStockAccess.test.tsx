import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
  type StockTestMember,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { useStockAccess, useStockDrawerAccess } from './useStockAccess.ts';

/** The flags, once access resolves. */
function Probe() {
  const access = useStockAccess();
  const creating = useStockDrawerAccess(false);
  const editing = useStockDrawerAccess(true);
  return access.resolved ? (
    <pre data-testid="access">{JSON.stringify({ ...access, creating, editing })}</pre>
  ) : null;
}

/** The stock access of `member` — a preset's codes, or their own. */
async function accessAs(member: StockTestMember) {
  const view = renderStockRoutes(
    '/organization/acme/stock/items',
    { items: Probe },
    member,
  );
  const flags = JSON.parse((await screen.findByTestId('access')).textContent ?? '{}');
  view.unmount();
  return flags;
}

afterEach(() => resetStockRoutes());

describe('useStockAccess', () => {
  it('gives Admin everything: create, edit, delete and pay', async () => {
    expect(await accessAs({ role: 'admin' })).toEqual({
      resolved: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canPay: true,
      creating: { readOnly: false, canDelete: false },
      editing: { readOnly: false, canDelete: true },
    });
  });

  it('reads each action from the member’s stock codes', async () => {
    expect(await accessAs({ role: 'pharmacist' })).toMatchObject({
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canPay: true,
    });
    expect(await accessAs({ role: 'therapist' })).toMatchObject({
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canPay: false,
    });
    // Create without update: a saved record opens view only.
    expect(
      await accessAs({
        permissions: ['organization:read', 'stock_item:read', 'stock_item:create'],
      }),
    ).toMatchObject({
      canCreate: true,
      canEdit: false,
      creating: { readOnly: false },
      editing: { readOnly: true, canDelete: false },
    });
    expect(await accessAs({ role: 'accountant' })).toMatchObject({
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canPay: true,
      creating: { readOnly: true },
    });
  });

  it('asks a signed-in member for `payment:create` to pay a bill', async () => {
    renderStockRoutes('/organization/acme/stock/items', { items: Probe });
    act(() => {
      useOrganizationStore
        .getState()
        .setPermissions(['organization:read', 'stock_item:read', 'payment:create']);
    });
    expect(
      JSON.parse((await screen.findByTestId('access')).textContent ?? '{}'),
    ).toMatchObject({ canPay: true });
    act(() =>
      useOrganizationStore
        .getState()
        .setPermissions(['organization:read', 'stock_item:read']),
    );
    expect(
      JSON.parse((await screen.findByTestId('access')).textContent ?? '{}'),
    ).toMatchObject({ canPay: false });
  });
});
