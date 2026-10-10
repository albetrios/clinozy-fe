import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
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

/** The member's stock access, previewed as `role`. */
async function accessAs(role: Role) {
  const view = renderStockRoutes(
    '/organization/acme/stock/items',
    { items: Probe },
    { role },
  );
  const flags = JSON.parse((await screen.findByTestId('access')).textContent ?? '{}');
  view.unmount();
  return flags;
}

afterEach(() => resetStockRoutes());

describe('useStockAccess', () => {
  it('gives Admin everything: create, edit, delete and pay', async () => {
    expect(await accessAs('admin')).toEqual({
      resolved: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canPay: true,
      creating: { readOnly: false, canDelete: false },
      editing: { readOnly: false, canDelete: true },
    });
  });

  it('reads each action from the stock section — the previewed role’s grants', async () => {
    expect(await accessAs('pharmacist')).toMatchObject({
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canPay: false,
    });
    // The design's matrix lets a Therapist create alone; a saved record opens view only.
    expect(await accessAs('therapist')).toMatchObject({
      canCreate: true,
      canEdit: false,
      creating: { readOnly: false },
      editing: { readOnly: true, canDelete: false },
    });
    expect(await accessAs('accountant')).toMatchObject({
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
      useUIStore.setState({ previewRole: null });
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
