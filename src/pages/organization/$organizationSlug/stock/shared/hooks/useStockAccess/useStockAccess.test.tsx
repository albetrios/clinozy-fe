import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { useStockAccess } from './useStockAccess.ts';

/** The flags, once access resolves. */
function Probe() {
  const access = useStockAccess();
  return access.resolved ? (
    <pre data-testid="access">{JSON.stringify(access)}</pre>
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
  it('lets Admin and Pharmacist keep the stock, Admin alone delete', async () => {
    expect(await accessAs('admin')).toEqual({
      resolved: true,
      canUse: true,
      canEdit: true,
      canManage: true,
      canDelete: true,
    });
    expect(await accessAs('pharmacist')).toMatchObject({
      canManage: true,
      canDelete: false,
    });
  });

  it('lets Therapist and Front desk use stock only (Q-K2), the Accountant view', async () => {
    expect(await accessAs('therapist')).toEqual({
      resolved: true,
      canUse: true,
      canEdit: false,
      canManage: false,
      canDelete: false,
    });
    expect(await accessAs('front_desk')).toMatchObject({
      canUse: true,
      canManage: false,
    });
    expect(await accessAs('accountant')).toEqual({
      resolved: true,
      canUse: false,
      canEdit: false,
      canManage: false,
      canDelete: false,
    });
  });
});
